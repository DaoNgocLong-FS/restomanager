-- =============================================================================
-- 005_table_management.sql
-- Hỗ trợ tính năng "chuyển bàn" / "tắt bàn" / "dọn bàn":
--   - Thêm cancelled_reason vào orders để biết tại sao order bị cancel
--     (giúp báo cáo phân biệt khách bỏ về vs cancel chủ động)
--   - Thêm partial unique index ngăn 2 order mở cùng lúc trên 1 bàn (bonus
--     fix race condition - tận dụng migration này luôn)
-- Idempotent.
-- =============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Bảo vệ ở DB level: 1 bàn chỉ có tối đa 1 order pending/serving cùng lúc.
-- Khi 2 request đồng thời cùng tạo order → 1 thành công, 1 nhận 23505.
CREATE UNIQUE INDEX IF NOT EXISTS one_open_order_per_table
  ON orders(table_id)
  WHERE status IN ('pending', 'serving');
