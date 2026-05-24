export function getTenantPrintInfo(user) {
  const name = user?.store || user?.store_name || 'Quán Cậu Út'
  return {
    name,
    address: user?.storeAddress || user?.store_address || '',
    phone: user?.storePhone || user?.store_phone || '',
    goodbye: `Hẹn gặp lại tại ${name}.`,
  }
}
