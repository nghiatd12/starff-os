import { Router } from 'express'
import { query, queryAll, queryOne } from '../db/pool.js'
import { authenticate, authorizeScreens } from '../middleware/auth.js'

const router = Router()

function groupMenu(items) {
  const menu = {}
  for (const item of items) {
    if (!menu[item.category]) menu[item.category] = []
    menu[item.category].push(item)
  }
  return { menu, categories: Object.keys(menu) }
}

async function listCategories(tenantId, menuSetId) {
  return queryAll(
    `SELECT
       mc.id,
       mc.name,
       mc.sort_order,
       COUNT(mi.id)::int AS item_count
     FROM menu_categories mc
     LEFT JOIN menu_items mi
       ON mi.tenant_id = mc.tenant_id
      AND mi.menu_set_id = mc.menu_set_id
      AND mi.category = mc.name
     WHERE mc.tenant_id = $1 AND mc.menu_set_id = $2
     GROUP BY mc.id
     ORDER BY mc.sort_order, mc.name`,
    [tenantId, menuSetId]
  )
}

async function ensureCategory(tenantId, menuSetId, name) {
  const categoryName = String(name || '').trim()
  if (!categoryName) return null

  const existing = await queryOne(
    'SELECT * FROM menu_categories WHERE tenant_id = $1 AND menu_set_id = $2 AND LOWER(name) = LOWER($3)',
    [tenantId, menuSetId, categoryName]
  )
  if (existing) return existing

  const { rows: [category] } = await query(
    `INSERT INTO menu_categories (tenant_id, menu_set_id, name, sort_order)
     VALUES (
       $1,
       $2,
       $3,
       COALESCE((SELECT MAX(sort_order) + 1 FROM menu_categories WHERE tenant_id = $1 AND menu_set_id = $2), 0)
     )
     RETURNING *`,
    [tenantId, menuSetId, categoryName]
  )
  return category
}

async function resolveTenantId(req) {
  let tenantId = null

  if (req.headers.authorization) {
    try {
      const jwt = await import('jsonwebtoken')
      const token = req.headers.authorization.split(' ')[1]
      const payload = jwt.default.verify(token, process.env.JWT_SECRET)
      tenantId = payload.tenantId
    } catch (e) { /* ignore public fallback */ }
  }

  if (!tenantId && req.query.tenant) {
    const tenant = await queryOne(
      `SELECT id FROM tenants
       WHERE slug = $1 AND status = 'active' AND deleted_at IS NULL`,
      [req.query.tenant]
    )
    tenantId = tenant?.id || null
  }

  return tenantId
}

async function ensureDefaultMenuSet(tenantId) {
  const active = await queryOne(
    'SELECT * FROM menu_sets WHERE tenant_id = $1 AND is_active = true ORDER BY id LIMIT 1',
    [tenantId]
  )
  if (active) return active

  const { rows: [created] } = await query(
    `INSERT INTO menu_sets (tenant_id, name, type, description, is_active)
     VALUES ($1, 'Menu mặc định', 'regular', 'Bộ menu được tạo tự động', true)
     ON CONFLICT (tenant_id, name) DO UPDATE SET is_active = true, updated_at = NOW()
     RETURNING *`,
    [tenantId]
  )

  await query(
    'UPDATE menu_items SET menu_set_id = $1 WHERE tenant_id = $2 AND menu_set_id IS NULL',
    [created.id, tenantId]
  )

  return created
}

