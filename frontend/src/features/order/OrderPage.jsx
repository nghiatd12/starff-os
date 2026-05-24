import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useTables, useMenu } from '@/lib/useStore'
import { fetchOrders } from '@/lib/store'
import MenuGrid from './components/MenuGrid'
import OrderSummary from './components/OrderSummary'
import Select from '@/components/ui/Select'

export default function OrderPage() {
  const { menu: menuData, categories, loading: menuLoading } = useMenu()
  const { tables, loading: tablesLoading } = useTables()
  const loading = menuLoading && tablesLoading

  const [activeCategory, setActiveCategory] = useState('')
  const [selectedTable, setSelectedTable] = useState('')
  const [orderItems, setOrderItems] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  // Set defaults once data is loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0])
    }
  }, [categories, activeCategory])

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      const occupiedTable = tables.find((t) => t.status !== 'empty')
      setSelectedTable(occupiedTable ? occupiedTable.name : tables[0]?.name || '')
    }
  }, [loading, tables, selectedTable])

  const addItem = (item) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1, note: '' }]
    })
  }

  const changeQty = (id, delta) => {
    setOrderItems((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
        .filter((i) => i.qty > 0)
    )
  }

  const changeNote = (id, note) => {
    setOrderItems((prev) =>
      prev.map((i) => i.id === id ? { ...i, note } : i)
    )
  }

  const handleSubmit = async () => {
    if (orderItems.length === 0) return

    const table = tables.find((t) => t.name === selectedTable)
    if (!table) {
      setNotice({ tone: 'error', text: 'Vui lòng chọn bàn trước khi gửi món.' })
      return
    }

    setSubmitting(true)
    setNotice(null)
    try {
      await api.post('/orders', {
        tableId: table.id,
        guestCount: table.guests || 1,
        items: orderItems.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.qty,
          note: item.note || '',
        })),
      })
      setNotice({ tone: 'success', text: `Đã gửi ${orderItems.length} món xuống bếp cho ${selectedTable}.` })
      setOrderItems([])
      // Refresh orders store cho KDS
      fetchOrders()
    } catch (err) {
      setNotice({ tone: 'error', text: err.message || 'Không gửi được món.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full fade-in items-center justify-center">
        <p className="text-slate-400 text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full fade-in">
      {/* Left: Menu */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 lg:p-6 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-400">Chọn món và gửi xuống bếp</p>
              {notice && (
                <p className={`mt-2 inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold ${
                  notice.tone === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-600'
                }`}>
                  {notice.text}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Bàn:</span>
              <Select
                value={selectedTable}
                onChange={setSelectedTable}
                options={tables.filter((t) => t.status !== 'empty').map((t) => ({ value: t.name, label: t.name }))}
                placeholder="Chọn bàn"
                className="w-40"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  activeCategory === cat
                    ? 'bg-brand-500 text-white shadow-soft shadow-brand-200'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div className="flex-1 overflow-y-auto p-5 lg:p-6 bg-slate-50/50">
          <MenuGrid
            items={menuData[activeCategory] ?? []}
            orderItems={orderItems}
            onAdd={addItem}
            onChangeQty={changeQty}
          />
        </div>
      </div>

      {/* Right: Summary */}
      <OrderSummary
        selectedTable={selectedTable}
        orderItems={orderItems}
        onChangeQty={changeQty}
        onChangeNote={changeNote}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  )
}
