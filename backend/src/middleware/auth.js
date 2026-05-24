import jwt from 'jsonwebtoken'
import { roleCanAccessScreens } from '../permissions.js'

/**
 * Middleware xác thực JWT token
 * Gắn user info vào req.user = { id, tenantId, role, name }
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập' })
  }

  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' })
    }
    req.user = payload
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

export function authorizeScreens(...screens) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' })
    }

    try {
      const allowed = await roleCanAccessScreens(req.user.tenantId, req.user.role, screens)
      if (!allowed) {
        return res.status(403).json({ error: 'Không có quyền truy cập' })
      }
      next()
    } catch (err) {
      console.error('[Auth] Permission check error:', err)
      res.status(500).json({ error: 'Lỗi kiểm tra phân quyền' })
    }
  }
}
