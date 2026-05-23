import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { QrCode, Printer, Copy, Smartphone, CheckCircle2, ExternalLink } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

/**
 * Tạo URL QR menu cho khách.
 * Dùng VITE_APP_URL nếu có, fallback về origin hiện tại.
 * Path: /menu/:slug/ban/:tableId
 */
function getTableUrl(slug, tableId) {
  const configuredBase = import.meta.env.VITE_APP_URL
  const host = window.location.hostname
  const isVercelPreview = host.endsWith('.vercel.app') && host !== 'staff-os-eight.vercel.app'
  const base = configuredBase || (isVercelPreview ? 'https://staff-os-eight.vercel.app' : window.location.origin)
  return `${base}/menu/${slug}/ban/${tableId}`
}

export default function QrMenuPage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewTable, setPreviewTable] = useState(null)

  // Lấy slug từ user đã lưu trong localStorage
  const user = getUser()
  const storeSlug = user?.store_slug || user?.storeSlug || ''
  const storeName = user?.store || user?.store_name || 'Quán của bạn'
  const canGenerateQr = Boolean(storeSlug)

  useEffect(() => {
    api.get('/tables')
      .then((data) => setTables(data.tables || []))
      .catch(() => setTables([]))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = (table) => {
    if (!canGenerateQr) return
    const url = getTableUrl(storeSlug, table.id)
    navigator.clipboard?.writeText(url)
    setCopiedId(table.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handlePreview = (table) => {
    setPreviewTable(table)
    setShowPreview(true)
  }

  const handleOpenMenu = (table) => {
    if (!canGenerateQr) return
    const url = getTableUrl(storeSlug, table.id)
    window.open(url, '_blank')
  }

  const activeCount = tables.length

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center fade-in">
        <p className="text-slate-400 text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">QR Menu — Khách tự gọi</h1>
          <p className="text-sm text-slate-400 mt-1">
            Mỗi bàn có mã QR riêng. Khách quét → xem menu → gọi món trực tiếp.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
          <Smartphone size={16} />
          {showPreview ? 'Ẩn xem trước' : 'Xem trước menu'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <QrCode size={20} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{activeCount}</p>
            <p className="text-[11px] text-slate-400">QR đang hoạt động</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Smartphone size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">Live</p>
            <p className="text-[11px] text-slate-400">Khách tự gọi được</p>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-slate-400 mb-1">Slug quán</p>
          <p className="text-sm font-medium text-emerald-700 truncate">{storeSlug || 'Chưa có slug'}</p>
        </Card>
      </div>

      {!canGenerateQr && (
        <Card className="p-4 mb-6 border-amber-100 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">Không tạo được QR vì thiếu slug quán.</p>
          <p className="text-xs text-amber-700 mt-1">Vui lòng đăng xuất rồi đăng nhập lại để đồng bộ thông tin quán.</p>
        </Card>
      )}

      {tables.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-slate-400 text-sm">Không có dữ liệu</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* QR Grid */}
          <div className="flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {tables.map((table) => {
                const url = canGenerateQr ? getTableUrl(storeSlug, table.id) : ''
                return (
                  <Card key={table.id} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-800">{table.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {table.zone === 'indoor' ? 'Trong nhà' : table.zone === 'outdoor' ? 'Ngoài trời' : 'VIP'}
                        </p>
                      </div>
                      <Badge variant="success" dot>Bật</Badge>
                    </div>

                    {/* QR Code thật — quét được */}
                    <div className="flex justify-center my-4">
                      <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-soft">
                        <QRCodeSVG
                          value={url || 'missing-store-slug'}
                          size={120}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#1e293b"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleCopy(table)}
                        disabled={!canGenerateQr}
                      >
                        {copiedId === table.id ? (
                          <><CheckCircle2 size={14} className="text-emerald-500" />Đã copy</>
                        ) : (
                          <><Copy size={14} />Copy link</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenMenu(table)}
                        disabled={!canGenerateQr}
                        title="Mở trang menu khách"
                      >
                        <ExternalLink size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(table)}
                        disabled={!canGenerateQr}
                        title="Xem trước"
                      >
                        <Smartphone size={14} />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Mobile Preview */}
          {showPreview && (
            <div className="lg:w-[320px] shrink-0">
              <Card className="p-4 sticky top-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800 text-sm">Xem trước trên điện thoại</h3>
                  {previewTable && (
                    <span className="text-xs text-slate-400">{previewTable.name}</span>
                  )}
                </div>
                <div className="rounded-3xl border-4 border-slate-800 overflow-hidden" style={{ aspectRatio: '9/16' }}>
                  <div className="h-full bg-slate-50 flex flex-col">
                    {/* Status bar */}
                    <div className="h-6 bg-slate-800 flex items-center justify-center shrink-0">
                      <div className="w-16 h-1.5 bg-slate-600 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="px-4 py-3 text-white text-center shrink-0" style={{ backgroundColor: '#10b981' }}>
                      <p className="text-[10px] opacity-80">
                        {previewTable
                          ? `${previewTable.name} — ${previewTable.zone === 'indoor' ? 'Trong nhà' : previewTable.zone === 'outdoor' ? 'Ngoài trời' : 'VIP'}`
                          : 'Bàn 1 — Trong nhà'}
                      </p>
                      <h4 className="text-sm font-bold">{storeName}</h4>
                    </div>

                    {/* Category tabs mockup */}
                    <div className="px-2 py-2 bg-white border-b border-slate-100 shrink-0">
                      <div className="flex gap-1.5 overflow-hidden">
                        {['Nhậu chính', 'Đồ nhắm', 'Đồ uống'].map((cat, i) => (
                          <div
                            key={cat}
                            className={`shrink-0 px-2 py-1 rounded-full text-[9px] font-medium ${
                              i === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {cat}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Menu items mockup */}
                    <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
                      {[
                        { name: 'Lẩu Thái', price: '280k', emoji: '🍖' },
                        { name: 'Gà nướng muối ớt', price: '180k', emoji: '🍗' },
                        { name: 'Nem nướng', price: '85k', emoji: '🥗' },
                        { name: 'Bia Tiger', price: '30k', emoji: '🍺' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded-xl bg-white shadow-sm">
                          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-sm shrink-0">
                            {item.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-semibold text-slate-700 truncate">{item.name}</p>
                            <p className="text-[9px] text-emerald-600 font-bold">{item.price}</p>
                          </div>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: '#10b981' }}>
                            +
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Bottom bar */}
                    <div className="p-2 border-t border-slate-100 shrink-0">
                      <div className="w-full py-2 rounded-xl text-white text-center text-[9px] font-bold" style={{ backgroundColor: '#10b981' }}>
                        Xem giỏ hàng · 2 món — 310k
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 text-center mt-3">
                  Giao diện thực tế khi khách quét QR
                </p>
                {previewTable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => handleOpenMenu(previewTable)}
                  >
                    <ExternalLink size={13} />
                    Mở trang thật
                  </Button>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
