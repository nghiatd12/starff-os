import jwt from 'jsonwebtoken'
import { queryOne } from '../db/pool.js'

/**
 * Middleware xác thực JWT token
 * Gắn user info vào req.user = { id, tenantId, role, name }
 */
export async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const session = await queryOne(
      `SELECT
        u.id,
        u.tenant_id,
        u.name,
        u.role,
        u.is_active AS user_active,
        t.status AS tenant_status,
        t.deleted_at
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1 AND u.tenant_id = $2`,
      [payload.id, payload.tenantId]
    )

    if (!session || !session.user_active || session.deleted_at || session.tenant_status !== 'active') {
      return res.status(403).json({
        code: 'ACCOUNT_INACTIVE',
        error: session?.tenant_status === 'pending'
          ? 'Tài khoản đang chờ kích hoạt.'
          : 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
      })
    }

    req.user = {
      ...payload,
      id: session.id,
      tenantId: session.tenant_id,
      role: session.role,
      name: session.name,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' })
  }
}

/**
 * Middleware kiểm tra vai trò
 * Dùng: authorize('owner', 'manager')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Không có quyền truy cập' })
    }
    next()
  }
}
