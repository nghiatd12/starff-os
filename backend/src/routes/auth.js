import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query, queryOne } from '../db/pool.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

function createSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function uniqueSlug(name) {
  const base = createSlug(name) || `quan-${Date.now()}`
  let slug = base
  let suffix = 1
  while (await queryOne('SELECT id FROM tenants WHERE slug = $1', [slug])) {
    suffix += 1
    slug = `${base}-${suffix}`
  }
  return slug
}

/**
 * POST /api/auth/register
 * Đăng ký quán mới (tạo tenant + user chủ quán)
 */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, password, restaurantName, address, tableCount, type, email } = req.body

    // Validate
    if (!name || !phone || !password || !restaurantName) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' })
    }

    // Check phone đã tồn tại
    const existing = await queryOne('SELECT id FROM users WHERE phone = $1', [phone])
    if (existing) {
      return res.status(409).json({ error: 'Số điện thoại đã được đăng ký' })
    }

    // Tạo slug từ tên quán
    const slug = await uniqueSlug(restaurantName)

    // Tạo tenant
    const { rows: [tenant] } = await query(
      `INSERT INTO tenants
        (name, slug, address, phone, type, table_count, status, owner_name, owner_email, registered_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, 'self')
       RETURNING id`,
      [restaurantName, slug, address || '', phone, type || 'beer', tableCount || 15, name, email || null]
    )

    // Tạo user chủ quán
    const passwordHash = await bcrypt.hash(password, 10)
    await query(
      `INSERT INTO users (tenant_id, name, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'owner')`,
      [tenant.id, name, phone, passwordHash]
    )

    // Tạo bàn mặc định
    const count = parseInt(tableCount) || 15
    for (let i = 1; i <= count; i++) {
      await query(
        `INSERT INTO tables (tenant_id, name, zone, capacity) VALUES ($1, $2, $3, $4)`,
        [tenant.id, `Bàn ${i}`, i <= Math.ceil(count * 0.6) ? 'indoor' : 'outdoor', 4]
      )
    }

    res.status(201).json({
      message: 'Đăng ký thành công! Tài khoản của bạn đang chờ được kích hoạt.',
      tenant: { id: tenant.id, name: restaurantName, slug },
    })
  } catch (err) {
    console.error('[Auth] Register error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/auth/login
 * Đăng nhập bằng SĐT + mật khẩu/PIN
 */
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body

    if (!phone || !password) {
      return res.status(400).json({ error: 'Thiếu số điện thoại hoặc mật khẩu' })
    }

    // Tìm user
    const user = await queryOne(
      `SELECT u.*, t.name as store_name, t.slug as store_slug, t.status as tenant_status
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.phone = $1 AND u.is_active = true AND t.deleted_at IS NULL`,
      [phone]
    )

    if (!user) {
      return res.status(401).json({ error: 'Số điện thoại không tồn tại' })
    }

    // So sánh password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Mật khẩu không đúng' })
    }

    if (user.tenant_status === 'pending') {
      return res.status(403).json({ error: 'Tài khoản đang chờ kích hoạt. Vui lòng liên hệ StaffOS.' })
    }

    if (user.tenant_status === 'inactive') {
      return res.status(403).json({ error: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.' })
    }

    // Tạo JWT token (7 ngày)
    const token = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        name: user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        store: user.store_name,
        storeSlug: user.store_slug,
      },
    })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại (cần token)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.phone, u.role, t.name as store_name, t.slug as store_slug
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        store: user.store_name,
        storeSlug: user.store_slug,
        store_name: user.store_name,
        store_slug: user.store_slug,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
