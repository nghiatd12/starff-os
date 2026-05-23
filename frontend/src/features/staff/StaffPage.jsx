import { useState } from 'react'
import { Plus } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import EmployeeTable from './components/EmployeeTable'

const ROLES = [
  { value: 'manager', label: 'Quản lý' },
  { value: 'waiter',  label: 'Phục vụ' },
  { value: 'cashier', label: 'Thu ngân' },
  { value: 'kitchen', label: 'Bếp' },
]

export default function StaffPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  function handleAdded() {
    setShowAdd(false)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="p-6 lg:p-8 fade-in h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Nhân viên</h1>
          <p className="text-slate-400 text-sm mt-1">Quản lý nhân sự của quán</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#10b981' }}
        >
          <Plus size={16} />
          Thêm nhân viên
        </button>
      </div>

      <EmployeeTable key={refreshKey} />

      {showAdd && (
        <AddEmployeeModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />
      )}
    </div>
  )
}

// ─── Modal thêm nhân viên ────────────────────────────────────────────────────

function AddEmployeeModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', phone: '', role: 'waiter', pin: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Vui lòng nhập đầy đủ tên và số điện thoại')
      return
    }
    setLoading(true)
    try {
      await api.post('/staff', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        pin: form.pin.trim() || undefined,
        password: form.password.trim() || undefined,
      })
      onAdded()
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-5">Thêm nhân viên mới</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tên */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Họ và tên *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>

          {/* Số điện thoại */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Số điện thoại *</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="09xxxxxxxx"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>

          {/* Vai trò */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Vai trò *</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              PIN đăng nhập nhanh <span className="text-slate-400 font-normal">(tuỳ chọn)</span>
            </label>
            <input
              name="pin"
              value={form.pin}
              onChange={handleChange}
              placeholder="4-6 chữ số"
              maxLength={6}
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Mật khẩu <span className="text-slate-400 font-normal">(mặc định: 123456)</span>
            </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Để trống dùng mặc định"
              className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#10b981' }}
            >
              {loading ? 'Đang thêm...' : 'Thêm nhân viên'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
