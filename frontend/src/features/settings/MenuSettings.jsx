import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { fetchMenu } from '@/lib/store'
import Select from '@/components/ui/Select'
import {
  CheckCircle2, Download, Pencil, Plus, Save, Trash2, Upload, X, Layers, FolderOpen,
} from '@/components/ui/Icon'

// ─── Constants ────────────────────────────────────────────────────────────────

const MENU_TYPES = [
  { value: 'regular',  label: 'Ngày thường' },
  { value: 'holiday',  label: 'Ngày lễ' },
  { value: 'seasonal', label: 'Theo mùa' },
  { value: 'event',    label: 'Sự kiện' },
]

const EMPTY_ITEM = { name: '', category: '', price: '', description: '', imageUrl: '', available: true }
const ITEMS_PER_PAGE = 10
const MENU_IMAGE_MAX_SIZE = 900
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

function formatPrice(v) {
  return new Intl.NumberFormat('vi-VN').format(Number(v || 0)) + 'đ'
}

// ─── Excel helpers ────────────────────────────────────────────────────────────

function normalizeKey(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
  }
  return ''
}

function parseAvailable(value) {
  if (value === undefined || value === null || value === '') return true
  const text = String(value).trim().toLowerCase()
  return !['false', '0', 'không', 'khong', 'ngưng', 'ngung', 'off', 'no'].includes(text)
}

function parsePrice(value) {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[^\d]/g, '') || 0)
}

function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
        resolve(rows.map((row) => ({
          name:        String(normalizeKey(row, ['Tên món', 'Ten mon', 'name', 'Name'])).trim(),
          category:    String(normalizeKey(row, ['Danh mục', 'Danh muc', 'category', 'Category'])).trim(),
          price:       parsePrice(normalizeKey(row, ['Giá', 'Gia', 'price', 'Price'])),
          description: String(normalizeKey(row, ['Mô tả', 'Mo ta', 'description', 'Description'])).trim(),
          imageUrl:    String(normalizeKey(row, ['Ảnh', 'Anh', 'imageUrl', 'image_url', 'Image URL'])).trim(),
          available:   parseAvailable(normalizeKey(row, ['Đang bán', 'Dang ban', 'available', 'Available'])),
        })).filter((item) => item.name || item.category || item.price))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function uploadMenuImage(file) {
  if (!file) return ''
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Chưa cấu hình Cloudinary để upload ảnh.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', 'staff-os/menu')

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Upload ảnh thất bại.')
  return data.secure_url
}

async function uploadMenuImageWithFallback(file) {
  if (!file) return ''
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) return resizeMenuImage(file)
  try {
    return await uploadMenuImage(file)
  } catch (err) {
    console.warn('[MenuSettings] Cloudinary upload failed, storing optimized local image instead:', err)
    return resizeMenuImage(file)
  }
}

function resizeMenuImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, MENU_IMAGE_MAX_SIZE / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Khong the doc anh mon.'))
    }
    image.src = objectUrl
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SetCard({ set, active, onClick, onActivate }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
        active
          ? 'border-emerald-300 bg-emerald-50/60 ring-1 ring-emerald-200'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen size={14} className={active ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'} />
          <p className={`text-sm font-semibold truncate ${active ? 'text-emerald-800' : 'text-slate-700'}`}>
            {set.name}
          </p>
        </div>
        {set.is_active
          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white shrink-0">Đang dùng</span>
          : <span
              onClick={(e) => { e.stopPropagation(); onActivate(set.id) }}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors shrink-0"
            >
              Dùng menu
            </span>
        }
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
        <span>{MENU_TYPES.find((t) => t.value === set.type)?.label || set.type}</span>
        <span>·</span>
        <span>{set.available_count ?? 0}/{set.item_count ?? 0} món</span>
      </div>
    </button>
  )
}

