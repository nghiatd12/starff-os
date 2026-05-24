import { Router } from 'express'
import { query, queryOne, queryAll } from '../db/pool.js'
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

    const { rows: [order] } = await query(
      `UPDATE orders SET status = 'paid', closed_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [req.params.id, req.user.tenantId]
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
