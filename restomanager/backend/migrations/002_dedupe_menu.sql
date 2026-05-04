-- =============================================================================
-- 002_dedupe_menu.sql
-- Xoá các menu_items bị seed trùng và thêm UNIQUE constraint trên `name`.
-- Idempotent: chạy lại không gây lỗi.
-- =============================================================================

-- Bước 1: với mỗi tên trùng, xoá hết các bản sao chỉ giữ row cũ nhất.
-- Trước khi xoá, chuyển order_items đang trỏ tới các bản sao về row cũ nhất
-- để tránh mất dữ liệu lịch sử đơn hàng (nếu có).
DO $$
DECLARE
  rec RECORD;
  keep_id UUID;
BEGIN
  FOR rec IN
    SELECT name FROM menu_items GROUP BY name HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id
      FROM menu_items
      WHERE name = rec.name
      ORDER BY created_at ASC
      LIMIT 1;

    UPDATE order_items
       SET menu_item_id = keep_id
     WHERE menu_item_id IN (
       SELECT id FROM menu_items WHERE name = rec.name AND id <> keep_id
     );

    DELETE FROM menu_items
     WHERE name = rec.name AND id <> keep_id;
  END LOOP;
END $$;

-- Bước 2: thêm UNIQUE constraint (nếu chưa có) để chặn tái phát
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_name_key'
  ) THEN
    ALTER TABLE menu_items
      ADD CONSTRAINT menu_items_name_key UNIQUE (name);
  END IF;
END $$;
