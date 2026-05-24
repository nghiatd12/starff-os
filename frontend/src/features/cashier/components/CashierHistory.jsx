import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/utils/format'
import { Plus, Printer, Save, Trash2 } from '@/components/ui/Icon'
import Card from '@/components/ui/Card'

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

export default function CashierHistory() {
  const [orders, setOrders] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) || null,
    [orders, selectedId]
  )

  const subtotal = draftItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  const discountAmount = Math.round(subtotal * (Number(discount || 0) / 100))
  const total = Math.max(0, subtotal - discountAmount)

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

  const addItem = () => {
    setDraftItems((current) => [...current, { id: null, name: '', price: 0, quantity: 1 }])
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
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Hóa đơn #{selectedOrder.id}</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {selectedOrder.table_name || `Bàn #${selectedOrder.table_id}`} · {formatDate(selectedOrder.closed_at)}
                  </p>
                </div>
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                >
                  <Plus size={14} />
                  Thêm món
                </button>
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
                  <select
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="qr">QR</option>
                  </select>
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
            />
          </div>
        )}
      </div>
    </div>
  )
}

function HistoryPrintableBill({ order, items, subtotal, discount, discountAmount, total, paymentMethod }) {
  return (
    <div className="print-bill">
      <div className="print-bill__header">
        <h1>Quán Cậu Út</h1>
        <p>123 Nguyễn Huệ, Q.7, TP.HCM</p>
        <p>ĐT: 0901 234 567</p>
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
        <p>Hẹn gặp lại tại Quán Cậu Út.</p>
      </div>
    </div>
  )
}
