import { useEffect, useMemo, useState } from 'react'
import { Plus } from '@/components/ui/Icon'
import { useTables } from '@/lib/useStore'
import { api } from '@/lib/api'
import TableCard from './components/TableCard'
import TableSidePanel from './components/TableSidePanel'

const TABLE_STATUS_CONFIG = {
  empty: {
    label: 'Trống',
    dot: 'bg-slate-300',
  },
  occupied: {
    label: 'Có khách',
    dot: 'bg-emerald-500',
  },
  waiting: {
    label: 'Chờ thanh toán',
    dot: 'bg-amber-500',
  },
  reserved: {
    label: 'Đặt trước',
    dot: 'bg-blue-500',
  },
}

const zones = [
  { id: 'all', name: 'Tất cả' },
  { id: 'indoor', name: 'Trong nhà' },
  { id: 'outdoor', name: 'Ngoài trời' },
  { id: 'vip', name: 'Phòng VIP' },
]

export default function TablesPage({ setActive }) {
  const { tables, loading } = useTables()
  const [billingOrders, setBillingOrders] = useState([])
  const [now, setNow] = useState(new Date())
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeZone, setActiveZone] = useState('all')

  useEffect(() => {
    let active = true
    const loadBillingOrders = () => {
      api.get('/orders/billing')
        .then((data) => {
          if (active) setBillingOrders(data.orders || [])
        })
        .catch(() => {
          if (active) setBillingOrders([])
        })
    }

    loadBillingOrders()
    const interval = setInterval(loadBillingOrders, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const displayTables = useMemo(() => {
    return tables.map((table) => {
      const tableOrders = billingOrders.filter((order) => order.table_id === table.id)
      if (tableOrders.length === 0) {
        return {
          ...table,
          status: 'empty',
          orders: [],
          items: [],
          guests: 0,
          elapsedMinutes: 0,
          firstOrderAt: null,
        }
      }

      const firstOrder = tableOrders[0]
      const firstOrderAt = firstOrder?.created_at ? new Date(firstOrder.created_at) : null
      const elapsedMinutes = firstOrderAt
        ? Math.max(0, Math.floor((now.getTime() - firstOrderAt.getTime()) / 60000))
        : 0

      return {
        ...table,
        status: tableOrders.some((order) => order.status === 'ready') ? 'waiting' : 'occupied',
        orders: tableOrders,
        items: tableOrders.flatMap((order) => order.items || []),
        guests: tableOrders.reduce((sum, order) => sum + (Number(order.guest_count) || 0), 0),
        elapsedMinutes,
        firstOrderAt,
      }
    })
  }, [billingOrders, now, tables])

  useEffect(() => {
    setSelectedTable((current) => {
      if (!current) return current
      return displayTables.find((table) => table.id === current.id) || current
    })
  }, [displayTables])

  const filteredTables = activeZone === 'all'
    ? displayTables
    : displayTables.filter((table) => table.zone === activeZone)

  const counts = displayTables.reduce((acc, table) => {
    acc[table.status] = (acc[table.status] || 0) + 1
    return acc
  }, {})

  const zoneCounts = displayTables.reduce((acc, table) => {
    acc[table.zone] = (acc[table.zone] || 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="p-6 lg:p-8 fade-in h-full flex items-center justify-center">
        <p className="text-slate-400 text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 fade-in h-full overflow-hidden flex flex-col">
      <div className="mb-5 flex items-end justify-between flex-shrink-0">
        <div>
          <p className="text-slate-400 text-sm">
            Quản lý {displayTables.length} bàn · {zones.length - 1} khu vực
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white transition-all"
          style={{ backgroundColor: '#10b981' }}
        >
          <Plus size={16} />
          Thêm bàn
        </button>
      </div>

      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex gap-2">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setActiveZone(zone.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeZone === zone.id
                  ? 'text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'
              }`}
              style={activeZone === zone.id ? { backgroundColor: '#10b981' } : {}}
            >
              {zone.name}
              {zone.id !== 'all' && zoneCounts[zone.id] && (
                <span className={`ml-1.5 text-xs ${activeZone === zone.id ? 'text-white/70' : 'text-slate-400'}`}>
                  ({zoneCounts[zone.id]})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex gap-3">
          {Object.entries(TABLE_STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs text-slate-500">{cfg.label}</span>
              <span className="text-xs font-bold text-slate-700">{counts[key] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto pr-2">
          {filteredTables.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400 text-sm">Không có dữ liệu</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  isSelected={selectedTable?.id === table.id}
                  onClick={() => setSelectedTable(table)}
                />
              ))}
            </div>
          )}
        </div>

        {selectedTable && (
          <div className="flex-shrink-0">
            <TableSidePanel
              table={selectedTable}
              onClose={() => setSelectedTable(null)}
              onOrder={() => setActive('order')}
              onCashier={() => setActive('cashier')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
