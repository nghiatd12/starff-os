const PAYMENT_SETTINGS_KEY = 'staffos_payment_settings'

const DEFAULT_PAYMENT_SETTINGS = {
  qrImage: '',
  qrName: '',
  qrNote: '',
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
