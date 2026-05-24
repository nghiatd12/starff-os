import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/utils/format'
import { getTenantPrintInfo } from '@/utils/tenant'
import { Banknote, Printer, QrCode, Save, Search, Trash2 } from '@/components/ui/Icon'
import Card from '@/components/ui/Card'
import { useMenu } from '@/lib/useStore'

const PAYMENT_LABELS = {
  cash: 'Tiền mặt',
  qr: 'QR',
}

function getItemQty(item) {
  return Number(item.quantity || item.qty || 1)
}

function normalizeOrder(order) {
  return {
    ...order,
    items: (order.items || []).map((item) => ({
      id: item.id,
      name: item.name || '',
      price: Number(item.price || 0),
      quantity: getItemQty(item),
    })),
    discount_percent: Number(order.discount_percent || 0),
    payment_method: order.payment_method || 'cash',
  }
}

function formatDate(value) {
  if (!value) return 'Chưa có'
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function CashierHistory({ user }) {
  const { menu, refresh: refreshMenu } = useMenu()
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [itemSearch, setItemSearch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId]
  )

  const menuItems = useMemo(() => Object.values(menu).flat(), [menu])
  const searchResults = useMemo(() => {
    const keyword = itemSearch.trim().toLowerCase()
    if (!keyword) return []
    return menuItems
      .filter((item) => item.name?.toLowerCase().includes(keyword))
      .slice(0, 8)
  }, [itemSearch, menuItems])

  const subtotal = draftItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  const discountAmount = Math.round(subtotal * (Number(discount || 0) / 100))
  const total = Math.max(0, subtotal - discountAmount)
  const tenantInfo = getTenantPrintInfo(user)

  const loadHistory = () => {
    setLoading(true)
    api.get('/orders/history')
      .then((data) => {
        const rows = (data.orders || []).map(normalizeOrder)
        setOrders(rows)
        const first = rows[0] || null
        setSelectedId((current) => rows.some((order) => order.id === current) ? current : first?.id || null)
        if (first && !selectedId) {
          setDraftItems(first.items)
          setDiscount(first.discount_percent)
          setPaymentMethod(first.payment_method)
        }
      })
      .catch((err) => setNotice(err.message || 'Không tải được lịch sử thu ngân'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadHistory()
    refreshMenu()
  }, [])

  useEffect(() => {
    if (!selectedOrder) {
      setDraftItems([])
      return
    }
    setDraftItems(selectedOrder.items)
    setDiscount(selectedOrder.discount_percent)
    setPaymentMethod(selectedOrder.payment_method)
    setNotice('')
  }, [selectedOrder?.id])

  const updateItem = (index, field, value) => {
    setDraftItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    )
  }

  const removeItem = (index) => {
    setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const addMenuItem = (menuItem) => {
    setDraftItems((current) => {
      const existingIndex = current.findIndex((item) => item.name === menuItem.name && Number(item.price) === Number(menuItem.price))
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex ? { ...item, quantity: Number(item.quantity || 1) + 1 } : item
        )
      }
      return [...current, { id: null, name: menuItem.name, price: Number(menuItem.price || 0), quantity: 1 }]
    })
    setItemSearch('')
  }

  const saveBill = async () => {
    if (!selectedOrder || draftItems.length === 0) return
    setSaving(true)
    setNotice('')
    try {
      const data = await api.patch(`/orders/${selectedOrder.id}/bill`, {
        items: draftItems,
        discount,
        paymentMethod,
      })
      const updated = normalizeOrder(data.order)
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order))
      setNotice('Đã lưu chỉnh sửa hóa đơn.')
    } catch (err) {
      setNotice(err.message || 'Không lưu được hóa đơn')
    } finally {
      setSaving(false)
    }
  }

  const printBill = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Đang tải lịch sử thu ngân...
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center">
        <div>
          <div className="mx-auto mb-4 h-16 w-16 rounded-3xl bg-slate-50" />
          <p className="text-sm font-semibold text-slate-700">Chưa có hóa đơn đã thanh toán</p>
          <p className="mt-1 text-xs text-slate-400">Bill đã thanh toán sẽ xuất hiện ở đây để in lại hoặc chỉnh sửa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-80 border-r border-slate-100 bg-white">
        <div className="border-b border-slate-100 p-5">
          <p className="text-xs text-slate-400">{orders.length} hóa đơn đã thanh toán</p>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className={`w-full border-b border-slate-50 p-4 text-left transition-colors ${
                selectedId === order.id ? 'bg-emerald-50 border-l-[3px] border-l-emerald-500' : 'hover:bg-slate-50 border-l-[3px] border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{order.table_name || `Bàn #${order.table_id}`}</p>
                  <p className="mt-1 text-xs text-slate-400">#{order.id} · {formatDate(order.closed_at)}</p>
                </div>
                <p className="text-sm font-bold text-emerald-600">{formatCurrency(order.total)}</p>
              </div>
              <p className="mt-2 text-xs text-slate-400">{order.items.length} món · {PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-slate-50 p-5">
        {selectedOrder && (
          <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="flex min-h-0 flex-col overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Hóa đơn #{selectedOrder.id}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedOrder.table_name || `Bàn #${selectedOrder.table_id}`} · {formatDate(selectedOrder.closed_at)}
                  </p>
                </div>

                <div className="relative mt-4 max-w-md">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Tìm món để thêm vào bill..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-medium text-slate-700 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1.5 shadow-elevated">
                      {searchResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addMenuItem(item)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                        >
                          <span className="min-w-0 truncate font-semibold text-slate-700">{item.name}</span>
                          <span className="shrink-0 text-xs font-bold text-emerald-600">{formatCurrency(item.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {itemSearch.trim() && searchResults.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-400 shadow-elevated">
                      Không tìm thấy món trong menu
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="p-4 text-left font-semibold">Món</th>
                      <th className="w-24 p-4 text-center font-semibold">SL</th>
                      <th className="w-36 p-4 text-right font-semibold">Đơn giá</th>
                      <th className="w-20 p-4 text-center font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((item, index) => (
                      <tr key={`${item.id || 'new'}-${index}`} className="border-b border-slate-50">
                        <td className="p-3">
                          <input
                            value={item.name}
                            onChange={(event) => updateItem(index, 'name', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(event) => updateItem(index, 'price', event.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeItem(index)}
                            className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="flex min-h-0 flex-col overflow-hidden">
              <div className="border-b border-slate-100 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tổng hóa đơn</p>
                <p className="mt-2 text-3xl font-black text-emerald-600">{formatCurrency(total)}</p>
              </div>

              <div className="flex-1 space-y-4 p-5">
                <div className="rounded-3xl bg-slate-50 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tạm tính</span>
                    <strong className="text-slate-800">{formatCurrency(subtotal)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Giảm giá</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                      className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-semibold"
                    />
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-3 text-sm">
                    <span className="text-slate-500">Giảm</span>
                    <strong className="text-red-500">-{formatCurrency(discountAmount)}</strong>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-500">Phương thức</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'cash', label: 'Tiền mặt', Icon: Banknote },
                      { id: 'qr', label: 'QR', Icon: QrCode },
                    ].map((method) => {
                      const IconComp = method.Icon
                      const active = paymentMethod === method.id
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold transition-colors ${
                            active
                              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <IconComp size={16} />
                          {method.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {notice && (
                  <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{notice}</p>
                )}
              </div>

              <div className="space-y-2 border-t border-slate-100 p-5">
                <button
                  onClick={saveBill}
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? 'Đang lưu...' : 'Lưu chỉnh sửa'}
                </button>
                <button
                  onClick={printBill}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  <Printer size={16} />
                  In lại bill
                </button>
              </div>
            </Card>

            <HistoryPrintableBill
              order={selectedOrder}
              items={draftItems}
              subtotal={subtotal}
              discount={discount}
              discountAmount={discountAmount}
              total={total}
              paymentMethod={paymentMethod}
              tenantInfo={tenantInfo}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryPrintableBill({ order, items, subtotal, discount, discountAmount, total, paymentMethod, tenantInfo }) {
  return (
    <div className="print-bill">
      <div className="print-bill__header">
        <h1>{tenantInfo.name}</h1>
        {tenantInfo.address && <p>{tenantInfo.address}</p>}
        {tenantInfo.phone && <p>ĐT: {tenantInfo.phone}</p>}
      </div>

      <div className="print-bill__title">
        <span>HÓA ĐƠN THANH TOÁN</span>
      </div>

      <div className="print-bill__meta">
        <div>
          <span>Bàn</span>
          <strong>{order.table_name || `#${order.table_id}`}</strong>
        </div>
        <div>
          <span>Mã đơn</span>
          <strong>#{order.id}</strong>
        </div>
        <div>
          <span>Thời gian</span>
          <strong>{formatDate(order.closed_at)}</strong>
        </div>
      </div>

      <table className="print-bill__table">
        <thead>
          <tr>
            <th>Món</th>
            <th>SL</th>
            <th>Giá</th>
            <th>T.Tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{formatCurrency(Number(item.price || 0))}</td>
              <td>{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="print-bill__totals">
        <div>
          <span>Tạm tính</span>
          <strong>{formatCurrency(subtotal)}</strong>
        </div>
        <div>
          <span>Giảm giá{Number(discount) ? ` (${discount}%)` : ''}</span>
          <strong>-{formatCurrency(discountAmount)}</strong>
        </div>
        <div className="print-bill__grand-total">
          <span>Tổng cộng</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Thanh toán</span>
          <strong>{PAYMENT_LABELS[paymentMethod] || paymentMethod}</strong>
        </div>
      </div>

      <div className="print-bill__footer">
        <strong>Cảm ơn quý khách!</strong>
        <p>{tenantInfo.goodbye}</p>
      </div>
    </div>
  )
}
