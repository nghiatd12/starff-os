import { useEffect, useMemo, useState } from 'react'
import StatCard from './components/StatCard'
import RevenueChart from './components/RevenueChart'
import TopDishes from './components/TopDishes'
import RecentOrders from './components/RecentOrders'
import { api } from '@/lib/api'
import { formatCurrency } from '@/utils/format'

const EMPTY_DASHBOARD = {
  stats: {
    revenueToday: 0,
    revenueChangePercent: 0,
    activeTables: 0,
    totalTables: 0,
    tableOccupancyPercent: 0,
    ordersToday: 0,
    ordersChange: 0,
    activeStaff: 0,
    inactiveStaff: 0,
  },
  revenue: [],
  topDishes: [],
  recentOrders: [],
}

function formatDateLabel(value = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatPercentTrend(value) {
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : ''}${value}%`
}

function sameLocalDay(value, target = new Date()) {
  const date = new Date(value)
  return date.getFullYear() === target.getFullYear()
    && date.getMonth() === target.getMonth()
    && date.getDate() === target.getDate()
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return date
  })
}

function buildFallbackDashboard({ tables = [], staff = [], orders = [] }) {
  const todayOrders = orders.filter((order) => sameLocalDay(order.created_at))
  const revenueToday = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  const activeTables = tables.filter((table) => table.status !== 'empty').length
  const totalTables = tables.length
  const activeStaff = staff.filter((employee) => employee.is_active).length
  const inactiveStaff = staff.filter((employee) => !employee.is_active).length

  const revenue = lastSevenDays().map((date) => ({
    date: date.toISOString(),
    value: orders
      .filter((order) => sameLocalDay(order.created_at, date))
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
  }))

  const dishMap = new Map()
  for (const order of todayOrders) {
    for (const item of order.items || []) {
      const quantity = Number(item.quantity || item.qty || 1)
      const current = dishMap.get(item.name) || { name: item.name, count: 0, revenue: 0 }
      current.count += quantity
      current.revenue += Number(item.price || 0) * quantity
      dishMap.set(item.name, current)
    }
  }

  return {
    stats: {
      revenueToday,
      revenueChangePercent: 0,
      activeTables,
      totalTables,
      tableOccupancyPercent: totalTables ? Math.round((activeTables / totalTables) * 100) : 0,
      ordersToday: todayOrders.length,
      ordersChange: 0,
      activeStaff,
      inactiveStaff,
    },
    revenue,
    topDishes: [...dishMap.values()]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5),
    recentOrders: [...orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map((order) => ({
        ...order,
        quantity_count: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || item.qty || 1), 0),
      })),
  }
}

async function loadFallbackDashboard() {
  const [tablesRes, staffRes, ordersRes] = await Promise.all([
    api.get('/tables').catch(() => ({ tables: [] })),
    api.get('/staff').catch(() => ({ employees: [] })),
    api.get('/orders/active').catch(() => ({ orders: [] })),
  ])

  return buildFallbackDashboard({
    tables: tablesRes.tables || [],
    staff: Array.isArray(staffRes) ? staffRes : staffRes.employees || staffRes.rows || [],
    orders: ordersRes.orders || [],
  })
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    setError('')
    try {
      let data
      try {
        data = await api.get('/dashboard/summary')
      } catch (dashboardErr) {
        data = await loadFallbackDashboard()
      }
      setDashboard({
        stats: { ...EMPTY_DASHBOARD.stats, ...(data.stats || {}) },
        revenue: data.revenue || [],
        topDishes: data.topDishes || [],
        recentOrders: data.recentOrders || [],
      })
    } catch (err) {
      setError(err.message || 'Không thể tải dashboard')
      setDashboard(EMPTY_DASHBOARD)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  const stats = dashboard.stats
  const staffTrend = stats.inactiveStaff > 0 ? `${stats.inactiveStaff} nghỉ` : 'Đủ nhân sự'
  const orderTrend = stats.ordersChange === 0
    ? 'Không đổi'
    : `${stats.ordersChange > 0 ? '+' : ''}${stats.ordersChange} đơn`

  const dateLabel = useMemo(() => formatDateLabel(), [])

  return (
    <div className="p-6 lg:p-8 fade-in overflow-y-auto h-full">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-slate-400 text-sm">Dữ liệu hoạt động hôm nay — {dateLabel}</p>
          {error && (
            <button
              onClick={loadDashboard}
              className="mt-2 text-xs font-semibold text-red-600 bg-red-50 rounded-xl px-3 py-1.5 hover:bg-red-100"
            >
              {error} · Thử lại
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 rounded-xl text-xs font-medium text-brand-700">
            <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            Realtime
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          label="Doanh thu hôm nay"
          value={loading ? '...' : formatCurrency(stats.revenueToday)}
          trend={loading ? '' : formatPercentTrend(stats.revenueChangePercent)}
          trendUp={stats.revenueChangePercent > 0 ? true : stats.revenueChangePercent < 0 ? false : null}
          icon="💰"
          iconBg="bg-brand-50"
        />
        <StatCard
          label="Bàn đang phục vụ"
          value={loading ? '...' : `${stats.activeTables}/${stats.totalTables}`}
          trend={loading ? '' : `${stats.tableOccupancyPercent}% công suất`}
          trendUp={null}
          icon="🪑"
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Đơn hàng hôm nay"
          value={loading ? '...' : stats.ordersToday}
          trend={loading ? '' : orderTrend}
          trendUp={stats.ordersChange > 0 ? true : stats.ordersChange < 0 ? false : null}
          icon="📋"
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Nhân viên hoạt động"
          value={loading ? '...' : stats.activeStaff}
          trend={loading ? '' : staffTrend}
          trendUp={stats.inactiveStaff > 0 ? false : null}
          icon="👥"
          iconBg="bg-purple-50"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <div className="lg:col-span-2">
          <RevenueChart data={dashboard.revenue} loading={loading} />
        </div>
        <TopDishes dishes={dashboard.topDishes} loading={loading} />
      </div>

      {/* Recent Orders */}
      <RecentOrders orders={dashboard.recentOrders} loading={loading} />
    </div>
  )
}
