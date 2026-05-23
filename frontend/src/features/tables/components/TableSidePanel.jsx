import { formatCurrency } from '@/utils/format'
import { X, Plus, Users, Clock, UtensilsCrossed } from '@/components/ui/Icon'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

const TABLE_STATUS_CONFIG = {
  empty: {
    label: 'Trống',
    text: 'text-slate-500',
  },
  occupied: {
    label: 'Có khách',
    text: 'text-emerald-700',
  },
  waiting: {
    label: 'Chờ thanh toán',
    text: 'text-amber-700',
  },
  reserved: {
    label: 'Đặt trước',
    text: 'text-blue-700',
  },
}

const statusVariant = {
  empty: 'neutral',
  occupied: 'success',
  waiting: 'warning',
  reserved: 'info',
}

const formatElapsed = (minutes = 0) => {
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hours}h ${mins}p` : `${hours}h`
}

export default function TableSidePanel({ table, onClose, onOrder, onCashier }) {
  const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.empty
  const items = table.items || []
  const total = items.reduce((sum, item) => sum + item.price * (item.qty || item.quantity || 1), 0)
  const hasOrder = table.status !== 'empty'

  return (
    <div className="w-80 h-full bg-white rounded-3xl shadow-card border border-slate-100 flex flex-col overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-slate-800">{table.name}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <Badge variant={statusVariant[table.status] || 'neutral'} dot={hasOrder}>{cfg.label}</Badge>

        {hasOrder && (
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Users size={12} className="text-slate-400" />
              {table.guests || 1} khách
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-slate-400" />
              {formatElapsed(table.elapsedMinutes)}
            </span>
          </div>
        )}
      </div>

      {items.length > 0 ? (
        <>
          <div className="flex-1 p-5 overflow-y-auto min-h-0">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Món đã gọi ({items.length})
            </p>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={`${item.id || item.name}-${index}`} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      x{item.qty || item.quantity || 1} · {formatCurrency(item.price)}/phần
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {formatCurrency(item.price * (item.qty || item.quantity || 1))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-slate-500">Tổng cộng</span>
              <span className="text-lg font-bold text-slate-800">{formatCurrency(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="md" onClick={onOrder}>
                <Plus size={14} />
                Gọi thêm
              </Button>
              <Button size="md" onClick={onCashier}>
                Thanh toán
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mb-4">
            <UtensilsCrossed size={28} className="text-slate-300" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Bàn trống</p>
          <p className="text-slate-400 text-xs mt-1">Chưa có đơn hàng nào</p>
          <Button className="mt-5" size="md" onClick={onOrder}>
            <Plus size={14} />
            Gọi món
          </Button>
        </div>
      )}
    </div>
  )
}
