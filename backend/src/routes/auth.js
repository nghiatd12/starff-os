import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query, queryOne } from '../db/pool.js'
import { authenticate } from '../middleware/auth.js'
import { getUserAllowedScreens } from '../permissions.js'

const router = Router()
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL = '1d'

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

function createAccessToken(user) {
  return jwt.sign(
    {
      type: 'access',
      id: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  )
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      type: 'refresh',
      id: user.id,
      tenantId: user.tenant_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL }
  )
}

async function publicUser(user) {
  const permissions = await getUserAllowedScreens(user.tenant_id, user.role)
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    store: user.store_name,
    storeSlug: user.store_slug,
    store_name: user.store_name,
    store_slug: user.store_slug,
    storeAddress: user.store_address || '',
    storePhone: user.store_phone || '',
    store_address: user.store_address || '',
    store_phone: user.store_phone || '',
    permissions,
  }
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
    const { phone, password, storeSlug } = req.body

    if (!phone || !password) {
      return res.status(400).json({ error: 'Thiếu số điện thoại hoặc mật khẩu' })
    }

    // Tìm user
    const params = [phone]
    let tenantFilter = ''
    if (storeSlug) {
      params.push(storeSlug)
      tenantFilter = ` AND t.slug = $${params.length}`
    }

    const user = await queryOne(
      `SELECT u.*, t.name as store_name, t.slug as store_slug, t.address as store_address, t.phone as store_phone, t.status as tenant_status
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.phone = $1 AND u.is_active = true AND t.deleted_at IS NULL${tenantFilter}`,
      params
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

    res.json({
      token: createAccessToken(user),
      refreshToken: createRefreshToken(user),
      expiresIn: 15 * 60,
      refreshExpiresIn: 24 * 60 * 60,
      user: await publicUser(user),
    })
  } catch (err) {
    console.error('[Auth] Login error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(401).json({ error: 'Thiếu refresh token' })

    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET)
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Refresh token không hợp lệ' })
    }

    const user = await queryOne(
      `SELECT u.*, t.name as store_name, t.slug as store_slug, t.address as store_address, t.phone as store_phone, t.status as tenant_status, t.deleted_at
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.tenant_id = $2 AND u.is_active = true`,
      [payload.id, payload.tenantId]
    )

    if (!user || user.deleted_at || user.tenant_status !== 'active') {
      return res.status(403).json({
        code: 'ACCOUNT_INACTIVE',
        error: user?.tenant_status === 'pending'
          ? 'Tài khoản đang chờ kích hoạt.'
          : 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
      })
    }

    res.json({
      token: createAccessToken(user),
      refreshToken: createRefreshToken(user),
      expiresIn: 15 * 60,
      refreshExpiresIn: 24 * 60 * 60,
      user: await publicUser(user),
    })
  } catch (err) {
    return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' })
  }
})

/**
 * GET /api/auth/me
 * Lấy thông tin user hiện tại (cần token)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.phone, u.role, u.tenant_id, t.name as store_name, t.slug as store_slug, t.address as store_address, t.phone as store_phone
       FROM users u JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user: await publicUser(user) })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
