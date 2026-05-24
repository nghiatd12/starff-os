export const ROLE_LABELS = {
  owner: 'Chủ quán',
  manager: 'Quản lý',
  waiter: 'Phục vụ',
  kitchen: 'Bếp',
  cashier: 'Thu ngân',
}

export const SCREEN_PERMISSIONS = {
  dashboard: ['owner', 'manager'],
  tables: ['owner', 'manager', 'waiter', 'cashier'],
  order: ['owner', 'manager', 'waiter'],
  kitchen: ['owner', 'manager', 'kitchen'],
  cashier: ['owner', 'manager', 'cashier'],
  'qr-menu': ['owner', 'manager'],
  menu: ['owner', 'manager'],
  staff: ['owner', 'manager'],
  customers: ['owner', 'manager', 'cashier'],
  settings: ['owner'],
}

export function canAccessScreen(role, screen) {
  return Boolean(SCREEN_PERMISSIONS[screen]?.includes(role))
}

export function getAllowedScreens(role) {
  return Object.entries(SCREEN_PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([screen]) => screen)
}

export function getDefaultScreen(role) {
  return getAllowedScreens(role)[0] || 'dashboard'
}

export function filterNavByRole(items, role) {
  return items.filter((item) => canAccessScreen(role, item.id))
}