/**
 * GET /api/menu
 * Lấy menu active cho order/QR, hoặc lấy theo ?menuSetId=...
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req)
    if (!tenantId) {
      return res.status(400).json({ error: 'Thiếu thông tin quán' })
    }

    const menuSet = req.query.menuSetId
      ? await queryOne('SELECT * FROM menu_sets WHERE id = $1 AND tenant_id = $2', [req.query.menuSetId, tenantId])
      : await ensureDefaultMenuSet(tenantId)

    if (!menuSet) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })

    const items = await queryAll(
      `SELECT id, menu_set_id, name, category, price, description, available, image_url AS "imageUrl"
       FROM menu_items
       WHERE tenant_id = $1 AND menu_set_id = $2 AND available = true
       ORDER BY category, sort_order, name`,
      [tenantId, menuSet.id]
    )

    res.json({ ...groupMenu(items), menuSet })
  } catch (err) {
    console.error('[Menu] Get error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/sets', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    await ensureDefaultMenuSet(req.user.tenantId)
    const sets = await queryAll(
      `SELECT ms.*,
        COUNT(mi.id)::int AS item_count,
        COALESCE(SUM(CASE WHEN mi.available THEN 1 ELSE 0 END), 0)::int AS available_count
       FROM menu_sets ms
       LEFT JOIN menu_items mi ON mi.menu_set_id = ms.id AND mi.tenant_id = ms.tenant_id
       WHERE ms.tenant_id = $1
       GROUP BY ms.id
       ORDER BY ms.is_active DESC, ms.updated_at DESC, ms.id DESC`,
      [req.user.tenantId]
    )
    res.json({ sets })
  } catch (err) {
    console.error('[Menu] List sets error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/sets', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { name, type = 'regular', description = '', isActive = false } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Thiếu tên bộ menu' })

    if (isActive) {
      await query('UPDATE menu_sets SET is_active = false WHERE tenant_id = $1', [req.user.tenantId])
    }

    const { rows: [set] } = await query(
      `INSERT INTO menu_sets (tenant_id, name, type, description, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.tenantId, name.trim(), type, description, isActive]
    )
    res.status(201).json({ set })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tên bộ menu đã tồn tại' })
    console.error('[Menu] Create set error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.patch('/sets/:setId', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { name, type, description, isActive } = req.body
    if (isActive === true) {
      await query('UPDATE menu_sets SET is_active = false WHERE tenant_id = $1', [req.user.tenantId])
    }

    const { rows: [set] } = await query(
      `UPDATE menu_sets SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        description = COALESCE($3, description),
        is_active = COALESCE($4, is_active),
        updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [name?.trim(), type, description, isActive, req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })
    res.json({ set })
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tên bộ menu đã tồn tại' })
    console.error('[Menu] Update set error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/sets/:setId/activate', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const existing = await queryOne(
      'SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })

    await query('UPDATE menu_sets SET is_active = false WHERE tenant_id = $1', [req.user.tenantId])
    const { rows: [set] } = await query(
      'UPDATE menu_sets SET is_active = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [req.params.setId, req.user.tenantId]
    )
    res.json({ set })
  } catch (err) {
    console.error('[Menu] Activate set error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/sets/:setId/items', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const set = await queryOne(
      'SELECT * FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })

    const items = await queryAll(
      `SELECT id, menu_set_id, name, category, price, description, available, image_url AS "imageUrl", sort_order
       FROM menu_items
       WHERE tenant_id = $1 AND menu_set_id = $2
       ORDER BY category, sort_order, name`,
      [req.user.tenantId, req.params.setId]
    )
    const categoryRows = await listCategories(req.user.tenantId, req.params.setId)
    res.json({ set, items, categoryRows, ...groupMenu(items) })
  } catch (err) {
    console.error('[Menu] Get set items error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/sets/:setId/categories', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const set = await queryOne(
      'SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })

    const categories = await listCategories(req.user.tenantId, req.params.setId)
    res.json({ categories })
  } catch (err) {
    console.error('[Menu] List categories error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/sets/:setId/categories', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Nhập tên danh mục' })

    const set = await queryOne(
      'SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })

    const existing = await queryOne(
      'SELECT id FROM menu_categories WHERE tenant_id = $1 AND menu_set_id = $2 AND LOWER(name) = LOWER($3)',
      [req.user.tenantId, req.params.setId, name]
    )
    if (existing) return res.status(409).json({ error: 'Danh mục đã có' })

    const category = await ensureCategory(req.user.tenantId, req.params.setId, name)
    res.status(201).json({ category })
  } catch (err) {
    console.error('[Menu] Create category error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/sets/:setId/items', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { name, category, price, description = '', available = true, imageUrl = null, image_url = null } = req.body
    if (!name || !category || !price) return res.status(400).json({ error: 'Thiếu thông tin món' })

    const set = await queryOne(
      'SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })
    await ensureCategory(req.user.tenantId, req.params.setId, category)

    const { rows: [item] } = await query(
      `INSERT INTO menu_items (tenant_id, menu_set_id, name, category, price, description, available, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.tenantId, req.params.setId, name, category, Number(price), description, available, imageUrl || image_url || null]
    )
    res.status(201).json({ item })
  } catch (err) {
    console.error('[Menu] Create item error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/sets/:setId/import', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { items = [], mode = 'append' } = req.body
    const set = await queryOne(
      'SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2',
      [req.params.setId, req.user.tenantId]
    )
    if (!set) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'File chưa có món hợp lệ' })
    }

    if (mode === 'replace') {
      await query(
        'UPDATE menu_items SET available = false WHERE tenant_id = $1 AND menu_set_id = $2',
        [req.user.tenantId, req.params.setId]
      )
    }

    const inserted = []
    const skipped = []
    for (const [index, raw] of items.entries()) {
      const name = String(raw.name || '').trim()
      const category = String(raw.category || '').trim()
      const price = Number(raw.price)
      const description = String(raw.description || '').trim()
      const available = raw.available === undefined ? true : Boolean(raw.available)
      const imageUrl = String(raw.imageUrl || raw.image_url || raw.image || '').trim() || null

      if (!name || !category || !Number.isFinite(price) || price <= 0) {
        skipped.push({ row: index + 2, name, reason: 'Thiếu tên, danh mục hoặc giá' })
        continue
      }
      await ensureCategory(req.user.tenantId, req.params.setId, category)

      const { rows: [item] } = await query(
        `INSERT INTO menu_items (tenant_id, menu_set_id, name, category, price, description, available, sort_order, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [req.user.tenantId, req.params.setId, name, category, Math.round(price), description, available, inserted.length, imageUrl]
      )
      inserted.push(item)
    }

    res.json({ inserted, skipped, insertedCount: inserted.length, skippedCount: skipped.length })
  } catch (err) {
    console.error('[Menu] Import error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/menu
 * Thêm món mới vào bộ menu active (tương thích API cũ)
 */
