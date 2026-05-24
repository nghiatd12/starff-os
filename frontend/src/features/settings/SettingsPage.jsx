import { useEffect, useState } from 'react'
import {
  Settings, Table2, Printer, Bell, Shield, Plus, Trash2, Pencil, QrCode, Upload, X, Save
} from '@/components/ui/Icon'
import Card from '@/components/ui/Card'
import { getPaymentSettings, getPrintSettings, savePaymentSettings, savePrintSettings } from '@/lib/settings'
import { NAV_ITEMS } from '@/constants/navigation'
import { ROLE_LABELS, SCREEN_PERMISSIONS } from '@/lib/permissions'
import { api } from '@/lib/api'

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

const ROLE_ORDER = ['owner', 'manager', 'waiter', 'kitchen', 'cashier']

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

export default function SettingsPage({ user, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('zones')
  const [zones, setZones] = useState(INITIAL_ZONES)
  const [editingZone, setEditingZone] = useState(null)
  const [newZone, setNewZone] = useState({ name: '', tables: '', description: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: user?.store || user?.store_name || '',
    address: user?.storeAddress || user?.store_address || '',
    phone: user?.storePhone || user?.store_phone || '',
  })
  const [restaurantSaving, setRestaurantSaving] = useState(false)
  const [restaurantSaved, setRestaurantSaved] = useState(false)
  const [restaurantError, setRestaurantError] = useState('')
  const [paymentSettings, setPaymentSettings] = useState(getPaymentSettings)
  const [paymentSaved, setPaymentSaved] = useState(false)
  const [printSettings, setPrintSettings] = useState(getPrintSettings)
  const [printSaved, setPrintSaved] = useState(false)
  const [permissions, setPermissions] = useState(null)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionSaving, setPermissionSaving] = useState('')
  const [permissionError, setPermissionError] = useState('')

  useEffect(() => {
    setRestaurantInfo({
      name: user?.store || user?.store_name || '',
      address: user?.storeAddress || user?.store_address || '',
      phone: user?.storePhone || user?.store_phone || '',
    })
    setRestaurantSaved(false)
    setRestaurantError('')
  }, [user])

  useEffect(() => {
    if (activeTab !== 'roles' || permissions) return
    setPermissionsLoading(true)
    setPermissionError('')
    api.get('/permissions')
      .then((data) => setPermissions(data.permissions || {}))
      .catch((err) => setPermissionError(err.message || 'Không tải được phân quyền'))
      .finally(() => setPermissionsLoading(false))
  }, [activeTab, permissions])

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

  const updateRestaurantInfo = (field, value) => {
    setRestaurantSaved(false)
    setRestaurantError('')
    setRestaurantInfo((current) => ({ ...current, [field]: value }))
  }

  const handleSaveRestaurantInfo = async () => {
    if (!restaurantInfo.name.trim()) {
      setRestaurantError('Nhập tên nhà hàng.')
      return
    }

    setRestaurantSaving(true)
    setRestaurantError('')
    try {
      const data = await api.patch('/tenant', restaurantInfo)
      const tenant = data.tenant
      const nextUser = {
        ...user,
        store: tenant.name,
        store_name: tenant.name,
        storeSlug: tenant.slug,
        store_slug: tenant.slug,
        storeAddress: tenant.address,
        store_address: tenant.address,
        storePhone: tenant.phone,
        store_phone: tenant.phone,
      }
      setRestaurantInfo({ name: tenant.name, address: tenant.address || '', phone: tenant.phone || '' })
      onUserUpdate?.(nextUser)
      setRestaurantSaved(true)
    } catch (err) {
      setRestaurantError(err.message || 'Không lưu được thông tin nhà hàng.')
    } finally {
      setRestaurantSaving(false)
    }
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

  const updatePrintSettings = (nextFields) => {
    setPrintSaved(false)
    setPrintSettings((current) => ({ ...current, ...nextFields }))
  }

  const handleSavePrintSettings = () => {
    const savedSettings = savePrintSettings(printSettings)
    setPrintSettings(savedSettings)
    setPrintSaved(true)
  }

  const handleTestPrint = () => {
    const savedSettings = savePrintSettings(printSettings)
    setPrintSettings(savedSettings)
    setPrintSaved(true)
    window.print()
  }

  const handleTogglePermission = async (role, screen) => {
    if (role === 'owner') return
    const current = permissions?.[role]?.[screen] || false
    const key = `${role}:${screen}`
    setPermissionSaving(key)
    setPermissionError('')
    try {
      const data = await api.patch('/permissions', { role, screen, allowed: !current })
      setPermissions(data.permissions || {})
    } catch (err) {
      setPermissionError(err.message || 'Không lưu được phân quyền')
    } finally {
      setPermissionSaving('')
    }
  }

  return (
    <div className="p-6 lg:p-8 fade-in h-full overflow-y-auto">
      <div className="mb-6">
        <p className="text-slate-400 text-sm">Quản lý cấu hình hệ thống</p>
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
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Thông tin nhà hàng</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Thông tin này dùng trên hệ thống, hóa đơn và trang đăng nhập.</p>
                </div>
                <button
                  onClick={handleSaveRestaurantInfo}
                  disabled={restaurantSaving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                >
                  <Save size={16} />
                  {restaurantSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Tên nhà hàng</label>
                  <input
                    type="text"
                    value={restaurantInfo.name}
                    onChange={(e) => updateRestaurantInfo('name', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Địa chỉ</label>
                  <input
                    type="text"
                    value={restaurantInfo.address}
                    onChange={(e) => updateRestaurantInfo('address', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Số điện thoại</label>
                  <input
                    type="text"
                    value={restaurantInfo.phone}
                    onChange={(e) => updateRestaurantInfo('phone', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                  />
                </div>
                {restaurantError && <p className="text-sm font-medium text-red-500">{restaurantError}</p>}
                {restaurantSaved && <p className="text-sm font-semibold text-emerald-600">Đã lưu thông tin nhà hàng.</p>}
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
                    <label className="text-xs font-medium text-slate-500 mb-2 block">Kiểu QR</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'upload', label: 'Upload ảnh QR', desc: 'QR tĩnh, giống ảnh bạn tải lên' },
                        { id: 'vietqr', label: 'Tự động theo số tiền', desc: 'QR VietQR đổi theo tổng bill' },
                      ].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => updatePaymentSettings({ qrMode: option.id })}
                          className={`rounded-2xl border-2 p-4 text-left transition-all ${
                            paymentSettings.qrMode === option.id
                              ? 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-sm font-bold text-slate-800">{option.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{option.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentSettings.qrMode === 'vietqr' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-3xl border border-emerald-100 bg-emerald-50/40 p-4">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Mã ngân hàng</label>
                        <input
                          type="text"
                          value={paymentSettings.bankCode}
                          onChange={(e) => updatePaymentSettings({ bankCode: e.target.value.trim().toUpperCase() })}
                          placeholder="VD: VCB, ACB, TCB, MB"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Số tài khoản</label>
                        <input
                          type="text"
                          value={paymentSettings.accountNumber}
                          onChange={(e) => updatePaymentSettings({ accountNumber: e.target.value.trim() })}
                          placeholder="VD: 0123456789"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Tên chủ tài khoản</label>
                        <input
                          type="text"
                          value={paymentSettings.accountName}
                          onChange={(e) => updatePaymentSettings({ accountName: e.target.value })}
                          placeholder="VD: NGUYEN VAN A"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">Mẫu QR</label>
                        <select
                          value={paymentSettings.qrTemplate}
                          onChange={(e) => updatePaymentSettings({ qrTemplate: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                        >
                          <option value="compact2">Đẹp gọn</option>
                          <option value="compact">Gọn</option>
                          <option value="qr_only">Chỉ QR</option>
                        </select>
                      </div>
                    </div>
                  )}

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

                  {paymentSettings.qrMode !== 'vietqr' && (
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
                  )}

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
                    {paymentSettings.qrMode === 'vietqr' && paymentSettings.bankCode && paymentSettings.accountNumber ? (
                      <img
                        src={`https://img.vietqr.io/image/${paymentSettings.bankCode}-${paymentSettings.accountNumber}-${paymentSettings.qrTemplate || 'compact2'}.png?amount=125000&addInfo=Thanh%20toan%20demo&accountName=${encodeURIComponent(paymentSettings.accountName || '')}`}
                        alt="QR thanh toán demo"
                        className="h-full w-full rounded-2xl object-contain"
                      />
                    ) : paymentSettings.qrImage ? (
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

              <div className={`print-bill ${printSettings.paperSize === '58mm' ? 'print-bill--58' : ''}`}>
                <div className="print-bill__header">
                  <h1>Test in</h1>
                  <p>{restaurantInfo.name || 'Quán Cậu Út'}</p>
                  {printSettings.printerName && <p>{printSettings.printerName}</p>}
                </div>
                <div className="print-bill__title">
                  <span>KIỂM TRA MÁY IN</span>
                </div>
                <div className="print-bill__meta">
                  <div>
                    <span>Khổ giấy</span>
                    <strong>{printSettings.paperSize}</strong>
                  </div>
                  <div>
                    <span>Chế độ</span>
                    <strong>{printSettings.directKiosk ? 'Kiosk' : 'Thường'}</strong>
                  </div>
                </div>
                <div className="print-bill__footer">
                  <strong>StaffOS</strong>
                  <p>Phiếu test in.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <Card className="overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-bold text-slate-800">Phân quyền theo vai trò</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Bật/tắt quyền cho từng vai trò. Thay đổi được lưu ngay và áp dụng ở lần tải quyền tiếp theo của nhân viên.
                </p>
                {permissionError && (
                  <p className="mt-3 inline-flex rounded-xl bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
                    {permissionError}
                  </p>
                )}
              </div>

              {permissionsLoading ? (
                <div className="p-8 text-center text-sm text-slate-400">Đang tải phân quyền...</div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="p-4 text-left font-semibold">Màn hình</th>
                      {ROLE_ORDER.map((role) => (
                        <th key={role} className="p-4 text-center font-semibold">
                          {ROLE_LABELS[role]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NAV_ITEMS.map((item) => (
                      <tr key={item.id} className="border-b border-slate-50">
                        <td className="p-4">
                          <p className="text-sm font-semibold text-slate-700">{item.label}</p>
                        </td>
                        {ROLE_ORDER.map((role) => {
                          const allowed = permissions?.[role]?.[item.id] ?? SCREEN_PERMISSIONS[item.id]?.includes(role)
                          const saving = permissionSaving === `${role}:${item.id}`
                          const locked = role === 'owner'
                          return (
                            <td key={role} className="p-4 text-center">
                              <button
                                type="button"
                                disabled={locked || saving}
                                onClick={() => handleTogglePermission(role, item.id)}
                                className={`inline-flex h-8 min-w-14 items-center justify-center rounded-full px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                                allowed
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-50 text-slate-300'
                              }`}>
                                {saving ? '...' : allowed ? 'Bật' : 'Tắt'}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </Card>
          )}

          {activeTab === 'printer' && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="p-6">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Cài đặt in bill</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Dùng cho máy thu ngân chạy Chrome kiosk để in thẳng ra máy in mặc định.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePrintSettings({ directKiosk: !printSettings.directKiosk })}
                    className={`relative h-8 w-14 rounded-full transition-colors ${
                      printSettings.directKiosk ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                    aria-label="Bật in trực tiếp kiosk"
                  >
                    <span
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
                        printSettings.directKiosk ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Web không đọc được danh sách/trạng thái máy in. Để không hiện hộp thoại Print, máy thu ngân phải mở Chrome bằng
                    <span className="font-bold"> --kiosk-printing</span> và đặt đúng máy in bill làm mặc định.
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Tên máy in mặc định</label>
                    <input
                      type="text"
                      value={printSettings.printerName}
                      onChange={(event) => updatePrintSettings({ printerName: event.target.value })}
                      placeholder="VD: Xprinter XP-80C"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">Dùng để nhân viên đối chiếu, trình duyệt vẫn in ra máy in mặc định của Windows.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Khổ giấy</label>
                      <select
                        value={printSettings.paperSize}
                        onChange={(event) => updatePrintSettings({ paperSize: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="80mm">80mm</option>
                        <option value="58mm">58mm</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Số bản</label>
                      <input
                        type="number"
                        min="1"
                        value={printSettings.copies}
                        onChange={(event) => updatePrintSettings({ copies: event.target.value })}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSavePrintSettings}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      <Save size={16} />
                      Lưu cài đặt in
                    </button>
                    <button
                      type="button"
                      onClick={handleTestPrint}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Printer size={16} />
                      Test in
                    </button>
                  </div>
                  {printSaved && <p className="text-sm font-semibold text-emerald-600">Đã lưu cài đặt in.</p>}
                </div>
              </Card>

              <Card className="p-6">
                <div className="rounded-[28px] border border-slate-100 bg-slate-50 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm">
                    <Printer size={24} />
                  </div>
                  <h3 className="mt-4 font-bold text-slate-800">
                    {printSettings.directKiosk ? 'In trực tiếp đang bật' : 'Chưa bật in trực tiếp'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {printSettings.directKiosk
                      ? 'Khi bấm thanh toán, Chrome kiosk sẽ in ngay ra máy in mặc định.'
                      : 'Khi thanh toán, hệ thống sẽ báo cần bật kiosk trước khi in bill.'}
                  </p>
                  <div className="mt-5 space-y-2 rounded-2xl bg-white p-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">Máy in</span>
                      <strong className="text-right text-slate-700">{printSettings.printerName || 'Máy in mặc định'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Khổ giấy</span>
                      <strong className="text-slate-700">{printSettings.paperSize}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số bản</span>
                      <strong className="text-slate-700">{printSettings.copies}</strong>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {activeTab !== 'zones' && activeTab !== 'general' && activeTab !== 'payment-qr' && activeTab !== 'roles' && activeTab !== 'printer' && (
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
