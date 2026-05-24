import 'dotenv/config'
import bcrypt from 'bcrypt'
import pool from './pool.js'

/**
 * Seed data — tạo dữ liệu mẫu cho dev
 * Chạy: npm run db:seed
 */
async function seed() {
  console.log('🌱 Seeding database...\n')

  // 1. Tạo quán mẫu
  const { rows: [tenant] } = await pool.query(`
    INSERT INTO tenants (name, slug, address, phone, type, table_count)
    VALUES ('Quán Cậu Út', 'quan-cau-ut', '123 Nguyễn Huệ, Q.7, TP.HCM', '0901234567', 'beer', 15)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `)
  const tenantId = tenant.id
  console.log(`✅ Tenant: Quán Cậu Út (id: ${tenantId})`)

  // 2. Tạo tài khoản chủ quán
  const ownerHash = await bcrypt.hash('123456', 10)
  await pool.query(`
    INSERT INTO users (tenant_id, name, phone, password_hash, role)
    VALUES ($1, 'Nguyễn Văn An', '0901234567', $2, 'owner')
    ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, [tenantId, ownerHash])
  console.log('✅ Owner: 0901234567 / 123456')

  // 3. Tạo nhân viên mẫu
  const staffPin = await bcrypt.hash('1234', 10)
  const staffData = [
    ['Trần Thị Bích', '0912345678', 'waiter', '1234'],
    ['Lê Văn Cường', '0923456789', 'waiter', '2345'],
    ['Phạm Thị Dung', '0934567890', 'cashier', '3456'],
    ['Hoàng Văn Em', '0945678901', 'kitchen', '4567'],
  ]
  for (const [name, phone, role, pin] of staffData) {
    const hash = await bcrypt.hash(pin, 10)
    await pool.query(`
      INSERT INTO users (tenant_id, name, phone, password_hash, role, pin)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (phone) DO NOTHING
    `, [tenantId, name, phone, hash, role, pin])
  }
  console.log('✅ Staff: 4 nhân viên (PIN: 1234, 2345, 3456, 4567)')

  // 4. Tạo bàn
  for (let i = 1; i <= 15; i++) {
    const zone = i <= 8 ? 'indoor' : i <= 12 ? 'outdoor' : 'vip'
    const name = i <= 12 ? `Bàn ${i}` : `VIP ${i - 12}`
    await pool.query(`
      INSERT INTO tables (tenant_id, name, zone, capacity)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [tenantId, name, zone, i > 12 ? 8 : 4])
  }
  console.log('✅ Tables: 15 bàn (8 indoor, 4 outdoor, 3 VIP)')

  // 5. Tạo menu
  const { rows: [defaultMenuSet] } = await pool.query(`
    INSERT INTO menu_sets (tenant_id, name, type, description, is_active)
    VALUES ($1, 'Menu ngày thường', 'regular', 'Menu bán hằng ngày', true)
    ON CONFLICT (tenant_id, name) DO UPDATE
      SET is_active = true, updated_at = NOW()
    RETURNING id
  `, [tenantId])

  const menuData = [
    ['Nhậu chính', 'Lẩu Thái', 280000],
    ['Nhậu chính', 'Lẩu mắm', 260000],
    ['Nhậu chính', 'Gà nướng muối ớt', 180000],
    ['Nhậu chính', 'Sườn nướng', 160000],
    ['Nhậu chính', 'Cá chép nướng', 220000],
    ['Nhậu chính', 'Tôm nướng muối', 200000],
    ['Đồ nhắm', 'Nem nướng', 85000],
    ['Đồ nhắm', 'Gỏi cuốn', 65000],
    ['Đồ nhắm', 'Đậu phụ chiên', 45000],
    ['Đồ nhắm', 'Mực chiên giòn', 95000],
    ['Đồ nhắm', 'Chả giò', 70000],
    ['Đồ uống', 'Bia Tiger', 30000],
    ['Đồ uống', 'Bia Heineken', 35000],
    ['Đồ uống', 'Nước ngọt', 20000],
    ['Đồ uống', 'Trà đá', 10000],
    ['Đồ uống', 'Rượu vang đỏ', 120000],
    ['Đồ uống', 'Sinh tố xoài', 45000],
    ['Thêm', 'Cơm trắng', 10000],
    ['Thêm', 'Bánh mì', 15000],
    ['Thêm', 'Rau sống', 25000],
  ]
  for (const [category, name, price] of menuData) {
    await pool.query(`
      INSERT INTO menu_items (tenant_id, menu_set_id, category, name, price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [tenantId, defaultMenuSet.id, category, name, price])
  }
  console.log(`✅ Menu: ${menuData.length} món`)

  console.log('\n🎉 Seed complete! Ready to use.')
  console.log('   Login: 0901234567 / 123456 (Chủ quán)')
  console.log('   Staff: 0912345678 / 1234 (Phục vụ)\n')

  await pool.end()
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
