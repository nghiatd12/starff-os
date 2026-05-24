import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { getPaymentQrImageUrl, getPaymentSettings, subscribePaymentSettings } from '@/lib/settings'
import { formatCurrency } from '@/utils/format'
import { Printer, Banknote, QrCode, Check } from '@/components/ui/Icon'
import Card from '@/components/ui/Card'

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tiền mặt', Icon: Banknote },
  { id: 'qr', label: 'QR', Icon: QrCode },
]

export default function BillDetail({ table, orders, onPaid }) {
  const [discount, setDiscount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState(getPaymentSettings)

  useEffect(() => subscribePaymentSettings(setPaymentSettings), [])

  const tableOrders = orders.filter((order) => order.table_id === table.id)
  const allItems = tableOrders.flatMap((order) => order.items || [])
  const mergedItems = allItems.reduce((acc, item) => {
    const existing = acc.find((current) => current.name === item.name && current.price === item.price)
    const qty = item.qty || item.quantity || 1
    if (existing) {
      existing.qty += qty
    } else {
      acc.push({ ...item, qty })
    }
    return acc
  }, [])

  const subtotal = mergedItems.reduce((sum, item) => sum + item.price * item.qty, 0)
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
      await Promise.all(
        tableOrders.map((order) =>
          api.patch(`/orders/${order.id}/pay`, { paymentMethod: payMethod, discount: parseFloat(discount) || 0 })
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

      <div className="flex-1 min-h-0 bg-slate-50 p-5">
        <div className="grid h-full min-h-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Chi tiết món ăn</h3>
                <p className="mt-0.5 text-xs text-slate-400">{mergedItems.length} món trong hóa đơn</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                {tableOrders.length} lần gọi
              </div>
            </div>

            {mergedItems.length === 0 ? (
              <div className="flex-1 p-5 text-center">
                <p className="text-slate-400 text-sm">Không có dữ liệu</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto">
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
                    {mergedItems.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-b border-slate-50 table-row-hover">
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

          <Card className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-slate-100 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thanh toán</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Tổng cần thu</p>
                  <p className="mt-1 text-3xl font-black text-brand-600">{formatCurrency(total)}</p>
                </div>
                <div className="rounded-2xl bg-brand-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-semibold text-brand-700">{table.name}</p>
                  <p className="text-[11px] text-brand-600">{billCode}</p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 text-sm">Tạm tính</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500 text-sm">Giảm giá</span>
                  <div className="flex items-center gap-2">
                    {discountAmt > 0 && (
                      <span className="text-red-500 text-sm font-medium">-{formatCurrency(discountAmt)}</span>
                    )}
                    <div className="relative">
                      <input
                        type="number"
                        value={discount}
                        onChange={(event) => setDiscount(event.target.value)}
                        placeholder="0"
                        min="0"
                        max="100"
                        className="w-20 border border-slate-200 rounded-xl py-2 pl-3 pr-7 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Phương thức thanh toán</p>
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map((method) => {
                    const IconComp = method.Icon
                    return (
                      <button
                        key={method.id}
                        onClick={() => {
                          setPayMethod(method.id)
                          if (method.id === 'qr') setShowQrModal(true)
                        }}
                        className={`rounded-2xl border-2 p-4 text-center transition-all ${
                          payMethod === method.id
                            ? 'border-brand-500 bg-brand-50 shadow-sm'
                            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex justify-center mb-2">
                          <IconComp size={24} className={payMethod === method.id ? 'text-brand-600' : 'text-slate-400'} />
                        </div>
                        <div className={`text-xs font-semibold ${payMethod === method.id ? 'text-brand-700' : 'text-slate-600'}`}>
                          {method.label}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 p-5">
              <button
                onClick={handlePay}
                disabled={paying || mergedItems.length === 0}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white py-4 rounded-2xl font-bold text-base transition-all shadow-soft hover:shadow-card flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Check size={20} strokeWidth={2.5} />
                {paying ? 'Đang xử lý...' : 'Thanh toán'}
              </button>
            </div>
          </Card>
        </div>
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

      {showQrModal && payMethod === 'qr' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">QR thanh toán</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{formatCurrency(total)}</h3>
                <p className="mt-1 text-sm text-slate-500">{table.name} · {billCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200"
              >
                Tắt
              </button>
            </div>

            <div className="rounded-[24px] border border-slate-100 bg-slate-50 p-4">
              <div className="aspect-square rounded-[20px] bg-white p-4 shadow-sm">
                {paymentQrImageUrl ? (
                  <img
                    src={paymentQrImageUrl}
                    alt="QR thanh toán"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <QrCode size={80} strokeWidth={1.5} />
                    <p className="mt-4 text-sm font-semibold">Chưa có ảnh QR</p>
                  </div>
                )}
              </div>
            </div>

            <p className="mt-4 text-center text-sm font-semibold text-slate-700">
              {paymentSettings.qrName || 'QR thanh toán'}
            </p>
            {paymentSettings.qrNote && (
              <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-xs font-medium text-emerald-700">
                {paymentSettings.qrNote}
              </p>
            )}
          </div>
        </div>
      )}
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
        <strong>Cảm ơn quý khách!</strong>
        <p>Hẹn gặp lại tại Quán Cậu Út.</p>
      </div>
    </div>
  )
}
