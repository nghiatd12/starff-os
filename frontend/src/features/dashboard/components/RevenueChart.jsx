import Card from '@/components/ui/Card'
import { formatShort } from '@/utils/format'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function getDayLabel(value) {
  const date = new Date(value)
  return DAY_LABELS[date.getDay()]
}

export default function RevenueChart({ data = [], loading = false }) {
  const revenueData = data.map((item) => ({
    day: getDayLabel(item.date),
    value: Number(item.value || 0),
  }))
  const maxVal = Math.max(1, ...revenueData.map((d) => d.value))

  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Doanh thu 7 ngày</h3>
          <p className="text-xs text-slate-400 mt-0.5">Dữ liệu từ các đơn hàng thực tế</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
            <span className="text-xs text-slate-500">Hôm nay</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-200" />
            <span className="text-xs text-slate-500">Các ngày khác</span>
          </div>
        </div>
      </div>

      <div className="flex items-end gap-3 h-44">
        {loading && revenueData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Đang tải...</div>
        ) : revenueData.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">Chưa có doanh thu</div>
        ) : revenueData.map((d, i) => {
          const isToday = i === revenueData.length - 1
          const height = Math.max(8, (d.value / maxVal) * 140)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <span className="text-[11px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatShort(d.value)}
              </span>
              <div className="w-full relative">
                <div
                  className={`w-full rounded-xl transition-all duration-300 group-hover:opacity-80 ${
                    isToday
                      ? 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-md shadow-brand-200'
                      : 'bg-brand-100 group-hover:bg-brand-200'
                  }`}
                  style={{ height: `${height}px` }}
                />
              </div>
              <span className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>
                {d.day}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
