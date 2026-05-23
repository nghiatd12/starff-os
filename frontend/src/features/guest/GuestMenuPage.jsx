/**
 * GuestMenuPage — Trang QR Menu cho khách
 * URL: /menu/:slug/ban/:tableId
 * Không cần đăng nhập. Khách quét QR → chọn món → gửi order.
 */
import { useState, useEffect, useCallback } from 'react'
import { playOrderReady, playStaffCall } from '@/lib/sound'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(p) {
  return new Intl.NumberFormat('vi-VN').format(p) + 'đ'
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getCategoryLabel(category) {
  const map = {
    'Nhậu chính': 'Món chính',
    'Đồ nhắm': 'Phổ biến',
    'Đồ uống': 'Đồ uống',
    'Thêm': 'Gọi thêm',
  }
  return map[category] || category
}

function getItemImage(item) {
  if (item.imageUrl) return item.imageUrl
  const key = `${item.category} ${item.name}`.toLowerCase()
  if (key.includes('bia') || key.includes('uống') || key.includes('trà') || key.includes('nước')) {
    return 'https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=240&q=80'
  }
  if (key.includes('lẩu')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=240&q=80'
  }
  if (key.includes('gà')) {
    return 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=240&q=80'
  }
  if (key.includes('tôm') || key.includes('mực') || key.includes('cá')) {
    return 'https://images.unsplash.com/photo-1559737558-2f5a35f4523b?auto=format&fit=crop&w=240&q=80'
  }
  if (key.includes('nem') || key.includes('gỏi') || key.includes('salad')) {
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=240&q=80'
  }
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=240&q=80'
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `Lỗi ${res.status}`)
  return data
}

function normalizeMenuResponse(res) {
  const menu = res?.menu && typeof res.menu === 'object' ? res.menu : {}
  const categories = Array.isArray(res?.categories)
    ? res.categories.filter((category) => Array.isArray(menu[category]))
    : Object.keys(menu).filter((category) => Array.isArray(menu[category]))

  return {
    ...res,
    tenant: res?.tenant || { name: 'StaffOS' },
    table: res?.table || { name: 'Bàn' },
    menu,
    categories,
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl mx-auto mb-4 animate-pulse bg-emerald-500" />
        <p className="text-slate-500 text-sm">Đang tải menu...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-xs">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Không tìm thấy</h2>
        <p className="text-slate-500 text-sm">{message}</p>
      </div>
    </div>
  )
}

function SuccessScreen({ total, onReset, onRequestPayment, actionStatus }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-slate-50 flex items-center justify-center p-6">
      <div className="text-center max-w-xs bg-white rounded-[28px] p-6 shadow-xl shadow-emerald-100">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Order đã gửi!</h2>
        <p className="text-slate-500 text-sm mb-1">Bếp đã nhận được order của bạn.</p>
        <p className="text-emerald-600 font-semibold text-lg mb-6">{formatPrice(total)}</p>
        <p className="text-slate-400 text-xs mb-6">Vui lòng chờ nhân viên mang món ra. Cảm ơn bạn! 🍺</p>
        <button
          onClick={onRequestPayment}
          className="w-full py-3 rounded-2xl bg-slate-900 text-white font-semibold text-sm active:scale-95 transition-transform mb-3"
        >
          Gọi thanh toán
        </button>
        {actionStatus && (
          <p className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-2xl px-3 py-2 mb-3">
            {actionStatus}
          </p>
        )}
        <button
          onClick={onReset}
          className="w-full py-3 rounded-2xl bg-emerald-500 text-white font-semibold text-sm active:scale-95 transition-transform"
        >
          Gọi thêm món
        </button>
      </div>
    </div>
  )
}

function CategoryTabs({ categories, active, onSelect }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`shrink-0 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all border ${
            active === cat
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100'
              : 'bg-white text-slate-700 border-slate-200 shadow-sm'
          }`}
        >
          <span className="mr-1.5">{getCategoryEmoji(cat)}</span>
          {getCategoryLabel(cat)}
        </button>
      ))}
    </div>
  )
}