router.post('/', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { name, category, price, description, menuSetId, imageUrl = null, image_url = null } = req.body
    if (!name || !category || !price) return res.status(400).json({ error: 'Thiếu thông tin món' })

    const menuSet = menuSetId
      ? await queryOne('SELECT id FROM menu_sets WHERE id = $1 AND tenant_id = $2', [menuSetId, req.user.tenantId])
      : await ensureDefaultMenuSet(req.user.tenantId)
    if (!menuSet) return res.status(404).json({ error: 'Không tìm thấy bộ menu' })
    await ensureCategory(req.user.tenantId, menuSet.id, category)

    const { rows: [item] } = await query(
      `INSERT INTO menu_items (tenant_id, menu_set_id, name, category, price, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.tenantId, menuSet.id, name, category, price, description || '', imageUrl || image_url || null]
    )
    res.status(201).json({ item })
  } catch (err) {
    console.error('[Menu] Create legacy item error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/menu/:id
 * Cập nhật món.
 */
router.patch('/:id', authenticate, authorizeScreens('menu'), async (req, res) => {
  try {
    const { name, price, available, category, description, menuSetId, imageUrl, image_url } = req.body
    const nextImageUrl = imageUrl === undefined ? image_url : imageUrl
    const { rows: [item] } = await query(
      `UPDATE menu_items SET
        name = COALESCE($1, name),
        price = COALESCE($2, price),
        available = COALESCE($3, available),
        category = COALESCE($4, category),
        description = COALESCE($5, description),
        menu_set_id = COALESCE($6, menu_set_id),
        image_url = COALESCE($7, image_url)
       WHERE id = $8 AND tenant_id = $9 RETURNING *`,
      [name, price, available, category, description, menuSetId, nextImageUrl, req.params.id, req.user.tenantId]
    )
    if (!item) return res.status(404).json({ error: 'Không tìm thấy món' })
    res.json({ item })
  } catch (err) {
    console.error('[Menu] Update item error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
