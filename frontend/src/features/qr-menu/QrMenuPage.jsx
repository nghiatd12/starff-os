import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { QrCode, Copy, Smartphone, CheckCircle2, ExternalLink } from '@/components/ui/Icon'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

/**
 * Tạo URL QR menu cho khách.
 * Trên Vercel luôn dùng production domain để QR không trỏ vào preview deployment cũ.
 * Path: /menu/:slug/ban/:tableId
 */
const PRODUCTION_APP_URL = 'https://staff-os-eight.vercel.app'

function isVercelPreviewUrl(value) {
  try {
    const url = new URL(value)
    return url.hostname.endsWith('.vercel.app') && url.hostname !== new URL(PRODUCTION_APP_URL).hostname
  } catch {
    return false
  }
}

function getTableUrl(slug, tableId) {
  const configuredBase = import.meta.env.VITE_APP_URL?.replace(/\/$/, '')
  const host = window.location.hostname
  const isVercelHost = host.endsWith('.vercel.app')
  const base = isVercelHost
    ? (configuredBase && !isVercelPreviewUrl(configuredBase) ? configuredBase : PRODUCTION_APP_URL)
    : (configuredBase || window.location.origin)
  return `${base}/menu/${slug}/ban/${tableId}`
}

export default function QrMenuPage() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)

  // Lấy slug từ user đã lưu trong localStorage
  const user = getUser()
  const storeSlug = user?.store_slug || user?.storeSlug || ''
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
          <p className="text-sm text-slate-400">
            Mỗi bàn có mã QR riêng. Khách quét → xem menu → gọi món trực tiếp.
          </p>
        </div>
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
        <div>
          {/* QR Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {tables.map((table) => {
              const url = canGenerateQr ? getTableUrl(storeSlug, table.id) : ''
              return (
                <Card key={table.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{table.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {table.zone === 'indoor' ? 'Trong nhà' : table.zone === 'outdoor' ? 'Ngoài trời' : 'Phòng VIP'}
                      </p>
                    </div>
                    <Badge variant="success" dot>Bật</Badge>
                  </div>

                  <div className="flex justify-center my-4">
                    <div className="p-3 bg-white rounded-2xl border border-slate-100 shadow-soft">
                      <QRCodeSVG
                        value={url || 'missing-store-slug'}
                        size={132}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#1e293b"
                      />
                    </div>
                  </div>

                  <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
                    <p className="truncate text-[11px] text-slate-400">{url}</p>
                  </div>

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
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
