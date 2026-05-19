-- =============================================================================
-- 003_invoice_payment_fields.sql
-- Bổ sung trường thanh toán: số tiền khách trả (paid_amount), tiền thừa (change_amount).
-- Mở rộng payment_method để hỗ trợ nhiều cổng/phương thức.
-- Idempotent.
-- =============================================================================

-- Cột mới (nullable để không phá dữ liệu cũ)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount   NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS change_amount NUMERIC(12,2);

-- Backfill cho dữ liệu cũ: coi như khách trả đúng số (không thừa)
UPDATE invoices SET paid_amount   = final_amount WHERE paid_amount   IS NULL;
UPDATE invoices SET change_amount = 0            WHERE change_amount IS NULL;

-- Mở rộng payment_method: thay constraint cũ bằng tập rộng hơn.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'invoices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%payment_method%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE invoices DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_method_check
  CHECK (payment_method IN ('cash','card','transfer','online','grab','vnpay','banking','momo','zalopay'));
