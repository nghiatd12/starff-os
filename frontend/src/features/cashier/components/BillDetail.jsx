import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { getPaymentQrImageUrl, getPaymentSettings, subscribePaymentSettings } from '@/lib/settings'
import { formatCurrency } from '@/utils/format'
import { Printer, Banknote, QrCode, Check } from '@/components/ui/Icon'
import Card from '@/components/ui/Card'

const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Tiền mặt',     Icon: Banknote },
  { id: 'qr',       label: 'QR',           Icon: QrCode },
]

/**
 * BillDetail — chi tiết hóa đơn và thanh toán
 * Gộp tất cả orders của cùng 1 bàn lại thành 1 hóa đơn
 */
export default function BillDetail({ table, orders, onPaid }) {
  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState(getPaymentSettings)

  useEffect(() => subscribePaymentSettings(setPaymentSettings), [])

  // Lấy TẤT CẢ orders của bàn này (có thể gọi nhiều lần)
  const tableOrders = orders.filter((o) => o.table_id === table.id)

  // Gộp tất cả items từ mọi order
  const allItems = tableOrders.flatMap((o) => o.items || [])

  // Gộp items trùng tên lại (cùng món gọi nhiều lần)
  const mergedItems = allItems.reduce((acc, item) => {
    const existing = acc.find((i) => i.name === item.name && i.price === item.price)
    if (existing) {
      existing.qty = (existing.qty || existing.quantity || 1) + (item.qty || item.quantity || 1)
    } else {
      acc.push({ ...item, qty: item.qty || item.quantity || 1 })
    }
    return acc
  }, [])

  const subtotal = mergedItems.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmt = discount ? Math.round(subtotal * (parseFloat(discount) / 100)) : 0
  const total = subtotal - discountAmt
  const billCode = tableOrders.map((order) => `#${order.id}`).join(', ') || `Bàn ${table.id}`
  const printedAt = new Date().toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const paymentLabel = PAYMENT_METHODS.find((method) => method.id === payMethod)?.label || payMethod
  const paymentQrImageUrl = getPaymentQrImageUrl(paymentSettings, { amount: total, billCode })

  const handlePrint = () => {
    window.print()
  }

  const printBillAndWait = () =>
    new Promise((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.removeEventListener('afterprint', finish)
        resolve()
      }

      window.addEventListener('afterprint', finish)
      requestAnimationFrame(() => {
        window.print()
        setTimeout(finish, 1000)
      })
    })

  const handlePay = async () => {
    if (tableOrders.length === 0) return
    setPaying(true)
    try {
      // Thanh toán tất cả orders của bàn
      await Promise.all(
        tableOrders.map((o) =>
          api.patch(`/orders/${o.id}/pay`, { paymentMethod: payMethod, discount: parseFloat(discount) || 0 })
        )
      )
      await printBillAndWait()
      onPaid?.(table.id)
    } catch (err) {
      alert(err.message || 'Thanh toán thất bại')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-bold text-slate-800 text-lg">Hóa đơn — {table.name}</h2>
          <p className="text-slate-400 text-sm">
            {tableOrders.length} lần gọi · {mergedItems.length} món
          </p>
        </div>
        <button
          onClick={handlePrint}
          disabled={mergedItems.length === 0}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-2xl text-sm hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Printer size={16} />
          In hóa đơn
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
        {/* Items table */}
        <Card className="mb-5 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">Chi tiết món ăn</h3>
          </div>
          {mergedItems.length === 0 ? (
            <div className="p-5 text-center">
              <p className="text-slate-400 text-sm">Không có dữ liệu</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-[11px] text-slate-400 border-b border-slate-100 uppercase tracking-wider">
                    <th className="text-left p-4 font-semibold">Món</th>
                    <th className="text-center p-4 font-semibold">SL</th>
                    <th className="text-right p-4 font-semibold">Đơn giá</th>
                    <th className="text-right p-4 font-semibold">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedItems.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 table-row-hover">
                      <td className="p-4 text-sm text-slate-700 font-medium">{item.name}</td>
                      <td className="p-4 text-sm text-center text-slate-500">{item.qty}</td>
                      <td className="p-4 text-sm text-right text-slate-500">{formatCurrency(item.price)}</td>
                      <td className="p-4 text-sm text-right font-bold text-slate-800">
                        {formatCurrency(item.price * item.qty)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Payment */}
        <Card className="p-6">
          <div className="flex justify-between mb-3">
            <span className="text-slate-500 text-sm">Tạm tính</span>
            <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-slate-500 text-sm">Giảm giá (%)</span>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              className="w-20 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300"
            />
            {discountAmt > 0 && (
              <span className="text-red-500 text-sm font-medium">-{formatCurrency(discountAmt)}</span>
            )}
          </div>

          <div className="flex justify-between mb-6 pt-4 border-t border-slate-100">
            <span className="font-bold text-slate-800 text-lg">Tổng cộng</span>
            <span className="font-bold text-2xl text-brand-600">{formatCurrency(total)}</span>
          </div>

          <p className="text-sm font-semibold text-slate-700 mb-3">Phương thức thanh toán</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {PAYMENT_METHODS.map((m) => {
              const IconComp = m.Icon
              return (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  className={`p-4 rounded-2xl border-2 text-center transition-all ${
                    payMethod === m.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <IconComp size={24} className={payMethod === m.id ? 'text-brand-600' : 'text-slate-400'} />
                  </div>
                  <div className={`text-xs font-medium ${payMethod === m.id ? 'text-brand-700' : 'text-slate-600'}`}>
                    {m.label}
                  </div>
                </button>
              )
            })}
          </div>

          {payMethod === 'qr' && (
            <div className="mb-6 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white bg-white p-2 shadow-sm">
                  {paymentQrImageUrl ? (
                    <img
                      src={paymentQrImageUrl}
                      alt="QR thanh toán"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <QrCode size={44} className="text-emerald-500" strokeWidth={1.5} />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-sm font-bold text-slate-800">
                    {paymentSettings.qrName || 'QR thanh toán'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {paymentQrImageUrl
                      ? paymentSettings.qrMode === 'vietqr'
                        ? `QR đã có sẵn số tiền ${formatCurrency(total)}.`
                        : 'Khách có thể quét QR này, sau đó bấm thanh toán để in bill.'
                      : 'Chưa có ảnh QR. Vào Cài đặt > QR thanh toán để upload ảnh QR của quán.'}
                  </p>
                  {paymentSettings.qrNote && (
                    <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-medium text-emerald-700">
                      {paymentSettings.qrNote}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handlePay}
            disabled={paying || mergedItems.length === 0}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-soft hover:shadow-card flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Check size={20} strokeWidth={2.5} />
            {paying ? 'Đang xử lý...' : 'Thanh toán'}
          </button>
        </Card>
      </div>
      <PrintableBill
        table={table}
        billCode={billCode}
        printedAt={printedAt}
        items={mergedItems}
        subtotal={subtotal}
        discount={parseFloat(discount) || 0}
        discountAmt={discountAmt}
        total={total}
        paymentLabel={paymentLabel}
        paymentMethod={payMethod}
        paymentSettings={paymentSettings}
        paymentQrImageUrl={paymentQrImageUrl}
      />
    </div>
  )
}

function PrintableBill({
  table,
  billCode,
  printedAt,
  items,
  subtotal,
  discount,
  discountAmt,
  total,
  paymentLabel,
  paymentMethod,
  paymentSettings,
  paymentQrImageUrl,
}) {
  const shouldPrintPaymentQr = paymentMethod === 'qr' && paymentQrImageUrl

  return (
    <div className="print-bill">
      <div className="print-bill__header">
        <h1>StaffOS</h1>
        <p>Hóa đơn thanh toán</p>
      </div>

      <div className="print-bill__meta">
        <div>
          <span>Bàn</span>
          <strong>{table.name}</strong>
        </div>
        <div>
          <span>Mã đơn</span>
          <strong>{billCode}</strong>
        </div>
        <div>
          <span>Thời gian</span>
          <strong>{printedAt}</strong>
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
              <td>{item.qty}</td>
              <td>{formatCurrency(item.price)}</td>
              <td>{formatCurrency(item.price * item.qty)}</td>
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
          <span>Giảm giá{discount ? ` (${discount}%)` : ''}</span>
          <strong>-{formatCurrency(discountAmt)}</strong>
        </div>
        <div className="print-bill__grand-total">
          <span>Tổng cộng</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
        <div>
          <span>Thanh toán</span>
          <strong>{paymentLabel}</strong>
        </div>
      </div>

      {shouldPrintPaymentQr && (
        <div className="print-bill__qr">
          <p>{paymentSettings.qrName || 'QR thanh toán'}</p>
          <img src={paymentQrImageUrl} alt="QR thanh toán" />
          {paymentSettings.qrNote && <span>{paymentSettings.qrNote}</span>}
        </div>
      )}

      <div className="print-bill__footer">
        <p>Cảm ơn quý khách. Hẹn gặp lại!</p>
      </div>
    </div>
  )
}
