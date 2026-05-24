import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { CreditCard } from '@/components/ui/Icon'
import TableList from './components/TableList'
import BillDetail from './components/BillDetail'
import CashierHistory from './components/CashierHistory'

export default function CashierPage() {
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTable, setSelectedTable] = useState(null)
  const [activeTab, setActiveTab] = useState('current')

  useEffect(() => {
    Promise.all([
      api.get('/tables').catch(() => null),
      api.get('/orders/billing').catch(() => null),
    ]).then(([tablesRes, ordersRes]) => {
      const allTables = tablesRes?.tables || []
      const billingOrders = ordersRes?.orders || []
      const tableIdsWithBill = new Set(billingOrders.map((order) => order.table_id))
      const openTables = allTables.filter((table) => tableIdsWithBill.has(table.id))
      setTables(openTables)
      setOrders(billingOrders)
      if (openTables.length > 0) {
        setSelectedTable(openTables[0])
      }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full fade-in items-center justify-center">
        <p className="text-slate-400 text-sm">Đang tải...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col fade-in">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-5 py-3">
        {[
          { id: 'current', label: 'Đang thanh toán' },
          { id: 'history', label: 'Lịch sử' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'history' ? (
        <CashierHistory />
      ) : (
      <div className="flex min-h-0 flex-1">
      <TableList
        tables={tables}
        orders={orders}
        selectedId={selectedTable?.id}
        onSelect={setSelectedTable}
      />

      {selectedTable ? (
        <BillDetail
          table={selectedTable}
          orders={orders}
          onPaid={(tableId) => {
            // Xóa bàn khỏi danh sách sau khi thanh toán
            setTables((prev) => prev.filter((t) => t.id !== tableId))
            setOrders((prev) => prev.filter((o) => o.table_id !== tableId))
            setSelectedTable(null)
          }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <CreditCard size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium">Chọn bàn để xem hóa đơn</p>
          </div>
        </div>
      )}
      </div>
      )}
    </div>
  )
}