function AddItemModal({
  categories,
  errors,
  imagePreview,
  inputCls,
  item,
  onChange,
  onClose,
  onFileChange,
  onSave,
  saving,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">Thêm món</h3>
            <p className="text-xs text-slate-400 mt-0.5">Thông tin món và ảnh hiển thị trên menu</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-5">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Ảnh món</span>
            <div className="aspect-square rounded-2xl border border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-emerald-300 transition-colors">
              {imagePreview || item.imageUrl ? (
                <img src={imagePreview || item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-400">
                  <Upload size={22} className="mx-auto mb-2" />
                  <span className="text-xs font-medium">Chọn ảnh</span>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" onChange={onFileChange} className="hidden" />
            {errors.image && <p className="mt-2 text-xs font-medium text-red-500">{errors.image}</p>}
          </label>

          <div className="space-y-3">
            <div>
              <input
                value={item.name}
                onChange={(e) => onChange({ ...item, name: e.target.value })}
                placeholder="Tên món *"
                className={inputCls + ' w-full'}
              />
              {errors.name && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.name}</p>}
            </div>
            <div>
              <Select
                value={item.category}
                onChange={(category) => onChange({ ...item, category })}
                options={categories}
                placeholder="Chọn danh mục *"
              />
              {errors.category && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.category}</p>}
            </div>
            <div>
              <input
                type="number"
                value={item.price}
                onChange={(e) => onChange({ ...item, price: e.target.value })}
                placeholder="Giá (đ) *"
                className={inputCls + ' w-full'}
              />
              {errors.price && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.price}</p>}
            </div>
            <div>
              <input
                value={item.description}
                onChange={(e) => onChange({ ...item, description: e.target.value })}
                placeholder="Mô tả (tuỳ chọn)"
                className={inputCls + ' w-full'}
              />
            </div>
            <div>
              <input
                value={item.imageUrl}
                onChange={(e) => onChange({ ...item, imageUrl: e.target.value })}
                placeholder="Hoặc dán URL ảnh"
                className={inputCls + ' w-full'}
              />
              {errors.imageUrl && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.imageUrl}</p>}
            </div>
            {errors.form && <p className="text-xs font-medium text-red-500">{errors.form}</p>}
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={item.available}
                onChange={(e) => onChange({ ...item, available: e.target.checked })}
                className="accent-emerald-600"
              />
              Đang bán
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <Plus size={15} />
            {saving ? 'Đang lưu...' : 'Thêm món'}
          </button>
        </div>
      </div>

    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MenuSettings() {
  const [sets, setSets] = useState([])
  const [selectedSetId, setSelectedSetId] = useState(null)
  const [items, setItems] = useState([])
  const [categoryRows, setCategoryRows] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [newItemErrors, setNewItemErrors] = useState({})
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemImage, setNewItemImage] = useState(null)
  const [newItemPreview, setNewItemPreview] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [editingItem, setEditingItem] = useState(EMPTY_ITEM)
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryError, setNewCategoryError] = useState('')
  const [importMode, setImportMode] = useState('append')
  const [showNewSet, setShowNewSet] = useState(false)
  const [newSet, setNewSet] = useState({ name: '', type: 'regular', description: '' })
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef(null)

  const selectedSet = sets.find((s) => s.id === selectedSetId)
  const categories = useMemo(
    () => categoryRows.map((category) => category.name),
    [categoryRows]
  )
  const filteredItems = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory)
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE))
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE
  const pageEnd = Math.min(pageStart + ITEMS_PER_PAGE, filteredItems.length)
  const paginatedItems = filteredItems.slice(pageStart, pageEnd)

  const toast = (msg) => { setStatus(msg); setTimeout(() => setStatus(''), 2500) }

  const loadSets = async () => {
    const data = await api.get('/menu/sets')
    setSets(data.sets || [])
    setSelectedSetId((cur) => cur || data.sets?.[0]?.id || null)
  }

  const loadItems = async (setId) => {
    if (!setId) { setItems([]); setCategoryRows([]); return }
    const data = await api.get(`/menu/sets/${setId}/items`)
    setItems(data.items || [])
    setCategoryRows(data.categoryRows || [])
  }

  useEffect(() => {
    setLoading(true)
    loadSets().catch((e) => toast(e.message)).finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadItems(selectedSetId).catch((e) => toast(e.message)) }, [selectedSetId])

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSetId, activeCategory])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  useEffect(() => {
    return () => {
      if (newItemPreview) URL.revokeObjectURL(newItemPreview)
    }
  }, [newItemPreview])

  const refresh = async (setId = selectedSetId) => {
    await loadSets(); await loadItems(setId); await fetchMenu()
  }

  const handleAddCategory = async () => {
    const cat = newCategory.trim()
    setNewCategoryError('')
    if (!selectedSetId) { setNewCategoryError('Chọn bộ menu trước.'); return }
    if (!cat) { setNewCategoryError('Nhập tên danh mục.'); return }
    if (categories.some((c) => c.toLowerCase() === cat.toLowerCase())) {
      setNewCategoryError('Danh mục đã có.')
      return
    }

    try {
      const data = await api.post(`/menu/sets/${selectedSetId}/categories`, { name: cat })
      setCategoryRows((prev) => [...prev, { ...data.category, item_count: 0 }])
      setNewItem((p) => ({ ...p, category: cat }))
      setActiveCategory(cat)
      setNewCategory('')
    } catch (err) {
      setNewCategoryError(err.message || 'Không thêm được danh mục.')
    }
  }

  const handleCreateSet = async () => {
    if (!newSet.name.trim()) { toast('Nhập tên bộ menu.'); return }
    const data = await api.post('/menu/sets', newSet)
    setNewSet({ name: '', type: 'regular', description: '' })
    setShowNewSet(false)
    setSelectedSetId(data.set.id)
    await refresh(data.set.id)
    toast('Đã tạo bộ menu.')
  }

  const handleActivateSet = async (setId) => {
    await api.post(`/menu/sets/${setId}/activate`, {})
    setSelectedSetId(setId)
    await refresh(setId)
    toast('Đã kích hoạt menu.')
  }

  const handleAddItem = async () => {
    const price = Number(newItem.price)
    const errors = {}
    if (!selectedSetId) errors.form = 'Chọn bộ menu trước khi thêm món.'
    if (!newItem.name.trim()) errors.name = 'Nhập tên món.'
    if (!newItem.category) errors.category = 'Chọn danh mục cho món.'
    if (!newItem.price) errors.price = 'Nhập giá món.'
    else if (!Number.isFinite(price) || price <= 0) errors.price = 'Giá phải lớn hơn 0.'
    if (newItemImage && !newItemImage.type.startsWith('image/')) {
      errors.image = 'File ảnh không hợp lệ.'
    }

    setNewItemErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSavingItem(true)
    try {
      const imageUrl = newItemImage ? await uploadMenuImageWithFallback(newItemImage) : newItem.imageUrl
      await api.post(`/menu/sets/${selectedSetId}/items`, { ...newItem, imageUrl, price })
      setNewItem(EMPTY_ITEM)
      setNewItemErrors({})
      setNewItemImage(null)
      setShowAddItem(false)
      await refresh()
    } catch (err) {
      setNewItemErrors({ form: err.message || 'Không thêm được món.' })
    } finally {
      setSavingItem(false)
    }
  }

  const handleNewItemFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNewItemErrors((prev) => ({ ...prev, image: '' }))
    setNewItemImage(file)
    setNewItemPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleSaveItem = async () => {
    await api.patch(`/menu/${editingItemId}`, { ...editingItem, price: Number(editingItem.price) })
    setEditingItemId(null)
    await refresh()
    toast('Đã lưu.')
  }

  const handleToggle = async (item) => {
    await api.patch(`/menu/${item.id}`, { available: !item.available })
    await refresh()
  }

  const handleDownloadTemplate = () => {
    import('xlsx').then((XLSX) => {
      const rows = [
        { 'Tên món': 'Gỏi cuốn', 'Danh mục': 'Đồ nhắm', 'Giá': 65000, 'Mô tả': 'Rau tươi, tôm thịt', 'Ảnh': '', 'Đang bán': 'Có' },
        { 'Tên món': 'Bia Tiger', 'Danh mục': 'Đồ uống', 'Giá': 30000, 'Mô tả': 'Lon/chai', 'Ảnh': '', 'Đang bán': 'Có' },
        { 'Tên món': 'Lẩu Thái', 'Danh mục': 'Nhậu chính', 'Giá': 280000, 'Mô tả': 'Size vừa', 'Ảnh': '', 'Đang bán': 'Có' },
      ]
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Menu')
      XLSX.writeFile(wb, 'staffos-menu-mau.xlsx')
    }).catch(() => toast('Lỗi tạo file Excel.'))
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedSetId) return
    try {
      const parsed = await parseWorkbook(file)
      const data = await api.post(`/menu/sets/${selectedSetId}/import`, { mode: importMode, items: parsed })
      await refresh()
      toast(`Đã import ${data.insertedCount} món${data.skippedCount ? `, bỏ qua ${data.skippedCount}` : ''}.`)
    } catch (err) { toast(err.message || 'Import thất bại.') }
  }

  const inputCls = 'border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white'

  return (
    <div className="h-full overflow-hidden p-6 lg:p-8 fade-in flex flex-col gap-5">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0">
          <div>
            <p className="text-xs text-slate-400">Bộ menu · Danh mục · Món ăn</p>
            {status && (
              <p className="text-xs font-medium text-emerald-700 mt-1">
                {status}
              </p>
            )}
          </div>
        <div />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm flex-shrink-0">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,360px)_1fr] gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bộ menu</p>
              <button
                onClick={() => setShowNewSet((v) => !v)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <Plus size={12} />
                Tạo bộ
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedSetId || ''}
                onChange={(value) => setSelectedSetId(value ? Number(value) : null)}
                options={sets.map((set) => ({
                  value: set.id,
                  label: `${set.name}${set.is_active ? ' - Đang dùng' : ''}`,
                }))}
                placeholder={loading ? 'Đang tải...' : 'Chọn bộ menu'}
                className="flex-1 min-w-0"
                disabled={loading}
              />
              {selectedSet && !selectedSet.is_active && (
                <button
                  onClick={() => handleActivateSet(selectedSet.id)}
                  className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  Dùng menu
                </button>
              )}
            </div>
            {selectedSet && (
              <p className="text-xs text-slate-400">
                {MENU_TYPES.find((t) => t.value === selectedSet.type)?.label || selectedSet.type} · {selectedSet.available_count ?? 0}/{selectedSet.item_count ?? 0} món
              </p>
            )}
            {showNewSet && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto_auto] gap-2">
                <input
                  value={newSet.name}
                  onChange={(e) => setNewSet({ ...newSet, name: e.target.value })}
                  placeholder="Tên bộ menu"
                  className={inputCls}
                />
                <Select
                  value={newSet.type}
                  onChange={(type) => setNewSet({ ...newSet, type })}
                  options={MENU_TYPES}
                />
                <button onClick={handleCreateSet} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Tạo</button>
                <button onClick={() => setShowNewSet(false)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-semibold hover:bg-slate-200">Hủy</button>
              </div>
            )}
          </div>

          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Danh mục</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveCategory('all')}
                className={`h-9 px-3 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                  activeCategory === 'all' ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Tất cả</span>
                <span className="text-xs text-slate-400">{items.length}</span>
              </button>
              {categoryRows.map((category) => {
                const cat = category.name
                const count = category.item_count ?? items.filter((i) => i.category === cat).length
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`h-9 px-3 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                      activeCategory === cat ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="max-w-[160px] truncate">{cat}</span>
                    <span className="text-xs text-slate-400 shrink-0">{count}</span>
                  </button>
                )
              })}
              <div className="flex items-center gap-1.5">
                <input
                  value={newCategory}
                  onChange={(e) => {
                    setNewCategory(e.target.value)
                    if (newCategoryError) setNewCategoryError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  placeholder="Thêm danh mục..."
                  className="h-9 w-44 border border-slate-200 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-white"
                />
                <button onClick={handleAddCategory} className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 flex items-center justify-center">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            {newCategoryError && (
              <p className="text-xs font-medium text-red-500">{newCategoryError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 truncate">
            {selectedSet?.name || 'Chọn bộ menu'}
          </p>
          <span className="text-xs text-slate-400">
            {filteredItems.length} món{activeCategory !== 'all' ? ` · ${activeCategory}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddItem(true)}
                disabled={!selectedSetId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={13} />
                Thêm món
              </button>
              <Select
                value={importMode}
                onChange={setImportMode}
                options={[
                  { value: 'append', label: 'Import thêm' },
                  { value: 'replace', label: 'Thay thế' },
                ]}
                className="w-32"
                buttonClassName="h-8 rounded-xl px-2.5 text-xs shadow-none"
              />
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                <Download size={13} />
                Excel mẫu
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedSetId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Upload size={13} />
                Import
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16">
                <p className="text-3xl mb-3">🍽️</p>
                <p className="text-slate-500 font-medium text-sm">
                  {selectedSetId ? 'Chưa có món nào' : 'Chọn bộ menu để xem'}
                </p>
                <p className="text-slate-400 text-xs mt-1">Thêm món thủ công hoặc import Excel</p>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <table className="w-full text-sm table-fixed">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10">
                      <tr className="border-b border-slate-100">
                        <th className="w-[34%] text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tên món</th>
                        <th className="w-[22%] text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Danh mục</th>
                        <th className="w-[16%] text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Giá</th>
                        <th className="w-[16%] text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Trạng thái</th>
                        <th className="w-[12%] px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedItems.map((item) => {
                    const editing = editingItemId === item.id
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                        {editing ? (
                          <>
                            <td className="px-4 py-2.5">
                              <input
                                value={editingItem.name}
                                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                className={inputCls + ' w-full'}
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <Select
                                value={editingItem.category}
                                onChange={(category) => setEditingItem({ ...editingItem, category })}
                                options={categories}
                                placeholder="Chọn danh mục"
                              />
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number"
                                value={editingItem.price}
                                onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                className={inputCls + ' w-28 text-right'}
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <label className="flex items-center justify-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={editingItem.available}
                                  onChange={(e) => setEditingItem({ ...editingItem, available: e.target.checked })}
                                  className="accent-emerald-600"
                                />
                                <span className="text-xs text-slate-500">Bán</span>
                              </label>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={handleSaveItem} className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                                  <Save size={13} />
                                </button>
                                <button onClick={() => setEditingItemId(null)} className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                                  <X size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center text-slate-300">
                                  {item.imageUrl
                                    ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                    : <span className="text-lg">🍽️</span>
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-800 leading-tight truncate">{item.name}</p>
                                  {item.description && (
                                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[220px]">{item.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                                {item.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                              {formatPrice(item.price)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleToggle(item)}
                                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                  item.available
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                }`}
                              >
                                {item.available ? 'Đang bán' : 'Ẩn'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => { setEditingItemId(item.id); setEditingItem({ name: item.name, category: item.category, price: item.price, description: item.description || '', imageUrl: item.imageUrl || '', available: item.available }) }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                >
                                  <Pencil size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 bg-white">
                  <p className="text-xs text-slate-400">
                    Hiển thị {pageStart + 1}-{pageEnd} trong {filteredItems.length} món
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                    >
                      Trước
                    </button>
                    <span className="min-w-20 text-center text-xs font-semibold text-slate-500">
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

      {showAddItem && (
        <AddItemModal
          categories={categories}
          errors={newItemErrors}
          imagePreview={newItemPreview}
          inputCls={inputCls}
          item={newItem}
          onChange={setNewItem}
          onClose={() => {
            setShowAddItem(false)
            setNewItemErrors({})
          }}
          onFileChange={handleNewItemFile}
          onSave={handleAddItem}
          saving={savingItem}
        />
      )}
    </div>
  )
}
