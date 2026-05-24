import { useState, useEffect } from 'react'
import { MoreHorizontal } from '@/components/ui/Icon'
import Avatar from '@/components/ui/Avatar'
import Card from '@/components/ui/Card'
import { api } from '@/lib/api'

const ROLE_COLORS = {
  owner:   'bg-slate-100 text-slate-700',
  manager: 'bg-purple-100 text-purple-700',
  waiter:  'bg-blue-100   text-blue-700',
  cashier: 'bg-green-100  text-green-700',
  kitchen: 'bg-red-100    text-red-700',
}

const ROLE_LABELS = {
  owner:   'Chủ quán',
  manager: 'Quản lý',
  waiter:  'Phục vụ',
  cashier: 'Thu ngân',
  kitchen: 'Bếp',
}

// Tạo màu avatar từ tên
const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-pink-500', 'bg-green-500', 'bg-yellow-500',
  'bg-red-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500',
  'bg-cyan-500', 'bg-rose-500',
]

function getInitials(name = '') {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getColor(id) {
  return AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length]
}

export default function EmployeeTable({ currentUser }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(null) // id của nhân viên đang mở menu

  useEffect(() => {
    fetchEmployees()
  }, [])

  async function fetchEmployees() {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/staff')
      setEmployees(Array.isArray(data) ? data : data.employees || data.rows || [])
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách nhân viên')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(emp) {
    try {
      await api.patch(`/staff/${emp.id}`, { is_active: !emp.is_active })
      setEmployees(list => list.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e))
    } catch (err) {
      alert(err.message || 'Có lỗi xảy ra')
    }
    setMenuOpen(null)
  }

  const canManageEmployee = (emp) => currentUser?.role === 'owner' || emp.role !== 'manager'

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-slate-400 text-sm">Đang tải danh sách nhân viên...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-500 text-sm mb-3">{error}</p>
        <button
          onClick={fetchEmployees}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          Thử lại
        </button>
      </Card>
    )
  }

  if (employees.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-400 text-sm">Chưa có nhân viên nào. Nhấn "Thêm nhân viên" để bắt đầu.</p>
      </Card>
    )
  }

  return (
    <Card>
      <table className="w-full">
        <thead>
          <tr className="text-[11px] text-slate-400 border-b border-slate-100 uppercase tracking-wider">
            <th className="text-left p-4 font-semibold">Nhân viên</th>
            <th className="text-left p-4 font-semibold">Vai trò</th>
            <th className="text-left p-4 font-semibold">Số điện thoại</th>
            <th className="text-left p-4 font-semibold">PIN</th>
            <th className="text-left p-4 font-semibold">Trạng thái</th>
            <th className="text-center p-4 font-semibold">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.id} className="border-b border-slate-50 table-row-hover">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar initials={getInitials(emp.name)} colorClass={getColor(emp.id)} size="sm" />
                  <span className="font-medium text-slate-700 text-sm">{emp.name}</span>
                </div>
              </td>
              <td className="p-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${ROLE_COLORS[emp.role] ?? 'bg-slate-100 text-slate-600'}`}>
                  {ROLE_LABELS[emp.role] ?? emp.role}
                </span>
              </td>
              <td className="p-4 text-sm text-slate-500">{emp.phone}</td>
              <td className="p-4 text-sm text-slate-500">
                {emp.pin ? (
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-lg text-xs">{emp.pin}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${emp.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className={`text-xs font-medium ${emp.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {emp.is_active ? 'Đang làm' : 'Nghỉ'}
                  </span>
                </div>
              </td>
              <td className="p-4 text-center relative">
                <button
                  onClick={() => setMenuOpen(menuOpen === emp.id ? null : emp.id)}
                  disabled={!canManageEmployee(emp)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === emp.id && (
                  <div className="absolute right-4 top-12 z-10 bg-white border border-slate-100 rounded-xl shadow-lg py-1 min-w-[160px]">
                    <button
                      onClick={() => handleToggleActive(emp)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      {emp.is_active ? 'Đánh dấu nghỉ' : 'Kích hoạt lại'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Đóng dropdown khi click ngoài */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />
      )}
    </Card>
  )
}
