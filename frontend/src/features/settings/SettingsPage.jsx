import { useState } from 'react'
import {
  Settings, Table2, Printer, Bell, Shield, Plus, Trash2, Pencil, QrCode, Upload, X, Save
} from '@/components/ui/Icon'
import Card from '@/components/ui/Card'
import { getPaymentSettings, savePaymentSettings } from '@/lib/settings'

const TABS = [
  { id: 'general',  label: 'Thông tin chung', Icon: Settings },
  { id: 'zones',    label: 'Khu vực & Bàn',   Icon: Table2 },
  { id: 'payment-qr', label: 'QR thanh toán', Icon: QrCode },
  { id: 'printer',  label: 'Cài đặt in',      Icon: Printer },
  { id: 'notify',   label: 'Thông báo',       Icon: Bell },
  { id: 'roles',    label: 'Phân quyền',      Icon: Shield },
]

const INITIAL_ZONES = [
  { id: 'indoor',  name: 'Trong nhà',   tables: 8, description: 'Khu vực chính bên trong' },
  { id: 'outdoor', name: 'Ngoài trời',  tables: 4, description: 'Sân vườn, ban công' },
  { id: 'vip',     name: 'Phòng VIP',   tables: 3, description: 'Phòng riêng, karaoke' },
]

const resizeQrImage = (file) =>
  new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const maxSize = 900
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(imageUrl)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl)
      reject(new Error('Không thể đọc ảnh QR.'))
    }
    image.src = imageUrl
  })

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('zones')
  const [zones, setZones] = useState(INITIAL_ZONES)
  const [editingZone, setEditingZone] = useState(null)
  const [newZone, setNewZone] = useState({ name: '', tables: '', description: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [paymentSettings, setPaymentSettings] = useState(getPaymentSettings)
  const [paymentSaved, setPaymentSaved] = useState(false)

  const handleAddZone = () => {
    if (!newZone.name || !newZone.tables) return
    setZones([...zones, { id: Date.now().toString(), name: newZone.name, tables: parseInt(newZone.tables), description: newZone.description }])
    setNewZone({ name: '', tables: '', description: '' })
    setShowAddForm(false)
  }

  const handleDeleteZone = (id) => {
    setZones(zones.filter((z) => z.id !== id))
  }

  const updatePaymentSettings = (nextFields) => {
    setPaymentSaved(false)
    setPaymentSettings((current) => ({ ...current, ...nextFields }))
  }

  const handlePaymentQrUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh QR.')
      return
    }

    try {
      const qrImage = await resizeQrImage(file)
      updatePaymentSettings({
        qrImage,
        qrName: paymentSettings.qrName || 'QR thanh toán',
      })
    } catch (err) {
      alert(err.message || 'Không thể tải ảnh QR.')
    }
  }

  const handleSavePaymentSettings = () => {
    const savedSettings = savePaymentSettings(paymentSettings)
    setPaymentSettings(savedSettings)
    setPaymentSaved(true)
  }

  return (
    <div className="p-6 lg:p-8 fade-in h-full overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cài đặt</h1>
        <p className="text-slate-400 text-sm mt-1">Quản lý cấu hình hệ thống</p>
      </div>

      <div className="flex gap-6">
        {/* Left tabs */}
        <div className="w-56 flex-shrink-0">
          <div className="space-y-1">
            {TABS.map((tab) => {
              const IconComp = tab.Icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  <IconComp size={18} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1">
          {activeTab === 'zones' && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Khu vực & Bàn</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Cấu hình khu vực và số bàn trong mỗi khu vực</p>
                </div>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium text-white transition-all"
                  style={{ backgroundColor: '#10b981' }}
                >
                  <Plus size={16} />
                  Thêm khu vực
                </button>
              </div>

              {/* Add form */}
              {showAddForm && (
                <Card className="p-5 mb-5 border-2 border-emerald-200 bg-emerald-50/30">
                  <h3 className="font-semibold text-slate-800 mb-4">Thêm khu vực mới</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Tên khu vực *</label>
                      <input
                        type="text"
                        value={newZone.name}
                        onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                        placeholder="VD: Tầng 2"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Số bàn *</label>
                      <input
                        type="number"
                        value={newZone.tables}
                        onChange={(e) => setNewZone({ ...newZone, tables: e.target.value })}
                        placeholder="VD: 6"
                        min="1"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">Mô tả</label>
                      <input
                        type="text"
                        value={newZone.description}
                        onChange={(e) => setNewZone({ ...newZone, description: e.target.value })}
                        placeholder="VD: Khu vực yên tĩnh"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddZone}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                      style={{ backgroundColor: '#10b981' }}
                    >
                      Lưu khu vực
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200"
                    >
                      Hủy
                    </button>
                  </div>
                </Card>
              )}

              {/* Zone list */}
              <div className="space-y-3">
                {zones.map((zone) => (
                  <Card key={zone.id} className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                          <Table2 size={22} className="text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{zone.name}</h3>
                          <p className="text-sm text-slate-400 mt-0.5">{zone.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-800">{zone.tables}</p>
                          <p className="text-[11px] text-slate-400">bàn</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Tổng cộng</span>
                  <span className="text-sm font-bold text-slate-800">
                    {zones.reduce((s, z) => s + z.tables, 0)} bàn · {zones.length} khu vực
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <Card className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Thông tin nhà hàng</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tên nhà hàng</label>
                  <input type="text" defaultValue="District 1 - Beer Club" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Địa chỉ</label>
                  <input type="text" defaultValue="123 Nguyễn Huệ, Quận 1, TP.HCM" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Số điện thoại</label>
                  <input type="text" defaultValue="0901 234 567" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'payment-qr' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">QR thanh toán</h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Tải ảnh QR ngân hàng/VietQR để hiển thị khi khách thanh toán và in kèm bill.
                    </p>
                  </div>
                  {paymentSaved && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Đã lưu
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Tên hiển thị</label>
                    <input
                      type="text"
                      value={paymentSettings.qrName}
                      onChange={(e) => updatePaymentSettings({ qrName: e.target.value })}
                      placeholder="VD: VietQR - Nguyễn Văn A"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Ghi chú chuyển khoản</label>
                    <input
                      type="text"
                      value={paymentSettings.qrNote}
                      onChange={(e) => updatePaymentSettings({ qrNote: e.target.value })}
                      placeholder="VD: Quý khách chuyển khoản theo tổng tiền trên bill"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-2 block">Ảnh QR</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600">
                        <Upload size={16} />
                        Chọn ảnh QR
                        <input type="file" accept="image/*" className="hidden" onChange={handlePaymentQrUpload} />
                      </label>
                      {paymentSettings.qrImage && (
                        <button
                          type="button"
                          onClick={() => updatePaymentSettings({ qrImage: '' })}
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          <X size={16} />
                          Xóa ảnh
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      Có thể chụp màn hình QR từ app ngân hàng rồi upload trực tiếp.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSavePaymentSettings}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    <Save size={16} />
                    Lưu cấu hình QR
                  </button>
                </div>
              </Card>

              <Card className="p-6">
                <div className="rounded-[28px] border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Preview</p>
                      <h3 className="font-bold text-slate-800">{paymentSettings.qrName || 'QR thanh toán'}</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <QrCode size={22} />
                    </div>
                  </div>

                  <div className="aspect-square rounded-3xl border border-dashed border-slate-200 bg-white p-4">
                    {paymentSettings.qrImage ? (
                      <img
                        src={paymentSettings.qrImage}
                        alt="QR thanh toán"
                        className="h-full w-full rounded-2xl object-contain"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                        <QrCode size={56} strokeWidth={1.5} />
                        <p className="mt-3 text-sm font-medium">Chưa có ảnh QR</p>
                      </div>
                    )}
                  </div>

                  {paymentSettings.qrNote && (
                    <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                      {paymentSettings.qrNote}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab !== 'zones' && activeTab !== 'general' && activeTab !== 'payment-qr' && (
            <Card className="p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Settings size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Đang phát triển</p>
              <p className="text-slate-400 text-sm mt-1">Tính năng này sẽ sớm được cập nhật</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
