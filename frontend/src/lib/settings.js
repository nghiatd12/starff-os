const PAYMENT_SETTINGS_KEY = 'staffos_payment_settings'

const DEFAULT_PAYMENT_SETTINGS = {
  qrMode: 'upload',
  qrImage: '',
  qrName: '',
  qrNote: '',
  bankCode: '',
  accountNumber: '',
  accountName: '',
  qrTemplate: 'compact2',
}

export function getPaymentSettings() {
  try {
    const raw = localStorage.getItem(PAYMENT_SETTINGS_KEY)
    if (!raw) return DEFAULT_PAYMENT_SETTINGS
    return { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PAYMENT_SETTINGS
  }
}

export function savePaymentSettings(settings) {
  const nextSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...settings }
  localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(nextSettings))
  window.dispatchEvent(new CustomEvent('staffos-payment-settings-change', { detail: nextSettings }))
  return nextSettings
}

export function subscribePaymentSettings(callback) {
  const handleCustomChange = (event) => callback(event.detail || getPaymentSettings())
  const handleStorage = (event) => {
    if (event.key === PAYMENT_SETTINGS_KEY) callback(getPaymentSettings())
  }

  window.addEventListener('staffos-payment-settings-change', handleCustomChange)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener('staffos-payment-settings-change', handleCustomChange)
    window.removeEventListener('storage', handleStorage)
  }
}

export function getPaymentQrImageUrl(settings, { amount, billCode } = {}) {
  const mergedSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...settings }
  if (mergedSettings.qrMode !== 'vietqr') return mergedSettings.qrImage
  if (!mergedSettings.bankCode || !mergedSettings.accountNumber) return ''

  const params = new URLSearchParams()
  if (amount > 0) params.set('amount', String(Math.round(amount)))
  if (billCode) params.set('addInfo', `Thanh toan ${billCode}`)
  if (mergedSettings.accountName) params.set('accountName', mergedSettings.accountName)

  const template = mergedSettings.qrTemplate || 'compact2'
  return `https://img.vietqr.io/image/${encodeURIComponent(mergedSettings.bankCode)}-${encodeURIComponent(mergedSettings.accountNumber)}-${template}.png?${params.toString()}`
}
