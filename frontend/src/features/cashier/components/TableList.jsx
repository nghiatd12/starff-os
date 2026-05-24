import { formatCurrency } from '@/utils/format'
import { Clock, MapPin, Users } from '@/components/ui/Icon'
import Badge from '@/components/ui/Badge'

const ZONE_LABELS = {
  indoor: 'Trong nhà',
  outdoor: 'Ngoài trời',
  vip: 'Phòng VIP',
}

const formatElapsed = (createdAt) => {
  if (!createdAt) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins ? `${hours}h ${mins}p` : `${hours}h`
}

/**
 * TableList - danh sách bàn có hóa đơn, lấy từ order chưa thanh toán.
 */
export default function TableList({ tables, orders, selectedId, onSelect }) {
  const getBillingStatus = (tableOrders) => {
    const hasReadyOrder = tableOrders.some((order) => order.status === 'ready')
    if (hasReadyOrder) return { label: 'Chờ thanh toán', variant: 'warning' }
    return { label: 'Có khách', variant: 'success' }
  }

  return (
    <div className="w-72 bg-white border-r border-slate-100 flex flex-col">
      <div className="p-5 border-b border-slate-100 flex-shrink-0">
        <p className="text-xs text-slate-400">{tables.length} bàn có hóa đơn</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tables.length === 0 ? (
          <div className="p-5 text-center">
            <p className="text-slate-400 text-sm">Không có dữ liệu</p>
          </div>
        ) : (
          tables.map((table) => {
            const tableOrders = orders.filter((order) => order.table_id === table.id)
            const allItems = tableOrders.flatMap((order) => order.items || [])
            const total = allItems.reduce((sum, item) => sum + item.price * (item.qty || item.quantity || 1), 0)
            const guestCount = tableOrders.reduce((sum, order) => sum + (Number(order.guest_count) || 0), 0)
            const elapsed = formatElapsed(tableOrders[0]?.created_at)
            const billingStatus = getBillingStatus(tableOrders)
            const zoneLabel = ZONE_LABELS[table.zone] || table.zone || 'Chưa có khu vực'
            const isSelected = selectedId === table.id

            return (
              <button
                key={table.id}
                onClick={() => onSelect(table)}
                className={`w-full p-4 text-left border-b border-slate-50 transition-all
                  ${isSelected
                    ? 'bg-brand-50 border-l-[3px] border-l-brand-500'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-slate-800 text-sm">{table.name}</span>
                    <div className="mt-1 flex w-fit items-center gap-1 rounded-xl bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-500">
                      <MapPin size={10} />
                      {zoneLabel}
                    </div>
                  </div>
                  <Badge variant={billingStatus.variant} dot>
                    {billingStatus.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {guestCount || 1} khách
                  </span>
                  {elapsed && (
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {elapsed}
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <div className="text-sm font-bold text-brand-600 mt-2">
                    {formatCurrency(total)}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
