import { query, queryAll, queryOne } from './db/pool.js'

export const ROLES = ['owner', 'manager', 'waiter', 'kitchen', 'cashier']
export const SCREENS = ['dashboard', 'tables', 'order', 'kitchen', 'cashier', 'qr-menu', 'menu', 'staff', 'customers', 'settings']

export const DEFAULT_SCREEN_PERMISSIONS = {
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

export function defaultPermissionRows(tenantId) {
  const rows = []
  for (const screen of SCREENS) {
    for (const role of ROLES) {
      rows.push({
        tenantId,
        role,
        screen,
        allowed: DEFAULT_SCREEN_PERMISSIONS[screen]?.includes(role) || false,
      })
    }
  }
  return rows
}

export async function ensureTenantPermissions(tenantId) {
  const values = []
  const placeholders = []
  let index = 1

  for (const row of defaultPermissionRows(tenantId)) {
    placeholders.push(`($${index++}, $${index++}, $${index++}, $${index++})`)
    values.push(row.tenantId, row.role, row.screen, row.allowed)
  }

  await query(
    `INSERT INTO role_permissions (tenant_id, role, screen, allowed)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (tenant_id, role, screen) DO NOTHING`,
    values
  )
}

export async function getTenantPermissions(tenantId) {
  await ensureTenantPermissions(tenantId)
  const rows = await queryAll(
    `SELECT role, screen, allowed
     FROM role_permissions
     WHERE tenant_id = $1
     ORDER BY role, screen`,
    [tenantId]
  )

  return rows.reduce((matrix, row) => {
    if (!matrix[row.role]) matrix[row.role] = {}
    matrix[row.role][row.screen] = row.allowed
    return matrix
  }, {})
}

export async function getUserAllowedScreens(tenantId, role) {
  if (role === 'owner') return SCREENS
  await ensureTenantPermissions(tenantId)
  const rows = await queryAll(
    `SELECT screen
     FROM role_permissions
     WHERE tenant_id = $1 AND role = $2 AND allowed = true
     ORDER BY CASE screen
       WHEN 'dashboard' THEN 1
       WHEN 'tables' THEN 2
       WHEN 'order' THEN 3
       WHEN 'kitchen' THEN 4
       WHEN 'cashier' THEN 5
       WHEN 'qr-menu' THEN 6
       WHEN 'menu' THEN 7
       WHEN 'staff' THEN 8
       WHEN 'customers' THEN 9
       WHEN 'settings' THEN 10
       ELSE 99
     END`,
    [tenantId, role]
  )
  return rows.map((row) => row.screen)
}

export async function roleCanAccessScreens(tenantId, role, screens) {
  if (role === 'owner') return true
  await ensureTenantPermissions(tenantId)
  const row = await queryOne(
    `SELECT 1
     FROM role_permissions
     WHERE tenant_id = $1
       AND role = $2
       AND screen = ANY($3::text[])
       AND allowed = true
     LIMIT 1`,
    [tenantId, role, screens]
  )
  return Boolean(row)
}
