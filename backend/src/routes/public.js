import { Router } from 'express'
import { query, queryOne, queryAll } from '../db/pool.js'
import { emitToRoles } from '../socketRooms.js'

const router = Router()

/**
 * GET /api/public/:slug
 * Lấy thông tin quán theo slug để màn đăng nhập biết đang vào quán nào.
 */
router.get('/:slug', async (req, res) => {
  try {
    const tenant = await queryOne(
      `SELECT id, name, slug, address
       FROM tenants
       WHERE slug = $1 AND status = 'active' AND deleted_at IS NULL`,
      [req.params.slug]
    )
    if (!tenant) return res.status(404).json({ error: 'Không tìm thấy quán' })

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        address: tenant.address,
      },
    })
  } catch (err) {
    console.error('[Public] Get tenant error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * GET /api/public/:slug/table/:tableId
 * Lấy thông tin bàn + menu — không cần auth
 * Dùng cho trang QR menu của khách
 */
router.get('/:slug/table/:tableId', async (req, res) => {
  try {
    const { slug, tableId } = req.params

    // Tìm tenant theo slug
    const tenant = await queryOne(
      `SELECT id, name, address FROM tenants
       WHERE slug = $1 AND status = 'active' AND deleted_at IS NULL`,
      [slug]
    )
    if (!tenant) {
      return res.status(404).json({ error: 'Không tìm thấy quán' })
    }

    // Tìm bàn — đảm bảo bàn thuộc đúng tenant
    const table = await queryOne(
      'SELECT id, name, zone, capacity, status FROM tables WHERE id = $1 AND tenant_id = $2',
      [tableId, tenant.id]
    )
    if (!table) {
      return res.status(404).json({ error: 'Không tìm thấy bàn' })
    }

    const menuSet = await queryOne(
      'SELECT id, name, type FROM menu_sets WHERE tenant_id = $1 AND is_active = true ORDER BY id LIMIT 1',
      [tenant.id]
    )

    // Lấy menu active. Nếu tenant chưa migrate menu_sets thì fallback sang tất cả món.
    const items = await queryAll(
      `SELECT id, name, category, price, description, image_url AS "imageUrl", menu_set_id
       FROM menu_items
       WHERE tenant_id = $1
         AND available = true
         AND ($2::int IS NULL OR menu_set_id = $2)
       ORDER BY category, sort_order, name`,
      [tenant.id, menuSet?.id || null]
    )

    // Group theo category
    const menu = {}
    for (const item of items) {
      if (!menu[item.category]) menu[item.category] = []
      menu[item.category].push(item)
    }

    res.json({
      tenant: { name: tenant.name, address: tenant.address },
      table,
      menu,
      categories: Object.keys(menu),
      menuSet,
    })
  } catch (err) {
    console.error('[Public] Get table+menu error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/public/:slug/orders
 * Khách gửi order — không cần auth
 * Body: { tableId, items: [{ menuItemId, name, price, quantity, note }] }
 */
router.post('/:slug/orders', async (req, res) => {
  try {
    const { slug } = req.params
    const { tableId, items, guestNote } = req.body

    if (!tableId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Thiếu bàn hoặc món' })
    }

    // Tìm tenant
    const tenant = await queryOne(
      `SELECT id FROM tenants
       WHERE slug = $1 AND status = 'active' AND deleted_at IS NULL`,
      [slug]
    )
    if (!tenant) {
      return res.status(404).json({ error: 'Không tìm thấy quán' })
    }

    // Xác nhận bàn thuộc tenant
    const table = await queryOne(
      'SELECT id, name FROM tables WHERE id = $1 AND tenant_id = $2',
      [tableId, tenant.id]
    )
    if (!table) {
      return res.status(404).json({ error: 'Bàn không hợp lệ' })
    }

    // Validate giá từ DB — không tin giá từ client
    const validatedItems = []
    for (const item of items) {
      const menuItem = await queryOne(
        'SELECT id, name, price FROM menu_items WHERE id = $1 AND tenant_id = $2 AND available = true',
        [item.menuItemId, tenant.id]
      )
      if (!menuItem) {
        return res.status(400).json({ error: `Món "${item.name}" không còn phục vụ` })
      }
      validatedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price, // dùng giá từ DB
        quantity: Math.max(1, parseInt(item.quantity) || 1),
        note: item.note || '',
      })
    }

    const total = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0)

    // Tạo order với source = 'guest' để phân biệt với order của phục vụ
    const { rows: [order] } = await query(
      `INSERT INTO orders (tenant_id, table_id, user_id, guest_count, note, total, status)
       VALUES ($1, $2, NULL, 1, $3, $4, 'open') RETURNING *`,
      [tenant.id, tableId, guestNote || '', total]
    )

    // Thêm từng món
    for (const item of validatedItems) {
      await query(
        `INSERT INTO order_items (order_id, menu_item_id, name, price, quantity, note, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [order.id, item.menuItemId, item.name, item.price, item.quantity, item.note]
      )
    }

    // Cập nhật trạng thái bàn → occupied
    await query(
      `UPDATE tables SET status = 'occupied' WHERE id = $1 AND tenant_id = $2`,
      [tableId, tenant.id]
    )

    // Lấy order đầy đủ
    const orderItems = await queryAll(
      'SELECT * FROM order_items WHERE order_id = $1',
      [order.id]
    )

    const fullOrder = {
      ...order,
      table_name: table.name,
      items: orderItems,
      source: 'guest', // đánh dấu order từ khách tự gọi
    }

    // Broadcast order khách QR tới tất cả màn hình đang online.
    const io = req.app.get('io')
    emitToRoles(io, tenant.id, ['kitchen', 'waiter', 'cashier'], 'new-order', fullOrder)
    emitToRoles(io, tenant.id, ['waiter', 'cashier'], 'table-updated', { id: tableId, status: 'occupied' })

    res.status(201).json({
      success: true,
      orderId: order.id,
      total,
      message: 'Order đã gửi xuống bếp!',
    })
  } catch (err) {
    console.error('[Public] Guest order error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

async function getGuestActionContext(slug, tableId) {
  const tenant = await queryOne(
    `SELECT id, name, slug FROM tenants
     WHERE slug = $1 AND status = 'active' AND deleted_at IS NULL`,
    [slug]
  )
  if (!tenant) return { error: 'Không tìm thấy quán', status: 404 }

  const table = await queryOne(
    'SELECT id, name, zone, status FROM tables WHERE id = $1 AND tenant_id = $2',
    [tableId, tenant.id]
  )
  if (!table) return { error: 'Bàn không hợp lệ', status: 404 }

  return { tenant, table }
}

/**
 * POST /api/public/:slug/call-staff
 * Khách gọi nhân viên từ QR menu. Broadcast tới tất cả clients đang online.
 */
router.post('/:slug/call-staff', async (req, res) => {
  try {
    const { slug } = req.params
    const { tableId, message } = req.body

    if (!tableId) {
      return res.status(400).json({ error: 'Thiếu bàn' })
    }

    const context = await getGuestActionContext(slug, tableId)
    if (context.error) {
      return res.status(context.status).json({ error: context.error })
    }

    const payload = {
      type: 'call-staff',
      tenantId: context.tenant.id,
      storeName: context.tenant.name,
      tableId: context.table.id,
      tableName: context.table.name,
      tableZone: context.table.zone,
      message: message || 'Khách cần hỗ trợ',
      createdAt: new Date().toISOString(),
    }

    emitToRoles(req.app.get('io'), context.tenant.id, ['waiter', 'cashier'], 'guest-call-staff', payload)

    res.json({ success: true, message: 'Đã gọi nhân viên' })
  } catch (err) {
    console.error('[Public] Call staff error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/public/:slug/request-payment
 * Khách gọi thanh toán từ QR menu. Broadcast tới tất cả clients đang online.
 */
router.post('/:slug/request-payment', async (req, res) => {
  try {
    const { slug } = req.params
    const { tableId, total } = req.body

    if (!tableId) {
      return res.status(400).json({ error: 'Thiếu bàn' })
    }

    const context = await getGuestActionContext(slug, tableId)
    if (context.error) {
      return res.status(context.status).json({ error: context.error })
    }

    const payload = {
      type: 'request-payment',
      tenantId: context.tenant.id,
      storeName: context.tenant.name,
      tableId: context.table.id,
      tableName: context.table.name,
      tableZone: context.table.zone,
      total: total || 0,
      message: 'Khách gọi thanh toán',
      createdAt: new Date().toISOString(),
    }

    emitToRoles(req.app.get('io'), context.tenant.id, ['waiter', 'cashier'], 'guest-request-payment', payload)

    res.json({ success: true, message: 'Đã gọi thanh toán' })
  } catch (err) {
    console.error('[Public] Request payment error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
