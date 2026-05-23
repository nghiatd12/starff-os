import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import { api } from '@/lib/api'
import { clearAuth, getRefreshToken, getToken, getUser, setUser as saveUser } from '@/lib/auth'
import { prefetchAll, clearStore, bindSocketToStore } from '@/lib/store'
import { connectSocket, disconnectSocket } from '@/lib/socket'
import { isAudioUnlocked, playNewOrder, playOrderReady, playStaffCall, unlockAudio } from '@/lib/sound'

// Feature pages
import DashboardPage  from '@/features/dashboard/DashboardPage'
import TablesPage     from '@/features/tables/TablesPage'
import OrderPage      from '@/features/order/OrderPage'
import KitchenPage    from '@/features/kitchen/KitchenPage'
import CashierPage    from '@/features/cashier/CashierPage'
import QrMenuPage     from '@/features/qr-menu/QrMenuPage'
import MenuSettings   from '@/features/settings/MenuSettings'
import StaffPage      from '@/features/staff/StaffPage'
import CustomersPage  from '@/features/customers/CustomersPage'
import SettingsPage   from '@/features/settings/SettingsPage'

// Auth pages
import LoginPage    from '@/features/auth/LoginPage'
import RegisterPage from '@/features/auth/RegisterPage'

const SCREENS = {
  dashboard:  DashboardPage,
  tables:     TablesPage,
  order:      OrderPage,
  kitchen:    KitchenPage,
  cashier:    CashierPage,
  'qr-menu':  QrMenuPage,
  menu:       MenuSettings,
  staff:      StaffPage,
  customers:  CustomersPage,
  settings:   SettingsPage,
}

function getScreenFromHash() {
  const screen = window.location.hash.replace(/^#\/?/, '')
  return SCREENS[screen] ? screen : 'dashboard'
}

export default function App() {
  const [currentView, setCurrentView] = useState('loading')
  const [user, setUser] = useState(null)
  const [activeScreen, setActiveScreenState] = useState(getScreenFromHash)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [audioReady, setAudioReady] = useState(false)

  const setActiveScreen = (screen) => {
    if (!SCREENS[screen]) return
    setActiveScreenState(screen)
    if (window.location.hash !== `#${screen}`) {
      window.history.replaceState(null, '', `#${screen}`)
    }
  }

  const enableAudio = () => {
    Promise.resolve(unlockAudio()).then(() => {
      setAudioReady(isAudioUnlocked())
    })
  }

  const pushNotification = (notification) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const item = { id, ...notification }
    setNotifications((prev) => [item, ...prev].slice(0, 4))
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 7000)
  }

  const bindGlobalNotifications = (socket) => {
    if (!socket) return
    if (socket.__staffosGlobalNotificationsBound) return
    socket.__staffosGlobalNotificationsBound = true

    socket.on('new-order', (order) => {
      if (isAudioUnlocked()) playNewOrder()
      pushNotification({
        tone: 'emerald',
        title: 'Order mới',
        message: `${order.table_name || order.table || `Bàn #${order.table_id || order.id}`} vừa gửi món`,
      })
    })

    socket.on('guest-call-staff', (payload) => {
      if (isAudioUnlocked()) playStaffCall()
      pushNotification({
        tone: 'emerald',
        title: 'Khách gọi nhân viên',
        message: `${payload.tableName || 'Một bàn'} cần hỗ trợ`,
      })
    })

    socket.on('guest-request-payment', (payload) => {
      if (isAudioUnlocked()) playOrderReady()
      pushNotification({
        tone: 'amber',
        title: 'Khách gọi thanh toán',
        message: `${payload.tableName || 'Một bàn'} muốn thanh toán`,
      })
    })
  }

  // Check token on mount + prefetch data
  useEffect(() => {
    const token = getToken()
    const refreshToken = getRefreshToken()
    if (!token && !refreshToken) {
      setCurrentView('login')
      return
    }

    // Validate token + prefetch data song song
    Promise.all([
      api.get('/auth/me'),
      prefetchAll(),
    ])
      .then(([data]) => {
        const userData = data.user
        saveUser(userData)
        setUser(userData)
        setCurrentView('app')
        const socket = connectSocket(userData.role)
        bindSocketToStore(socket)
        bindGlobalNotifications(socket)
      })
      .catch(() => {
        clearAuth()
        setCurrentView('login')
      })
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      setActiveScreenState(getScreenFromHash())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleLogin = async (userData) => {
    setUser(userData)
    setCurrentView('app')
    prefetchAll()
    const socket = connectSocket(userData.role)
    bindSocketToStore(socket)
    bindGlobalNotifications(socket)
  }

  const handleLogout = () => {
    clearAuth()
    clearStore()
    disconnectSocket()
    setUser(null)
    setCurrentView('login')
  }

  // Loading
  if (currentView === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl mx-auto mb-3 animate-pulse" style={{ backgroundColor: '#10b981' }} />
          <p className="text-slate-400 text-sm">Đang tải StaffOS...</p>
        </div>
      </div>
    )
  }

  // Auth pages
  if (currentView === 'login') {
    return <LoginPage onLogin={handleLogin} onNavigate={(v) => setCurrentView(v)} />
  }
  if (currentView === 'register') {
    return <RegisterPage onNavigate={(v) => setCurrentView(v)} />
  }

  // Main app
  const Screen = SCREENS[activeScreen] ?? DashboardPage

  return (
    <div
      className="flex h-screen overflow-hidden bg-slate-50"
      onClick={enableAudio}
      onTouchStart={enableAudio}
    >
      <Sidebar
        active={activeScreen}
        setActive={setActiveScreen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        user={user}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-hidden flex flex-col">
        <TopBar activeScreen={activeScreen} user={user} />
        <div className="flex-1 overflow-hidden">
          <Screen setActive={setActiveScreen} />
        </div>
      </main>
      {!audioReady && (
        <button
          onClick={() => {
            Promise.resolve(unlockAudio()).then(() => {
              playStaffCall()
              setAudioReady(isAudioUnlocked())
            })
          }}
          className="fixed bottom-4 right-4 z-50 rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-bold shadow-elevated"
        >
          Bật chuông
        </button>
      )}
      <GlobalNotifications notifications={notifications} />
    </div>
  )
}

function GlobalNotifications({ notifications }) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-[320px] space-y-2">
      {notifications.map((item) => {
        const tone = item.tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'

        return (
          <div
            key={item.id}
            className={`rounded-2xl border p-4 shadow-elevated animate-slide-in ${tone}`}
          >
            <p className="text-sm font-bold">{item.title}</p>
            <p className="text-xs mt-1 opacity-80">{item.message}</p>
          </div>
        )
      })}
    </div>
  )
}
