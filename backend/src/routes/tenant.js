import { Router } from 'express'
import { queryOne } from '../db/pool.js'
import { authenticate, authorizeScreens } from '../middleware/auth.js'

const router = Router()

function publicTenant(tenant) {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    address: tenant.address || '',
    phone: tenant.phone || '',
  }
}

router.get('/', authenticate, authorizeScreens('settings'), async (req, res) => {
  try {
    const tenant = await queryOne(
      `SELECT id, name, slug, address, phone
       FROM tenants
       WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.tenantId]
    )
    if (!tenant) return res.status(404).json({ error: 'Không tìm thấy quán' })
    res.json({ tenant: publicTenant(tenant) })
  } catch (err) {
    console.error('[Tenant] Get tenant error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

router.patch('/', authenticate, authorizeScreens('settings'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const address = String(req.body.address || '').trim()
    const phone = String(req.body.phone || '').trim()

    if (!name) return res.status(400).json({ error: 'Nhập tên nhà hàng' })

    const tenant = await queryOne(
      `UPDATE tenants
       SET name = $1, address = $2, phone = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, name, slug, address, phone`,
      [name, address, phone, req.user.tenantId]
    )
    if (!tenant) return res.status(404).json({ error: 'Không tìm thấy quán' })
    res.json({ tenant: publicTenant(tenant) })
  } catch (err) {
    console.error('[Tenant] Update tenant error:', err)
    res.status(500).json({ error: 'Lỗi server' })
  }
})

export default router
