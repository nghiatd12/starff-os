/**
 * Format số tiền VND: 280000 → "280.000đ"
 */
export const formatCurrency = (amount) =>
  Number(amount || 0).toLocaleString('vi-VN') + 'đ'

/**
 * Format rút gọn: 3200000 → "3.2tr" | 280000 → "280k"
 */
export const formatShort = (amount) => {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + 'tr'
  if (amount >= 1_000)     return (amount / 1_000).toFixed(0) + 'k'
  return String(amount)
}
