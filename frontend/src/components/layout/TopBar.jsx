import { NAV_ITEMS } from '@/constants/navigation'
import { Search, Bell } from '@/components/ui/Icon'

export default function TopBar({ activeScreen, user }) {
  const current = NAV_ITEMS.find((item) => item.id === activeScreen)

  return (
    <header className="glass border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
      <div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">
          {current?.label ?? 'Dashboard'}
        </h1>
      </div>

      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm đơn hàng, bàn, nhân viên..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Hoạt động
        </div>

        <button className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors" aria-label="Thông báo">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
            3
          </span>
        </button>

        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-100">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-700">{user?.name || 'Người dùng'}</p>
            <p className="text-[10px] text-slate-400">{user?.role || 'Chủ quán'}</p>
          </div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity" style={{ backgroundColor: '#10b981' }}>
            {user?.name?.[0] || 'U'}
          </div>
        </div>
      </div>
    </header>
  )
}
