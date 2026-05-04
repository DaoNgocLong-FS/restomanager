-- =============================================================================
--  RestoManager - Database Schema (PostgreSQL)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── USERS / EMPLOYEES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin','cashier','waiter')),
    email         TEXT,
    phone         TEXT,
    avatar_url    TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MENU CATEGORIES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code       TEXT UNIQUE NOT NULL,    -- starter, main, drink ...
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MENU ITEMS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    emoji       TEXT,
    image_url   TEXT,                   -- MinIO public URL
    image_key   TEXT,                   -- MinIO object key
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TABLES (sơ đồ bàn) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tables (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code         TEXT UNIQUE NOT NULL,   -- T1-01, SV-02 ...
    zone         TEXT NOT NULL,          -- t1, garden ...
    capacity     INTEGER NOT NULL CHECK (capacity > 0),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ORDERS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL DEFAULT ('ORD-' || to_char(NOW(),'YYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,4)),
    table_id        UUID REFERENCES tables(id),
    table_code      TEXT NOT NULL,
    waiter_id       UUID REFERENCES users(id),
    waiter_name     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','serving','completed','cancelled')),
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    check_in_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time  TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_table_idx  ON orders(table_id);

-- ─── ORDER ITEMS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id  UUID REFERENCES menu_items(id),
    item_name     TEXT NOT NULL,
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    total_price   NUMERIC(12,2) NOT NULL,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INVOICES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT UNIQUE NOT NULL DEFAULT ('INV-' || to_char(NOW(),'YYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,4)),
    order_id        UUID NOT NULL UNIQUE REFERENCES orders(id),
    table_code      TEXT NOT NULL,
    waiter_name     TEXT NOT NULL,
    cashier_id      UUID REFERENCES users(id),
    cashier_name    TEXT NOT NULL,
    total_amount    NUMERIC(12,2) NOT NULL,
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_note   TEXT,
    vat_rate        NUMERIC(5,2)  NOT NULL DEFAULT 8,
    vat_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    final_amount    NUMERIC(12,2) NOT NULL,
    check_in_time   TIMESTAMPTZ NOT NULL,
    check_out_time  TIMESTAMPTZ NOT NULL,
    payment_method  TEXT NOT NULL DEFAULT 'cash'
                       CHECK (payment_method IN ('cash','card','transfer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices(created_at);
CREATE INDEX IF NOT EXISTS invoices_cashier_idx ON invoices(cashier_id);

-- ─── INVOICE ITEMS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    order_item_id UUID,
    item_name     TEXT NOT NULL,
    quantity      INTEGER NOT NULL,
    price         NUMERIC(12,2) NOT NULL,
    total_price   NUMERIC(12,2) NOT NULL,
    notes         TEXT
);

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES users(id),
    user_name   TEXT,
    action      TEXT NOT NULL,           -- LOGIN, CREATE_ORDER, CHECKOUT, ...
    entity      TEXT,                    -- ORDER, INVOICE, MENU, USER ...
    entity_id   TEXT,
    details     JSONB,
    ip          TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS logs_created_idx ON activity_logs(created_at);

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Default users (mật khẩu bcrypt cho '123' — sẽ được tạo lúc chạy seed JS)
-- Categories
INSERT INTO menu_categories (code,name,sort_order) VALUES
  ('starter','Khai vị',1),
  ('main','Món chính',2),
  ('drink','Đồ uống',3)
ON CONFLICT (code) DO NOTHING;

-- Tables
INSERT INTO tables (code,zone,capacity) VALUES
  ('T1-01','t1',4),('T1-02','t1',2),('T1-03','t1',4),
  ('T1-04','t1',6),('T1-05','t1',2),('T1-06','t1',4),
  ('SV-01','garden',6),('SV-02','garden',6),
  ('SV-03','garden',8),('SV-04','garden',4)
ON CONFLICT (code) DO NOTHING;

-- Menu items (link by category code)
INSERT INTO menu_items (name,description,price,emoji,category_id) VALUES
  ('Gỏi Cuốn Tôm Thịt','Tôm tươi, thịt ba chỉ, rau sống, nước chấm.',65000,'🌯',(SELECT id FROM menu_categories WHERE code='starter')),
  ('Chả Giò Hải Sản','Tôm, mực, cua, chiên vàng giòn rụm.',75000,'🥚',(SELECT id FROM menu_categories WHERE code='starter')),
  ('Phở Bò Kobe','Nước dùng 24h, thịt bò Kobe nhập khẩu.',250000,'🍜',(SELECT id FROM menu_categories WHERE code='main')),
  ('Bò Lúc Lắc Khoai Tây','Bò Úc xào lúc lắc, khoai tây chiên, rau thơm.',185000,'🥩',(SELECT id FROM menu_categories WHERE code='main')),
  ('Cá Chẽm Sốt Chanh Dây','Cá chẽm áp chảo, sốt chanh dây đặc trưng.',210000,'🐟',(SELECT id FROM menu_categories WHERE code='main')),
  ('Bò Bít Tết Sốt Tiêu Xanh','Thăn bò 300g, sốt tiêu xanh thơm đậm.',320000,'🥩',(SELECT id FROM menu_categories WHERE code='main')),
  ('Cơm Chiên Hải Sản','Tôm, mực, cua, hành lá, trứng.',130000,'🍚',(SELECT id FROM menu_categories WHERE code='main')),
  ('Trà Tắc Mật Ong','Tắc tươi, mật ong, đá viên.',45000,'🧃',(SELECT id FROM menu_categories WHERE code='drink')),
  ('Cà Phê Sữa Đá','Cà phê phin truyền thống, sữa đặc.',35000,'☕',(SELECT id FROM menu_categories WHERE code='drink')),
  ('Sinh Tố Bơ','Bơ sáp, sữa tươi, đường.',55000,'🥑',(SELECT id FROM menu_categories WHERE code='drink')),
  ('Trà Đào Cam Sả','Trà đào, cam, sả thơm mát.',50000,'🍵',(SELECT id FROM menu_categories WHERE code='drink')),
  ('Trà Đá','Trà đá miễn phí.',5000,'🧊',(SELECT id FROM menu_categories WHERE code='drink'))
ON CONFLICT (name) DO NOTHING;
