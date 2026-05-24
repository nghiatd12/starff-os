import { Router } from 'express'
import { queryAll } from '../db/pool.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, authorize('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const customers = await queryAll(
      `SELECT id, name, phone, birthday, tier, points, total_spent, visit_count, last_visit, created_at
       FROM customers
       WHERE tenant_id = $1
       ORDER BY last_visit DESC NULLS LAST, created_at DESC`,
      [req.user.tenantId]
    )

    res.json({ customers })
  } catch (err) {
    console.error('[Customers] GET error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
