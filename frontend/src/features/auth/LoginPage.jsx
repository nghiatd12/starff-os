import { useState } from 'react'
import Card from '@/components/ui/Card'
import { Store, ChevronRight } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import { setRefreshToken, setToken, setUser } from '@/lib/auth'

const ROLES = [
  { id: 'owner',    label: 'Chủ quán' },
  { id: 'manager',  label: 'Quản lý' },
  { id: 'cashier',  label: 'Thu ngân' },
  { id: 'waiter',   label: 'Phục vụ' },
  { id: 'kitchen',  label: 'Bếp' },
]

export default function LoginPage({ onLogin, onNavigate }) {
  const [form, setForm] = useState({ phone: '', password: '', role: 'owner' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validation cơ bản
    if (!form.phone.trim()) {
      setError('Vui lòng nhập số điện thoại')
      return
    }
    if (!form.password.trim()) {
      setError('Vui lòng nhập mật khẩu')
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await api.post('/auth/login', {
        phone: form.phone,
        password: form.password,
      })
      setToken(data.token)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user)
      onLogin(data.user)
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: '#10b981' }}
          >
            <Store size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">StaffOS</h1>
          <p className="text-sm text-slate-400 mt-1">Đăng nhập để quản lý quán</p>
        </div>

        {/* Login Card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                placeholder="0901 234 567"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Đăng nhập với vai trò
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, role: role.id }))}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                      form.role === role.id
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#10b981' }}
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              {!loading && <ChevronRight size={16} />}
            </button>
          </form>

          {/* Links */}
          <div className="mt-5 text-center space-y-2">
            <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              Quên mật khẩu?
            </button>
            <p className="text-sm text-slate-400">
              Chưa có quán trên StaffOS?{' '}
              <button
                onClick={() => onNavigate?.('register')}
                className="text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                Đăng ký quán mới
              </button>
            </p>
          </div>
        </Card>

        {/* Explanation */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs font-semibold text-slate-600 mb-2">💡 Cách đăng nhập:</p>
          <ul className="text-xs text-slate-400 space-y-1">
            <li>• <strong>Chủ quán</strong>: Dùng SĐT đăng ký quán → toàn quyền</li>
            <li>• <strong>Nhân viên</strong>: Dùng SĐT + mã PIN do chủ quán cấp</li>
            <li>• Mỗi vai trò sẽ thấy giao diện khác nhau</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
