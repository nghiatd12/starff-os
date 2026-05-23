import { Router } from 'express'
import { queryAll, queryOne } from '../db/pool.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

function pctChange(current, previous) {
  if (previous === 0 && current === 0) return 0
  if (previous === 0) return 100
  return Math.round(((current - previous) / previous) * 100)
}

router.get('/summary', async (req, res) => {
  try {
    const { tenantId } = req.user

    const stats = await queryOne(
      `WITH
        today_orders AS (
          SELECT * FROM orders
          WHERE tenant_id = $1 AND created_at >= CURRENT_DATE
        ),
        yesterday_orders AS (
          SELECT * FROM orders
          WHERE tenant_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '1 day'
            AND created_at < CURRENT_DATE
        ),
        table_stats AS (
          SELECT
            COUNT(*)::int AS total_tables,
            COUNT(*) FILTER (WHERE status <> 'empty')::int AS active_tables
          FROM tables
          WHERE tenant_id = $1
        ),
        staff_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE is_active = true AND role <> 'owner')::int AS active_staff,
            COUNT(*) FILTER (WHERE is_active = false AND role <> 'owner')::int AS inactive_staff
          FROM users
          WHERE tenant_id = $1
        )
       SELECT
        COALESCE((SELECT SUM(total) FROM today_orders), 0)::int AS revenue_today,
        COALESCE((SELECT SUM(total) FROM yesterday_orders), 0)::int AS revenue_yesterday,
        (SELECT COUNT(*) FROM today_orders)::int AS orders_today,
        (SELECT COUNT(*) FROM yesterday_orders)::int AS orders_yesterday,
        table_stats.total_tables,
        table_stats.active_tables,
        staff_stats.active_staff,
        staff_stats.inactive_staff
       FROM table_stats, staff_stats`,
      [tenantId]
    )

    const revenueRows = await queryAll(
      `SELECT
        days.day::date AS date,
        COALESCE(SUM(o.total), 0)::int AS revenue
       FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS days(day)
       LEFT JOIN orders o
         ON o.tenant_id = $1
        AND o.created_at >= days.day
        AND o.created_at < days.day + INTERVAL '1 day'
       GROUP BY days.day
       ORDER BY days.day`,
      [tenantId]
    )

    const topDishes = await queryAll(
      `SELECT
        oi.name,
        SUM(oi.quantity)::int AS count,
        SUM(oi.price * oi.quantity)::int AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.tenant_id = $1
         AND o.created_at >= CURRENT_DATE
       GROUP BY oi.name
       ORDER BY count DESC, revenue DESC
       LIMIT 5`,
      [tenantId]
    )

    const recentOrders = await queryAll(
      `SELECT
        o.id,
        o.table_id,
        t.name AS table_name,
        o.status,
        o.total,
        o.created_at,
        COUNT(oi.id)::int AS item_count,
        COALESCE(SUM(oi.quantity), 0)::int AS quantity_count
       FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tenant_id = $1
       GROUP BY o.id, t.name
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [tenantId]
    )

    const totalTables = stats.total_tables || 0
    const activeTables = stats.active_tables || 0

    res.json({
      generatedAt: new Date().toISOString(),
      stats: {
        revenueToday: stats.revenue_today || 0,
        revenueChangePercent: pctChange(stats.revenue_today || 0, stats.revenue_yesterday || 0),
        activeTables,
        totalTables,
        tableOccupancyPercent: totalTables ? Math.round((activeTables / totalTables) * 100) : 0,
        ordersToday: stats.orders_today || 0,
        ordersChange: (stats.orders_today || 0) - (stats.orders_yesterday || 0),
        activeStaff: stats.active_staff || 0,
        inactiveStaff: stats.inactive_staff || 0,
      },
      revenue: revenueRows.map((row) => ({
        date: row.date,
        value: row.revenue,
      })),
      topDishes,
      recentOrders,
    })
  } catch (err) {
    console.error('[Dashboard] Summary error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
