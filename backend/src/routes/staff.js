import { Router } from 'express'
import bcrypt from 'bcrypt'
import { query, queryOne } from '../db/pool.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

const ROLE_LABEL = {
  owner:   'Chủ quán',
  manager: 'Quản lý',
  waiter:  'Phục vụ',
  cashier: 'Thu ngân',
  kitchen: 'Bếp',
}

/**
 * GET /api/staff
 * Lấy danh sách nhân viên của tenant hiện tại
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user
    const rows = await query(
      `SELECT id, name, phone, role, pin, is_active, created_at
       FROM users
       WHERE tenant_id = $1 AND role != 'owner'
       ORDER BY created_at ASC`,
      [tenantId]
    )
    res.json(rows)
  } catch (err) {
    console.error('[Staff] GET error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * POST /api/staff
 * Thêm nhân viên mới
 * Body: { name, phone, role, pin, password }
 */
router.post('/', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { tenantId } = req.user
    const { name, phone, role, pin, password } = req.body

    if (!name || !phone || !role) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (tên, số điện thoại, vai trò)' })
    }

    const validRoles = ['manager', 'waiter', 'cashier', 'kitchen']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Vai trò không hợp lệ' })
    }

    // Kiểm tra số điện thoại đã tồn tại
    const existing = await queryOne('SELECT id FROM users WHERE phone = $1', [phone])
    if (existing) {
      return res.status(409).json({ error: 'Số điện thoại đã được sử dụng' })
    }

    // Mật khẩu mặc định là PIN hoặc '123456'
    const rawPassword = password || pin || '123456'
    const passwordHash = await bcrypt.hash(rawPassword, 10)

    const { rows: [user] } = await query(
      `INSERT INTO users (tenant_id, name, phone, password_hash, role, pin, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id, name, phone, role, pin, is_active, created_at`,
      [tenantId, name.trim(), phone.trim(), passwordHash, role, pin || null]
    )

    res.status(201).json(user)
  } catch (err) {
    console.error('[Staff] POST error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/staff/:id
 * Cập nhật thông tin nhân viên
 */
router.patch('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { tenantId } = req.user
    const { id } = req.params
    const { name, phone, role, pin, is_active } = req.body

    // Kiểm tra nhân viên thuộc tenant này
    const existing = await queryOne(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND role != $3',
      [id, tenantId, 'owner']
    )
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    }

    const fields = []
    const values = []
    let idx = 1

    if (name !== undefined)      { fields.push(`name = $${idx++}`);      values.push(name.trim()) }
    if (phone !== undefined)     { fields.push(`phone = $${idx++}`);     values.push(phone.trim()) }
    if (role !== undefined)      { fields.push(`role = $${idx++}`);      values.push(role) }
    if (pin !== undefined)       { fields.push(`pin = $${idx++}`);       values.push(pin) }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active) }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Không có thông tin cần cập nhật' })
    }

    values.push(id, tenantId)
    const { rows: [updated] } = await query(
      `UPDATE users SET ${fields.join(', ')}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING id, name, phone, role, pin, is_active, created_at`,
      values
    )

    res.json(updated)
  } catch (err) {
    console.error('[Staff] PATCH error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * DELETE /api/staff/:id
 * Vô hiệu hóa nhân viên (soft delete)
 */
router.delete('/:id', authenticate, authorize('owner', 'manager'), async (req, res) => {
  try {
    const { tenantId } = req.user
    const { id } = req.params

    const existing = await queryOne(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2 AND role != $3',
      [id, tenantId, 'owner']
    )
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy nhân viên' })
    }

    await query(
      'UPDATE users SET is_active = false WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('[Staff] DELETE error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
