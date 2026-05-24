import { formatCurrency } from '@/utils/format'
import { X, Heart, CalendarDays, Star, Users } from '@/components/ui/Icon'

const TIER_CONFIG = {
  'Bạch Kim': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', discount: '10%' },
  'Vàng':     { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100',  discount: '5%' },
  'Bạc':      { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  discount: '3%' },
  'Đồng':     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', discount: '0%' },
}

export default function CustomerDetail({ customer, onClose }) {
  const tier = TIER_CONFIG[customer.tier] || TIER_CONFIG['Đồng']
  const initial = customer.name.split(' ').pop()?.[0] || 'K'

  return (
    <div className="w-80 bg-white border-l border-slate-100 flex flex-col">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <h3 className="font-bold text-slate-800">Chi tiết khách hàng</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {/* Profile */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-xl mx-auto">
            {initial}
          </div>
          <h4 className="font-bold text-slate-800 mt-3 text-base">{customer.name}</h4>
          <p className="text-slate-400 text-sm">{customer.phone}</p>
          <span className={`mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border ${tier.bg} ${tier.text} ${tier.border}`}>
            {customer.tier} · Giảm {tier.discount}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-emerald-600">{customer.points.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Điểm tích lũy</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-slate-800">{customer.visits}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Lần ghé thăm</p>
          </div>
        </div>

        {/* Info list */}
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Heart size={14} className="text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">Tổng chi tiêu</p>
              <p className="text-sm font-bold text-slate-700">{formatCurrency(customer.spent)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <CalendarDays size={14} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">Sinh nhật</p>
              <p className="text-sm font-semibold text-slate-700">{customer.birthday}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Star size={14} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">Lần cuối đến</p>
              <p className="text-sm font-semibold text-slate-700">{customer.lastVisit}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Users size={14} className="text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">Giới thiệu bạn</p>
              <p className="text-sm font-semibold text-slate-700">{customer.referrals || 0} người</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
