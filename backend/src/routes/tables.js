import { Router } from 'express'
import { query, queryOne, queryAll } from '../db/pool.js'
import { authenticate, authorize, authorizeScreens } from '../middleware/auth.js'
import { emitToRoles } from '../socketRooms.js'

const router = Router()

// Tất cả routes cần đăng nhập
router.use(authenticate)

/**
 * GET /api/tables
 * Lấy danh sách bàn của quán
 */
router.get('/', authorizeScreens('tables'), async (req, res) => {
  try {
    const tables = await queryAll(
      `SELECT * FROM tables WHERE tenant_id = $1 ORDER BY id`,
      [req.user.tenantId]
    )
    res.json({ tables })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/tables
 * Thêm bàn mới (chỉ owner/manager)
 */
router.post('/', authorizeScreens('tables'), async (req, res) => {
  try {
    const { name, zone, capacity } = req.body
    if (!name) return res.status(400).json({ error: 'Thiếu tên bàn' })

    const { rows: [table] } = await query(
      `INSERT INTO tables (tenant_id, name, zone, capacity)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.tenantId, name, zone || 'indoor', capacity || 4]
    )
    res.status(201).json({ table })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/tables/:id/status
 * Cập nhật trạng thái bàn (empty/occupied/waiting/reserved)
 */
router.patch('/:id/status', authorizeScreens('tables'), async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['empty', 'occupied', 'waiting', 'reserved']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' })
    }

    const { rows: [table] } = await query(
      `UPDATE tables SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [status, req.params.id, req.user.tenantId]
    )
    if (!table) return res.status(404).json({ error: 'Không tìm thấy bàn' })

    // Emit realtime event
    emitToRoles(req.app.get('io'), req.user.tenantId, ['waiter', 'cashier'], 'table-updated', table)

    res.json({ table })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * DELETE /api/tables/:id
 * Xóa bàn (chỉ owner)
 */
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    await query(
      `DELETE FROM tables WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenantId]
    )
    res.json({ message: 'Đã xóa bàn' })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
