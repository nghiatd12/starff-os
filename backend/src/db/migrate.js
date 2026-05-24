import 'dotenv/config'
import pool from './pool.js'

/**
 * Database Migration — tạo tất cả bảng cho StaffOS
 * Chạy: npm run db:migrate
 */
async function migrate() {
  console.log('🗄️  Running migrations...\n')

  await pool.query(`
    -- ============================================
    -- 1. TENANTS (Quán)
    -- ============================================
    CREATE TABLE IF NOT EXISTS tenants (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(255) NOT NULL,
      slug          VARCHAR(100) UNIQUE NOT NULL,
      address       TEXT,
      phone         VARCHAR(20),
      type          VARCHAR(50) DEFAULT 'beer',
      table_count   INT DEFAULT 15,
      plan          VARCHAR(20) DEFAULT 'starter',
      created_at    TIMESTAMP DEFAULT NOW()
    );

    -- ============================================
    -- 2. USERS (Tài khoản đăng nhập)
    -- ============================================
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name          VARCHAR(255) NOT NULL,
      phone         VARCHAR(20) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          VARCHAR(20) NOT NULL DEFAULT 'waiter',
      pin           VARCHAR(6),
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

    -- ============================================
    -- 3. TABLES (Bàn)
    -- ============================================
    CREATE TABLE IF NOT EXISTS tables (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name          VARCHAR(50) NOT NULL,
      zone          VARCHAR(50) DEFAULT 'indoor',
      capacity      INT DEFAULT 4,
      status        VARCHAR(20) DEFAULT 'empty',
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables(tenant_id);

    -- ============================================
    -- 4. MENU ITEMS (Thực đơn)
    -- ============================================
    CREATE TABLE IF NOT EXISTS menu_sets (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name          VARCHAR(255) NOT NULL,
      type          VARCHAR(50) DEFAULT 'regular',
      description   TEXT,
      is_active     BOOLEAN DEFAULT false,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE (tenant_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_menu_sets_tenant ON menu_sets(tenant_id);

    CREATE TABLE IF NOT EXISTS menu_categories (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      menu_set_id   INT REFERENCES menu_sets(id) ON DELETE CASCADE,
      name          VARCHAR(100) NOT NULL,
      sort_order    INT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE (tenant_id, menu_set_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_menu_categories_set ON menu_categories(tenant_id, menu_set_id);

    CREATE TABLE IF NOT EXISTS menu_items (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      menu_set_id   INT REFERENCES menu_sets(id) ON DELETE SET NULL,
      name          VARCHAR(255) NOT NULL,
      category      VARCHAR(100) NOT NULL,
      price         INT NOT NULL,
      description   TEXT,
      image_url     TEXT,
      available     BOOLEAN DEFAULT true,
      sort_order    INT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_menu_tenant ON menu_items(tenant_id);

    -- ============================================
    -- 5. ORDERS (Đơn hàng)
    -- ============================================
    CREATE TABLE IF NOT EXISTS orders (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      table_id      INT REFERENCES tables(id),
      user_id       INT REFERENCES users(id),
      status        VARCHAR(20) DEFAULT 'open',
      total         INT DEFAULT 0,
      guest_count   INT DEFAULT 1,
      note          TEXT,
      created_at    TIMESTAMP DEFAULT NOW(),
      closed_at     TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    -- ============================================
    -- 6. ORDER ITEMS (Món trong đơn)
    -- ============================================
    CREATE TABLE IF NOT EXISTS order_items (
      id            SERIAL PRIMARY KEY,
      order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id  INT REFERENCES menu_items(id),
      name          VARCHAR(255) NOT NULL,
      price         INT NOT NULL,
      quantity      INT DEFAULT 1,
      note          TEXT,
      status        VARCHAR(20) DEFAULT 'pending',
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

    -- ============================================
    -- 7. EMPLOYEES (Nhân viên — mở rộng từ users)
    -- ============================================
    CREATE TABLE IF NOT EXISTS employees (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_id       INT REFERENCES users(id),
      name          VARCHAR(255) NOT NULL,
      phone         VARCHAR(20),
      position      VARCHAR(50) NOT NULL,
      hourly_wage   INT DEFAULT 0,
      start_date    DATE,
      is_active     BOOLEAN DEFAULT true,
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);

    -- ============================================
    -- 8. CUSTOMERS (Khách hàng thân thiết)
    -- ============================================
    CREATE TABLE IF NOT EXISTS customers (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      name          VARCHAR(255) NOT NULL,
      phone         VARCHAR(20),
      birthday      VARCHAR(10),
      tier          VARCHAR(20) DEFAULT 'Đồng',
      points        INT DEFAULT 0,
      total_spent   INT DEFAULT 0,
      visit_count   INT DEFAULT 0,
      last_visit    TIMESTAMP,
      created_at    TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `)

  await pool.query(`
    DO $$
    DECLARE
      had_status BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'status'
      ) INTO had_status;

      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS registered_by VARCHAR(20) DEFAULT 'self';

      IF NOT had_status THEN
        UPDATE tenants SET status = 'active';
      END IF;
    END $$;
  `)

  await pool.query(`
    ALTER TABLE menu_items
      ADD COLUMN IF NOT EXISTS menu_set_id INT REFERENCES menu_sets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS image_url TEXT;

    INSERT INTO menu_sets (tenant_id, name, type, description, is_active)
    SELECT t.id, 'Menu mặc định', 'regular', 'Bộ menu được tạo tự động từ dữ liệu hiện có', true
    FROM tenants t
    WHERE NOT EXISTS (
      SELECT 1 FROM menu_sets ms WHERE ms.tenant_id = t.id
    );

    UPDATE menu_items mi
    SET menu_set_id = ms.id
    FROM menu_sets ms
    WHERE mi.tenant_id = ms.tenant_id
      AND mi.menu_set_id IS NULL
      AND ms.is_active = true;

    CREATE INDEX IF NOT EXISTS idx_menu_set ON menu_items(tenant_id, menu_set_id);

    CREATE TABLE IF NOT EXISTS menu_categories (
      id            SERIAL PRIMARY KEY,
      tenant_id     INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      menu_set_id   INT REFERENCES menu_sets(id) ON DELETE CASCADE,
      name          VARCHAR(100) NOT NULL,
      sort_order    INT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW(),
      updated_at    TIMESTAMP DEFAULT NOW(),
      UNIQUE (tenant_id, menu_set_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_menu_categories_set ON menu_categories(tenant_id, menu_set_id);

    INSERT INTO menu_categories (tenant_id, menu_set_id, name, sort_order)
    SELECT tenant_id, menu_set_id, category, MIN(sort_order)
    FROM menu_items
    WHERE menu_set_id IS NOT NULL
      AND category IS NOT NULL
      AND TRIM(category) <> ''
    GROUP BY tenant_id, menu_set_id, category
    ON CONFLICT (tenant_id, menu_set_id, name) DO NOTHING;
  `)

  await pool.query(`
    UPDATE tenants
    SET
      name = 'Quán Cậu Út',
      slug = 'quan-cau-ut'
    WHERE slug = 'bia-garden-q7'
       OR name = 'Bia Garden Q7';
  `)

  console.log('✅ All tables created successfully!')
  await pool.end()
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message)
  process.exit(1)
})
