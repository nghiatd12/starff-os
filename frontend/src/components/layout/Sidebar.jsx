import { NAV_ITEMS } from '@/constants/navigation'
import { filterNavByRole, ROLE_LABELS } from '@/lib/permissions'
import {
  LayoutDashboard, Table2, ClipboardList, ChefHat,
  CreditCard, QrCode, Users, Heart, Settings,
  ChevronLeft, ChevronRight, Store
} from '@/components/ui/Icon'

const ICON_MAP = {
  dashboard: LayoutDashboard,
  tables: Table2,
  order: ClipboardList,
  kitchen: ChefHat,
  cashier: CreditCard,
  'qr-menu': QrCode,
  menu: ClipboardList,
  staff: Users,
  customers: Heart,
  settings: Settings,
}

export default function Sidebar({ active, setActive, collapsed, setCollapsed, user, onLogout }) {
  const navItems = filterNavByRole(NAV_ITEMS, user?.role, user)

  return (
    <aside
      className={`${collapsed ? 'w-[72px]' : 'w-64'} bg-white border-r border-slate-100 flex flex-col h-screen transition-all duration-300 flex-shrink-0 relative`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-100">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#10b981' }}>
              <Store size={18} className="text-white" />
            </div>
            <span className="text-slate-800 font-bold text-base tracking-tight">{user?.store || 'Quán Cậu Út'}</span>
          </div>
        )}
        {collapsed && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto" style={{ backgroundColor: '#10b981' }}>
            <Store size={18} className="text-white" />
          </div>
        )}

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-50"
            aria-label="Thu gọn sidebar"
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-7 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm z-10 transition-colors"
          aria-label="Mở rộng sidebar"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">Menu</p>
        )}
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = active === item.id
            const IconComp = ICON_MAP[item.id]
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative
                  ${isActive
                    ? 'text-emerald-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}
                  ${collapsed ? 'justify-center px-0' : ''}`}
                style={isActive ? { backgroundColor: '#ecfdf5' } : {}}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full" style={{ backgroundColor: '#10b981' }} />
                )}
                {IconComp && <IconComp size={20} className="flex-shrink-0" />}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      {/* User info + Đăng xuất */}
      <div className="px-3 pb-4 border-t border-slate-100 pt-3">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: '#10b981' }}>
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{user?.name || 'Người dùng'}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABELS[user?.role] || user?.role || 'Chủ quán'}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full text-left px-2 py-2 rounded-xl text-xs text-red-500 hover:bg-red-50 transition-colors font-medium"
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 mx-auto hover:bg-red-100 transition-colors"
            title="Đăng xuất"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </aside>
  )
}