function MenuItem({ item, qty, onAdd, onRemove }) {
  return (
    <div className="flex items-center gap-4 bg-white rounded-3xl p-3 shadow-sm border border-slate-100">
      <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-emerald-50 shrink-0 shadow-sm">
        <img
          src={getItemImage(item)}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {item.price >= 180000 && (
          <span className="absolute top-2 left-2 rounded-full bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5">
            Best Seller
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 self-stretch py-1">
        <p className="font-bold text-slate-900 text-base leading-tight">{item.name}</p>
        {item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
        )}
        {!item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            Món ngon được chuẩn bị tại bếp, phục vụ nóng tại bàn.
          </p>
        )}
        <p className="text-emerald-600 font-black text-base mt-5">{formatPrice(item.price)}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end pb-1">
        {qty > 0 ? (
          <>
            <button
              onClick={() => onRemove(item)}
              className="w-8 h-8 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-lg active:scale-90 transition-transform"
            >
              −
            </button>
            <span className="w-5 text-center font-bold text-slate-900 text-sm">{qty}</span>
          </>
        ) : null}
        <button
          onClick={() => onAdd(item)}
          className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-2xl active:scale-90 transition-transform shadow-lg shadow-emerald-200"
        >
          +
        </button>
      </div>
    </div>
  )
}

