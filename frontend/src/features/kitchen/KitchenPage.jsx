import { useState, useEffect, useRef } from 'react'
import { ChefHat, Clock } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import { useOrders } from '@/lib/useStore'
import { fetchOrders } from '@/lib/store'
import { notifyNewOrder, unlockAudio } from '@/lib/sound'
import KdsCard from './components/KdsCard'

export default function KitchenPage() {
  const { orders: storeOrders } = useOrders()
  const [orders, setOrders] = useState([])
  const [currentTime, setCurrentTime] = useState(new Date())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevOrderIds = useRef(new Set())
  const initialized = useRef(false)

  // Sync từ store — detect order mới để phát âm thanh
  useEffect(() => {
    if (storeOrders.length > 0 || initialized.current) {
      initialized.current = true

      // Tìm order mới
      if (soundEnabled) {
        const newOrders = storeOrders.filter((o) => !prevOrderIds.current.has(o.id))
        if (newOrders.length > 0) {
          const latest = newOrders[newOrders.length - 1]
          const tableName = latest.table_name || latest.table || `Đơn ${latest.id}`
          notifyNewOrder(tableName)
        }
      }

      prevOrderIds.current = new Set(storeOrders.map((o) => o.id))
      setOrders(storeOrders)
    } else {
      // First load
      fetchOrders().then((data) => {
        setOrders(data)
        prevOrderIds.current = new Set(data.map((o) => o.id))
        initialized.current = true
      })
    }
  }, [storeOrders, soundEnabled])

  // Khi mount: luôn fetch lại từ server để đảm bảo data mới nhất
  useEffect(() => {
    fetchOrders().then((data) => {
      setOrders(data)
      prevOrderIds.current = new Set(data.map((o) => o.id))
      initialized.current = true
    })
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Unlock audio khi user click lần đầu
  useEffect(() => {
    const unlock = () => { unlockAudio(); document.removeEventListener('click', unlock) }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  const toggleItem = async (orderId, itemIdx) => {
    const order = orders.find((o) => o.id === orderId)
    if (!order) return
    const item = order.items[itemIdx]
    if (!item) return

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, items: o.items.map((it, i) => i === itemIdx ? { ...it, done: !it.done } : it) }
          : o
      )
    )
    try {
      const itemId = item.id || itemIdx
      const newStatus = (item.done || item.status === 'done') ? 'pending' : 'done'
      await api.patch(`/orders/${orderId}/items/${itemId}`, { status: newStatus })
    } catch {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, items: o.items.map((it, i) => i === itemIdx ? { ...it, done: !it.done } : it) }
            : o
        )
      )
    }
  }

  const completeOrder = async (orderId) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    try {
      await api.patch(`/orders/${orderId}/complete`)
    } catch {
      api.get('/orders/active').then((data) => setOrders(data.orders || [])).catch(() => {})
    }
  }

  return (
    <div className="h-full flex flex-col fade-in overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ChefHat size={18} className="text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-slate-400 text-xs">{orders.length} đơn đang chờ</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sound toggle */}
          <button
            onClick={() => { unlockAudio(); setSoundEnabled((v) => !v) }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              soundEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-400'
            }`}
          >
            <span>{soundEnabled ? '🔔' : '🔕'}</span>
            <span className="hidden sm:inline">{soundEnabled ? 'Bật' : 'Tắt'}</span>
          </button>

          {/* Legend — compact */}
          <div className="hidden md:flex items-center gap-2">
            {[
              { color: 'bg-emerald-500', label: '<12p' },
              { color: 'bg-amber-500',   label: '12-20p' },
              { color: 'bg-red-500',     label: '>20p' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-slate-400 text-[11px]">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-100">
            <Clock size={14} className="text-slate-400" />
            <span className="text-slate-700 font-mono text-sm font-bold">
              {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <span className="text-5xl mb-3">✅</span>
            <p className="text-lg font-bold text-slate-700">Tất cả đơn đã xong!</p>
            <p className="text-slate-400 text-sm mt-1">Đang chờ đơn mới...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {orders.map((order) => (
              <KdsCard
                key={order.id}
                order={order}
                onToggleItem={toggleItem}
                onComplete={completeOrder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
