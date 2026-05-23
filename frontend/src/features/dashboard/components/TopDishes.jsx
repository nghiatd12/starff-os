import Card from '@/components/ui/Card'
import { formatShort } from '@/utils/format'
import { Trophy } from '@/components/ui/Icon'

const RANK_STYLES = [
  'bg-amber-400 text-white',
  'bg-slate-400 text-white',
  'bg-amber-600 text-white',
  'bg-slate-200 text-slate-600',
  'bg-slate-200 text-slate-600',
]

export default function TopDishes({ dishes = [], loading = false }) {
  return (
    <Card className="p-6 h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-slate-800 text-base">Món bán chạy</h3>
          <p className="text-xs text-slate-400 mt-0.5">Top 5 hôm nay từ đơn hàng</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
          <Trophy size={18} className="text-amber-500" />
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Đang tải...</p>
        ) : dishes.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Chưa có món bán trong hôm nay</p>
        ) : dishes.map((d, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${RANK_STYLES[i]}`}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{d.name}</p>
              <p className="text-[11px] text-slate-400">{d.count} phần đã bán</p>
            </div>
            <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
              {formatShort(d.revenue)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
