import { Router } from 'express'
import { query } from '../db/pool.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getTenantPermissions, ROLES, SCREENS } from '../permissions.js'

const router = Router()

router.use(authenticate)

router.get('/', authorize('owner'), async (req, res) => {
  try {
    const permissions = await getTenantPermissions(req.user.tenantId)
    res.json({ permissions, roles: ROLES, screens: SCREENS })
  } catch (err) {
    console.error('[Permissions] GET error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.patch('/', authorize('owner'), async (req, res) => {
  try {
    const { role, screen, allowed } = req.body
    if (!ROLES.includes(role) || !SCREENS.includes(screen)) {
      return res.status(400).json({ error: 'Quyền không hợp lệ' })
    }
    if (role === 'owner') {
      return res.status(400).json({ error: 'Không thể chỉnh quyền chủ quán' })
    }

    await query(
      `INSERT INTO role_permissions (tenant_id, role, screen, allowed, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (tenant_id, role, screen)
       DO UPDATE SET allowed = EXCLUDED.allowed, updated_at = NOW()`,
      [req.user.tenantId, role, screen, Boolean(allowed)]
    )

    const permissions = await getTenantPermissions(req.user.tenantId)
    res.json({ permissions })
  } catch (err) {
    console.error('[Permissions] PATCH error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