function CartSheet({ items, onChangeQty, onChangeNote, onSubmit, submitting, onClose }) {
  const total = items.reduce((s, i) => s + i.price * i.qty, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-5 pb-2 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg">Giỏ hàng</h3>
          <button onClick={onClose} className="text-slate-400 text-sm">Đóng</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-4">
          {items.map((item) => (
            <div key={item.id} className="border border-slate-100 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium text-slate-800 text-sm flex-1 mr-2">{item.name}</p>
                <p className="text-emerald-600 font-semibold text-sm shrink-0">
                  {formatPrice(item.price * item.qty)}
                </p>
              </div>

              {/* Qty */}
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => onChangeQty(item.id, -1)}
                  className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 font-bold active:scale-90 transition-transform"
                >
                  −
                </button>
                <span className="font-bold text-slate-800 text-sm w-4 text-center">{item.qty}</span>
                <button
                  onClick={() => onChangeQty(item.id, 1)}
                  className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold active:scale-90 transition-transform"
                >
                  +
                </button>
                <span className="text-xs text-slate-400 ml-1">{formatPrice(item.price)}/món</span>
              </div>

              {/* Note */}
              <input
                type="text"
                placeholder="Ghi chú (không hành, ít cay...)"
                value={item.note}
                onChange={(e) => onChangeNote(item.id, e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-emerald-400 placeholder-slate-300"
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-600 font-medium">Tổng cộng</span>
            <span className="text-xl font-bold text-slate-800">{formatPrice(total)}</span>
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold text-base active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-200"
          >
            {submitting ? 'Đang gửi...' : `Gửi order — ${formatPrice(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Emoji helper ────────────────────────────────────────────────────────────

function getCategoryEmoji(category) {
  const map = {
    'Nhậu chính': '🍖',
    'Đồ nhắm': '🥗',
    'Đồ uống': '🍺',
    'Thêm': '🍚',
    'Khai vị': '🥟',
    'Tráng miệng': '🍮',
    'Nước ngọt': '🥤',
  }
  return map[category] || '🍽️'
}

function GuestActionBar({ onCallStaff, onRequestPayment, actionStatus }) {
  return (
    <div className="pb-1 bg-white">
      <div className="flex gap-3 overflow-x-auto pb-1">
      <button
        onClick={onCallStaff}
        className="shrink-0 rounded-2xl px-4 py-3 bg-blue-50 border border-blue-100 text-blue-700 active:scale-[0.98] transition-transform"
      >
        <span className="text-sm font-bold">🙋 Gọi nhân viên</span>
      </button>
      <button
        onClick={onRequestPayment}
        className="shrink-0 rounded-2xl px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 active:scale-[0.98] transition-transform"
      >
        <span className="text-sm font-bold">💳 Gọi thanh toán</span>
      </button>
      <button
        onClick={onCallStaff}
        className="shrink-0 rounded-2xl px-4 py-3 bg-yellow-50 border border-yellow-100 text-yellow-700 active:scale-[0.98] transition-transform"
      >
        <span className="text-sm font-bold">🧹 Dọn bàn</span>
      </button>
      </div>
      {actionStatus && (
        <div className="mt-3 rounded-2xl bg-slate-900 text-white px-4 py-2 text-xs font-medium text-center shadow-lg">
          {actionStatus}
        </div>
      )}
    </div>
  )
}

function SelectionHistory({ selectedHistory, orderHistory }) {
  if (selectedHistory.length === 0 && orderHistory.length === 0) return null

  return (
    <div className="px-4 pt-4 space-y-3">
      {selectedHistory.length > 0 && (
        <section className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-800">Món vừa chọn</h2>
            <span className="text-[11px] text-emerald-600 font-semibold">{selectedHistory.length} món</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {selectedHistory.map((item) => (
              <div key={`${item.id}-${item.at}`} className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 min-w-[132px]">
                <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatPrice(item.price)} · {formatTime(item.at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {orderHistory.length > 0 && (
        <section className="bg-emerald-50 rounded-3xl p-4 border border-emerald-100">
          <h2 className="text-sm font-bold text-emerald-800 mb-2">Lịch sử order</h2>
          <div className="space-y-2">
            {orderHistory.slice(0, 2).map((order) => (
              <div key={order.at} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {order.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-400">{formatTime(order.at)}</p>
                </div>
                <span className="text-xs font-bold text-emerald-700 shrink-0 ml-3">
                  {formatPrice(order.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function GuestMenuPage({ slug, tableId }) {
  const [state, setState] = useState('loading') // loading | error | menu | success
  const [errorMsg, setErrorMsg] = useState('')
  const [data, setData] = useState(null) // { tenant, table, menu, categories }

  const [activeCategory, setActiveCategory] = useState('')
  const [cart, setCart] = useState([]) // [{ id, name, price, qty, note, category }]
  const [showCart, setShowCart] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [orderTotal, setOrderTotal] = useState(0)
  const [actionStatus, setActionStatus] = useState('')
  const [selectedHistory, setSelectedHistory] = useState([])
  const [orderHistory, setOrderHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`staffos_guest_orders_${slug}_${tableId}`) || '[]')
    } catch {
      return []
    }
  })

  // Load menu on mount
  useEffect(() => {
    apiFetch(`/public/${slug}/table/${tableId}`)
      .then((res) => {
        const normalized = normalizeMenuResponse(res)
        setData(normalized)
        setActiveCategory(normalized.categories[0] || '')
        setState('menu')
      })
      .catch((err) => {
        setErrorMsg(err.message)
        setState('error')
      })
  }, [slug, tableId])

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, note: '', category: item.category }]
    })
    setSelectedHistory((prev) => [
      { id: item.id, name: item.name, price: item.price, at: new Date().toISOString() },
      ...prev.filter((i) => i.id !== item.id),
    ].slice(0, 8))
  }, [])

  const removeFromCart = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (!existing) return prev
      if (existing.qty === 1) return prev.filter((i) => i.id !== item.id)
      return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty - 1 } : i)
    })
  }, [])

  const changeQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter((i) => i.qty > 0)
    )
  }, [])

  const changeNote = useCallback((id, note) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, note } : i))
  }, [])

  const handleSubmit = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const submittedItems = [...cart]
      const items = cart.map((i) => ({
        menuItemId: i.id,
        name: i.name,
        price: i.price,
        quantity: i.qty,
        note: i.note,
      }))
      const res = await apiFetch(`/public/${slug}/orders`, {
        method: 'POST',
        body: JSON.stringify({ tableId: parseInt(tableId), items }),
      })
      setOrderTotal(res.total)
      const nextOrderHistory = [
        { at: new Date().toISOString(), total: res.total, items: submittedItems },
        ...orderHistory,
      ].slice(0, 5)
      setOrderHistory(nextOrderHistory)
      localStorage.setItem(`staffos_guest_orders_${slug}_${tableId}`, JSON.stringify(nextOrderHistory))
      setCart([])
      setShowCart(false)
      setState('success')
    } catch (err) {
      alert(err.message || 'Gửi order thất bại, vui lòng thử lại')
    } finally {
      setSubmitting(false)
    }
  }

  const showActionStatus = (message) => {
    setActionStatus(message)
    setTimeout(() => setActionStatus(''), 2500)
  }

  const handleCallStaff = async () => {
    try {
      await apiFetch(`/public/${slug}/call-staff`, {
        method: 'POST',
        body: JSON.stringify({ tableId: parseInt(tableId), message: 'Khách cần hỗ trợ' }),
      })
      playStaffCall()
      showActionStatus('Đã gọi nhân viên. Nhân viên sẽ tới ngay.')
    } catch (err) {
      showActionStatus(err.message || 'Chưa gọi được nhân viên, vui lòng thử lại.')
    }
  }

  const handleRequestPayment = async () => {
    try {
      await apiFetch(`/public/${slug}/request-payment`, {
        method: 'POST',
        body: JSON.stringify({
          tableId: parseInt(tableId),
          total: cart.reduce((sum, item) => sum + item.price * item.qty, 0) || orderTotal || 0,
        }),
      })
      playOrderReady()
      showActionStatus('Đã gọi thanh toán. Thu ngân đã nhận thông báo.')
    } catch (err) {
      showActionStatus(err.message || 'Chưa gọi được thanh toán, vui lòng thử lại.')
    }
  }

  const handleReset = () => {
    setState('menu')
    setCart([])
  }

  // ── Render states ──
  if (state === 'loading') return <LoadingScreen />
  if (state === 'error') return <ErrorScreen message={errorMsg} />
  if (state === 'success') {
    return (
      <SuccessScreen
        total={orderTotal}
        onReset={handleReset}
        onRequestPayment={handleRequestPayment}
        actionStatus={actionStatus}
      />
    )
  }

  const { tenant, table, menu, categories } = data
  const currentItems = menu[activeCategory] || []
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.qty, 0)

  const zoneLabel = table.zone === 'indoor' ? 'Trong nhà' : table.zone === 'outdoor' ? 'Ngoài trời' : 'VIP'

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-20 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{tenant.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="rounded-full bg-orange-50 text-orange-600 px-2.5 py-1 text-xs font-bold">
                {table.name}
              </span>
              <span className="text-sm text-slate-500">Chào mừng bạn! 👋</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCallStaff}
              className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-lg"
              aria-label="Gọi nhân viên"
            >
              🔔
            </button>
            <button
              onClick={handleRequestPayment}
              className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-lg"
              aria-label="Gọi thanh toán"
            >
              💳
            </button>
          </div>
        </div>

        <GuestActionBar
          onCallStaff={handleCallStaff}
          onRequestPayment={handleRequestPayment}
          actionStatus={actionStatus}
        />
      </div>

      {/* Category tabs */}
      <div className="px-5 py-4 bg-white border-b border-slate-100 sticky top-[171px] z-10">
        <CategoryTabs
          categories={categories}
          active={activeCategory}
          onSelect={setActiveCategory}
        />
      </div>

      <SelectionHistory selectedHistory={selectedHistory} orderHistory={orderHistory} />

      {/* Menu items */}
      <div className="px-5 pt-4 space-y-4">
        <h2 className="text-sm font-black text-slate-800 px-1">
          {getCategoryEmoji(activeCategory)} {getCategoryLabel(activeCategory)}
        </h2>
        {currentItems.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-10">Không có món trong danh mục này</p>
        ) : (
          currentItems.map((item) => {
            const cartItem = cart.find((i) => i.id === item.id)
            return (
              <MenuItem
                key={item.id}
                item={item}
                qty={cartItem?.qty || 0}
                onAdd={addToCart}
                onRemove={removeFromCart}
              />
            )
          })
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold text-base flex items-center justify-between px-5 shadow-xl shadow-emerald-300 active:scale-95 transition-transform"
          >
            <span className="bg-white text-emerald-600 rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm">
              {cartCount}
            </span>
            <span>Xem giỏ hàng</span>
            <span className="font-semibold">{formatPrice(cartTotal)}</span>
          </button>
        </div>
      )}

      {/* Cart sheet */}
      {showCart && (
        <CartSheet
          items={cart}
          onChangeQty={changeQty}
          onChangeNote={changeNote}
          onSubmit={handleSubmit}
          submitting={submitting}
          onClose={() => setShowCart(false)}
        />
      )}
    </div>
  )
}
