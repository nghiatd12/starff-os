import { Router } from 'express'
import pool, { query, queryOne, queryAll } from '../db/pool.js'
import { authenticate, authorizeScreens } from '../middleware/auth.js'
import { emitToRoles } from '../socketRooms.js'

const router = Router()
router.use(authenticate)

/**
 * POST /api/orders
 * Tạo order mới cho bàn
 */
router.post('/', authorizeScreens('order'), async (req, res) => {
  try {
    const { tableId, guestCount, items, note } = req.body

    if (!tableId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Thiếu bàn hoặc món' })
    }

    const table = await queryOne(
      'SELECT id FROM tables WHERE id = $1 AND tenant_id = $2',
      [tableId, req.user.tenantId]
    )
    if (!table) return res.status(404).json({ error: 'Không tìm thấy bàn' })

    const validatedItems = []
    for (const rawItem of items) {
      const menuItem = await queryOne(
        'SELECT id, name, price FROM menu_items WHERE id = $1 AND tenant_id = $2 AND available = true',
        [rawItem.menuItemId, req.user.tenantId]
      )
      if (!menuItem) {
        return res.status(400).json({ error: `Món "${rawItem.name || rawItem.menuItemId}" không còn phục vụ` })
      }
      validatedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: Math.max(1, parseInt(rawItem.quantity) || 1),
        note: rawItem.note || '',
      })
    }

    // Tạo order
    const total = validatedItems.reduce((s, i) => s + i.price * i.quantity, 0)
    const { rows: [order] } = await query(
      `INSERT INTO orders (tenant_id, table_id, user_id, guest_count, note, total, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'open') RETURNING *`,
      [req.user.tenantId, tableId, req.user.id, guestCount || 1, note || '', total]
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
      [tableId, req.user.tenantId]
    )

    // Lấy order đầy đủ
    const orderItems = await queryAll(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [order.id]
    )

    const fullOrder = { ...order, items: orderItems }

    // 🔥 Emit realtime → màn hình bếp
    const io = req.app.get('io')
    emitToRoles(io, req.user.tenantId, ['kitchen'], 'new-order', fullOrder)
    emitToRoles(io, req.user.tenantId, ['waiter'], 'table-updated', { id: tableId, status: 'occupied' })

    res.status(201).json({ order: fullOrder })
  } catch (err) {
    console.error('[Orders] Create error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * GET /api/orders/active
 * Lấy tất cả order đang mở (cho KDS và waiter)
 */
router.get('/active', authorizeScreens('order', 'kitchen'), async (req, res) => {
  try {
    const orders = await queryAll(
      `SELECT o.*, t.name as table_name
       FROM orders o JOIN tables t ON o.table_id = t.id
       WHERE o.tenant_id = $1 AND o.status IN ('open', 'preparing')
       ORDER BY o.created_at ASC`,
      [req.user.tenantId]
    )

    // Lấy items cho mỗi order
    for (const order of orders) {
      order.items = await queryAll(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
        [order.id]
      )
    }

    res.json({ orders })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * GET /api/orders/billing
 * Lấy tất cả order chưa thanh toán cho màn thu ngân.
 * Khác /active: bao gồm cả order đã bếp hoàn thành (ready) để vẫn còn bill.
 */
router.get('/billing', authorizeScreens('cashier'), async (req, res) => {
  try {
    const orders = await queryAll(
      `SELECT o.*, t.name as table_name
       FROM orders o JOIN tables t ON o.table_id = t.id
       WHERE o.tenant_id = $1 AND o.status IN ('open', 'preparing', 'ready')
       ORDER BY o.created_at ASC`,
      [req.user.tenantId]
    )

    for (const order of orders) {
      order.items = await queryAll(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
        [order.id]
      )
    }

    res.json({ orders })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.get('/history', authorizeScreens('cashier'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const orders = await queryAll(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.tenant_id = $1 AND o.status = 'paid'
       ORDER BY o.closed_at DESC NULLS LAST, o.created_at DESC
       LIMIT $2`,
      [req.user.tenantId, limit]
    )

    for (const order of orders) {
      order.items = await queryAll(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`,
        [order.id]
      )
    }

    res.json({ orders })
  } catch (err) {
    console.error('[Orders] History error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.patch('/:id/bill', authorizeScreens('cashier'), async (req, res) => {
  try {
    const { items, paymentMethod, discount } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Hóa đơn phải có ít nhất 1 món' })
    }

    const order = await queryOne(
      `SELECT id FROM orders WHERE id = $1 AND tenant_id = $2 AND status = 'paid'`,
      [req.params.id, req.user.tenantId]
    )
    if (!order) return res.status(404).json({ error: 'Không tìm thấy hóa đơn đã thanh toán' })

    const normalizedItems = items.map((item) => ({
      id: item.id,
      name: String(item.name || '').trim(),
      price: Math.max(0, Math.round(Number(item.price) || 0)),
      quantity: Math.max(1, Math.round(Number(item.quantity || item.qty) || 1)),
    })).filter((item) => item.name)

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'Món trong hóa đơn không hợp lệ' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const { rows: existingItems } = await client.query(
        `SELECT id FROM order_items WHERE order_id = $1`,
        [req.params.id]
      )
      const incomingIds = new Set(normalizedItems.filter((item) => item.id).map((item) => Number(item.id)))

      for (const existing of existingItems) {
        if (!incomingIds.has(existing.id)) {
          await client.query(`DELETE FROM order_items WHERE id = $1 AND order_id = $2`, [existing.id, req.params.id])
        }
      }

      for (const item of normalizedItems) {
        if (item.id) {
          await client.query(
            `UPDATE order_items
             SET name = $1, price = $2, quantity = $3
             WHERE id = $4 AND order_id = $5`,
            [item.name, item.price, item.quantity, item.id, req.params.id]
          )
        } else {
          await client.query(
            `INSERT INTO order_items (order_id, name, price, quantity, status)
             VALUES ($1, $2, $3, $4, 'done')`,
            [req.params.id, item.name, item.price, item.quantity]
          )
        }
      }

      const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const discountPercent = Math.min(100, Math.max(0, Number(discount) || 0))
      const discountAmount = Math.round(subtotal * discountPercent / 100)
      const total = Math.max(0, subtotal - discountAmount)

      const { rows: [updated] } = await client.query(
        `UPDATE orders
         SET total = $1, payment_method = COALESCE($2, payment_method), discount_percent = $3
         WHERE id = $4 AND tenant_id = $5
         RETURNING *`,
        [total, paymentMethod || null, discountPercent, req.params.id, req.user.tenantId]
      )
      const { rows: updatedItems } = await client.query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY id`, [req.params.id])
      updated.items = updatedItems
      await client.query('COMMIT')
      res.json({ order: updated })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('[Orders] Update bill error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/orders/:id/items/:itemId
 * Cập nhật trạng thái món (pending → preparing → done)
 * Dùng cho bếp tick từng món
 */
router.patch('/:id/items/:itemId', authorizeScreens('kitchen'), async (req, res) => {
  try {
    const { status } = req.body
    const validStatuses = ['pending', 'preparing', 'done']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ' })
    }

    const { rows: [item] } = await query(
      `UPDATE order_items oi
       SET status = $1
       FROM orders o
       WHERE oi.order_id = o.id
         AND oi.id = $2
         AND oi.order_id = $3
         AND o.tenant_id = $4
       RETURNING oi.*`,
      [status, req.params.itemId, req.params.id, req.user.tenantId]
    )
    if (!item) return res.status(404).json({ error: 'Không tìm thấy món' })

    // Emit realtime
    const io = req.app.get('io')
    emitToRoles(io, req.user.tenantId, ['kitchen', 'waiter'], 'item-updated', { orderId: parseInt(req.params.id), item })

    res.json({ item })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/orders/:id/complete
 * Hoàn thành order (bếp xong hết) → chuyển status = 'ready'
 */
router.patch('/:id/complete', authorizeScreens('kitchen'), async (req, res) => {
  try {
    const { rows: [order] } = await query(
      `UPDATE orders SET status = 'ready' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, req.user.tenantId]
    )
    if (!order) return res.status(404).json({ error: 'Không tìm thấy order' })

    // Cập nhật bàn → waiting (chờ mang ra)
    await query(
      `UPDATE tables SET status = 'waiting' WHERE id = $1 AND tenant_id = $2`,
      [order.table_id, req.user.tenantId]
    )

    // Emit
    const io = req.app.get('io')
    emitToRoles(io, req.user.tenantId, ['waiter'], 'order-ready', order)
    emitToRoles(io, req.user.tenantId, ['kitchen'], 'order-completed', { orderId: order.id })

    res.json({ order })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

/**
 * PATCH /api/orders/:id/pay
 * Thanh toán order → đóng bill
 */
router.patch('/:id/pay', authorizeScreens('cashier'), async (req, res) => {
  try {
    const { paymentMethod, discount } = req.body
    const discountPercent = Math.min(100, Math.max(0, Number(discount) || 0))

    const { rows: [order] } = await query(
      `UPDATE orders
       SET
         status = 'paid',
         closed_at = NOW(),
         payment_method = $3,
         discount_percent = $4,
         total = GREATEST(0, ROUND(total * (1 - ($4::numeric / 100))))::int
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, req.user.tenantId, paymentMethod || 'cash', discountPercent]
    )
    if (!order) return res.status(404).json({ error: 'Không tìm thấy order' })

    // Bàn trống lại
    await query(
      `UPDATE tables SET status = 'empty' WHERE id = $1 AND tenant_id = $2`,
      [order.table_id, req.user.tenantId]
    )

    // Emit
    const io = req.app.get('io')
    emitToRoles(io, req.user.tenantId, ['waiter', 'cashier'], 'table-updated', { id: order.table_id, status: 'empty' })

    res.json({ order, message: 'Thanh toán thành công' })
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
