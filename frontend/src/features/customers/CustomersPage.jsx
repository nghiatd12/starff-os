import { useEffect, useMemo, useState } from 'react'
import CustomerDetail from './components/CustomerDetail'
import { Search, Plus, Users, Heart } from '@/components/ui/Icon'
import Card from '@/components/ui/Card'
import { api } from '@/lib/api'
import { formatCurrency } from '@/utils/format'

const TIER_CONFIG = {
  'Bạch Kim': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
  'Vàng': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  'Bạc': { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  'Đồng': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
}

const DEFAULT_TIER = TIER_CONFIG['Đồng']

function normalizeCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name || 'Khách chưa đặt tên',
    phone: customer.phone || '',
    tier: customer.tier || 'Đồng',
    points: Number(customer.points || 0),
    spent: Number(customer.total_spent || customer.spent || 0),
    visits: Number(customer.visit_count || customer.visits || 0),
    birthday: customer.birthday || 'Chưa có',
    lastVisit: customer.last_visit
      ? new Intl.DateTimeFormat('vi-VN').format(new Date(customer.last_visit))
      : 'Chưa có',
    referrals: Number(customer.referrals || 0),
  }
}

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    api.get('/customers')
      .then((data) => {
        if (!active) return
        const rows = (data.customers || []).map(normalizeCustomer)
        setCustomers(rows)
        setSelectedCustomer((current) => rows.find((item) => item.id === current?.id) || null)
        setError('')
      })
      .catch((err) => {
        if (!active) return
        setCustomers([])
        setError(err.message || 'Không tải được khách hàng')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return customers
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(keyword) ||
      customer.phone.includes(keyword)
    )
  }, [customers, search])

  const totalSpent = customers.reduce((sum, customer) => sum + customer.spent, 0)
  const totalVisits = customers.reduce((sum, customer) => sum + customer.visits, 0)

  return (
    <div className="flex h-full fade-in">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-5 lg:p-6 border-b border-slate-100 bg-white flex-shrink-0 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-xs text-slate-400">
              {customers.length} khách hàng · {totalVisits} lần ghé · {formatCurrency(totalSpent)}
            </p>
            <button
              className="flex w-fit items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400"
              disabled
              title="Chức năng thêm khách sẽ được bật khi có form khách hàng."
            >
              <Plus size={16} />
              Thêm khách
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4 flex items-center gap-3 rounded-2xl shadow-none">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{customers.length}</p>
                <p className="text-xs text-slate-400">Tổng khách</p>
              </div>
            </Card>
            <Card className="p-4 flex items-center gap-3 rounded-2xl shadow-none">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Heart size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{totalVisits}</p>
                <p className="text-xs text-slate-400">Lượt ghé</p>
              </div>
            </Card>
            <Card className="p-4 rounded-2xl shadow-none">
              <p className="text-lg font-bold text-slate-800">{formatCurrency(totalSpent)}</p>
              <p className="text-xs text-slate-400">Tổng chi tiêu</p>
            </Card>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc số điện thoại..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 bg-slate-50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-slate-400 text-sm">Đang tải khách hàng...</p>
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center">
              <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
                  <Users size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Chưa có khách hàng</p>
                <p className="mt-1 text-xs text-slate-400">Dữ liệu sẽ hiển thị khi có khách hàng được lưu vào hệ thống.</p>
              </div>
            </div>
          ) : (
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
                {filtered.map((customer) => {
                  const tier = TIER_CONFIG[customer.tier] || DEFAULT_TIER
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors table-row-hover ${
                        selectedCustomer?.id === customer.id ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm">
                            {customer.name.split(' ').pop()?.[0] || 'K'}
                          </div>
                          <div>
                            <p className="font-medium text-slate-700 text-sm">{customer.name}</p>
                            <p className="text-[11px] text-slate-400">{customer.phone || 'Chưa có SĐT'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${tier.bg} ${tier.text} ${tier.border}`}>
                          {customer.tier}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-700">{customer.points.toLocaleString('vi-VN')}</td>
                      <td className="p-4 text-sm text-slate-600">{formatCurrency(customer.spent)}</td>
                      <td className="p-4 text-sm text-slate-500">{customer.visits} lần</td>
                      <td className="p-4 text-sm text-slate-500">{customer.birthday}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedCustomer && (
        <CustomerDetail
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  )
}
