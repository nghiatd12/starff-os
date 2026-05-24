import { useState } from 'react'
import CustomerDetail from './components/CustomerDetail'
import { Search, Plus, Heart } from '@/components/ui/Icon'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

const TIER_CONFIG = {
  'Bạch Kim': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', emoji: '💎', discount: '10%' },
  'Vàng':     { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', emoji: '🥇', discount: '5%' },
  'Bạc':      { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300',   emoji: '🥈', discount: '3%' },
  'Đồng':     { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  emoji: '🥉', discount: '0%' },
}

const customers = [
  { id: 1, name: 'Nguyễn Minh Tuấn', phone: '0901111222', tier: 'Bạch Kim', points: 12500, lastVisit: '2024-01-15', spent: 8500000,  birthday: '15/03', visits: 48, referrals: 3 },
  { id: 2, name: 'Trần Thị Lan',     phone: '0912222333', tier: 'Vàng',     points: 6800,  lastVisit: '2024-01-14', spent: 4200000,  birthday: '22/07', visits: 28, referrals: 1 },
  { id: 3, name: 'Lê Văn Hùng',      phone: '0923333444', tier: 'Bạc',      points: 3200,  lastVisit: '2024-01-12', spent: 1800000,  birthday: '08/11', visits: 15, referrals: 0 },
  { id: 4, name: 'Phạm Quốc Bảo',    phone: '0934444555', tier: 'Đồng',     points: 850,   lastVisit: '2024-01-10', spent: 650000,   birthday: '30/05', visits: 5,  referrals: 0 },
  { id: 5, name: 'Hoàng Thị Mai',    phone: '0945555666', tier: 'Vàng',     points: 5100,  lastVisit: '2024-01-13', spent: 3100000,  birthday: '14/09', visits: 22, referrals: 2 },
  { id: 6, name: 'Vũ Đức Thành',     phone: '0956666777', tier: 'Bạc',      points: 2700,  lastVisit: '2024-01-11', spent: 1500000,  birthday: '01/12', visits: 12, referrals: 0 },
  { id: 7, name: 'Đặng Thị Thu',     phone: '0967777888', tier: 'Bạch Kim', points: 15200, lastVisit: '2024-01-15', spent: 11000000, birthday: '19/02', visits: 56, referrals: 5 },
  { id: 8, name: 'Bùi Văn Long',     phone: '0978888999', tier: 'Đồng',     points: 420,   lastVisit: '2024-01-08', spent: 320000,   birthday: '25/08', visits: 3,  referrals: 0 },
]

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  )

  // Tier summary
  const tierCounts = customers.reduce((acc, c) => {
    acc[c.tier] = (acc[c.tier] || 0) + 1
    return acc
  }, {})

  return (
    <div className="flex h-full fade-in">
      {/* Left: List */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 lg:p-6 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-400">Loyalty & CRM · {customers.length} khách hàng</p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: '#10b981' }}
            >
              <Plus size={16} />
              Thêm khách
            </button>
          </div>

          {/* Tier summary */}
          <div className="flex gap-3 mb-4">
            {Object.entries(TIER_CONFIG).map(([name, cfg]) => (
              <div key={name} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${cfg.border} ${cfg.bg}`}>
                <span className="text-sm">{cfg.emoji}</span>
                <span className={`text-xs font-semibold ${cfg.text}`}>{tierCounts[name] || 0}</span>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm theo tên, số điện thoại..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 bg-slate-50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="text-[11px] text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                <th className="text-left p-4 font-semibold">Khách hàng</th>
                <th className="text-left p-4 font-semibold">Hạng</th>
                <th className="text-left p-4 font-semibold">Điểm</th>
                <th className="text-left p-4 font-semibold">Tổng chi</th>
                <th className="text-left p-4 font-semibold">Lần ghé</th>
                <th className="text-left p-4 font-semibold">Sinh nhật</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const tier = TIER_CONFIG[c.tier]
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomer(c)}
                    className={`border-b border-slate-50 cursor-pointer transition-colors table-row-hover ${
                      selectedCustomer?.id === c.id ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm">
                          {c.name.split(' ').pop()[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 text-sm">{c.name}</p>
                          <p className="text-[11px] text-slate-400">{c.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${tier.bg} ${tier.text} ${tier.border}`}>
                        {tier.emoji} {c.tier}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-700">
                      {c.points.toLocaleString()}
                    </td>
                    <td className="p-4 text-sm text-slate-600">
                      {c.spent.toLocaleString('vi-VN')}đ
                    </td>
                    <td className="p-4 text-sm text-slate-500">{c.visits} lần</td>
                    <td className="p-4 text-sm text-slate-500">{c.birthday}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Detail */}
      {selectedCustomer && (
        <CustomerDetail
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}
