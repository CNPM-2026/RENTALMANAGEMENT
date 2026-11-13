-- =============================================================================
-- INVOICE ROOM FEES DELTA
-- =============================================================================
-- Bổ sung các khoản phí cố định đã cấu hình trên phòng vào hoá đơn:
--   internet_fee  (WiFi/internet)
--   service_fee   (dịch vụ)
--   parking_fee   (gửi xe)
--
-- ADDITIVE + IDEMPOTENT: chỉ thêm cột, mặc định 0 cho hoá đơn cũ.
-- Chạy: npm run db:invoice:fees
-- =============================================================================

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "internet_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "service_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "parking_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;
