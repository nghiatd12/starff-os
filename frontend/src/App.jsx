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

const RESERVED_PATHS = new Set(['menu', 'login', 'register'])

function parseAppPath() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const first = parts[0] || ''
  const second = parts[1] || ''
  const hashScreen = window.location.hash.replace(/^#\/?/, '')

  if (SCREENS[hashScreen]) {
    return {
      storeSlug: RESERVED_PATHS.has(first) ? '' : first,
      screen: hashScreen,
      shouldReplaceHash: true,
    }
  }

  if (SCREENS[first]) {
    return {
      storeSlug: '',
      screen: first,
      shouldReplaceHash: false,
    }
  }

  if (first && !RESERVED_PATHS.has(first)) {
    return {
      storeSlug: first,
      screen: SCREENS[second] ? second : 'dashboard',
      shouldReplaceHash: false,
    }
  }

  return {
    storeSlug: '',
    screen: SCREENS[first] ? first : 'dashboard',
    shouldReplaceHash: false,
  }
}

function buildAppPath(storeSlug, screen) {
  return storeSlug ? `/${storeSlug}/${screen}` : `/${screen}`
}

export default function App() {
  const [currentView, setCurrentView] = useState('loading')
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState(parseAppPath)
  const [activeScreen, setActiveScreenState] = useState(() => parseAppPath().screen)
  const [storeSlug, setStoreSlug] = useState(() => parseAppPath().storeSlug)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [audioReady, setAudioReady] = useState(false)

  const setActiveScreen = (screen) => {
    if (!SCREENS[screen]) return
    setActiveScreenState(screen)
    const nextPath = buildAppPath(storeSlug || user?.storeSlug || user?.store_slug, screen)
    if (window.location.pathname !== nextPath || window.location.hash) {
      window.history.pushState(null, '', nextPath)
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

  useEffect(() => {
    if (route.shouldReplaceHash) {
      const nextPath = buildAppPath(route.storeSlug, route.screen)
      window.history.replaceState(null, '', nextPath)
      setStoreSlug(route.storeSlug)
      setActiveScreenState(route.screen)
    }
  }, [route])

  // Check token on mount. Use cached user first so backend cold starts do not block the shell UI.
  useEffect(() => {
    const token = getToken()
    const refreshToken = getRefreshToken()
    const cachedUser = getUser()
    if (!token && !refreshToken) {
      setCurrentView('login')
      return
    }

    const startApp = (userData) => {
      setUser(userData)
      const nextSlug = route.storeSlug || userData.storeSlug || userData.store_slug
      setStoreSlug(nextSlug || '')
      if (nextSlug && !window.location.pathname.startsWith(`/${nextSlug}/`)) {
        window.history.replaceState(null, '', buildAppPath(nextSlug, activeScreen))
      }
      setCurrentView('app')
      const socket = connectSocket(userData.role)
      bindSocketToStore(socket)
      bindGlobalNotifications(socket)
    }

    const cachedUserSlug = cachedUser?.storeSlug || cachedUser?.store_slug
    const canUseCachedUser = cachedUser && (!route.storeSlug || cachedUserSlug === route.storeSlug)

    if (canUseCachedUser) {
      startApp(cachedUser)
      prefetchAll().catch(() => {})
    }

    api.get('/auth/me')
      .then((data) => {
        const userData = data.user
        const userSlug = userData.storeSlug || userData.store_slug
        if (route.storeSlug && userSlug !== route.storeSlug) {
          clearAuth()
          clearStore()
          disconnectSocket()
          setCurrentView('login')
          return
        }

        saveUser(userData)
        setUser(userData)
        if (!canUseCachedUser) {
          startApp(userData)
          prefetchAll().catch(() => {})
        }
      })
      .catch(() => {
        clearAuth()
        clearStore()
        disconnectSocket()
        setCurrentView('login')
      })
  }, [])

  useEffect(() => {
    const handleLocationChange = () => {
      const nextRoute = parseAppPath()
      setRoute(nextRoute)
      setStoreSlug(nextRoute.storeSlug)
      setActiveScreenState(nextRoute.screen)
    }
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener('hashchange', handleLocationChange)
    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener('hashchange', handleLocationChange)
    }
  }, [])

  const handleLogin = async (userData) => {
    setUser(userData)
    const nextSlug = route.storeSlug || userData.storeSlug || userData.store_slug
    setStoreSlug(nextSlug || '')
    if (nextSlug) {
      window.history.replaceState(null, '', buildAppPath(nextSlug, activeScreen))
    }
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
    return <LoginPage storeSlug={storeSlug || route.storeSlug} onLogin={handleLogin} onNavigate={(v) => setCurrentView(v)} />
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
