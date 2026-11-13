-- =============================================================================
-- PLATFORM OVERHAUL DELTA — NEGOTIATION, REVIEWS/DISPUTES, CHAT, NOTIFICATIONS
-- =============================================================================
-- CHƯA ÁP DỤNG. Cần chủ dự án duyệt TRƯỚC khi chạy trên Supabase DEV.
--
-- Nguồn thi hành: scripts/apply-platform-delta.js (dry-run mặc định, --confirm để
-- ghi, từ chối production + host ngoài allowlist, xác minh lại sau khi chạy).
-- File .sql này được SINH TỰ ĐỘNG từ STATEMENTS của script — chỉ để review.
--
-- Toàn bộ thay đổi là ADDITIVE: chỉ thêm nhãn enum, bảng, cột nullable/có DEFAULT,
-- index và FK. Không xoá cột/bảng, không đổi kiểu, không backfill, không xoá row.
-- data impact = 0.
--
-- MỖI câu dưới đây phải chạy trong MỘT transaction riêng. Không gộp nhiều câu vào
-- một lần gọi: ALTER TYPE ... ADD VALUE không dùng được giá trị mới trong CÙNG
-- transaction (PostgreSQL 55P04) và làm trạng thái sau lỗi không xác định.
-- =============================================================================

-- 1. enum ReviewTargetType += TASK
ALTER TYPE "ReviewTargetType" ADD VALUE IF NOT EXISTS 'TASK';

-- 2. enum NotificationType += OFFER
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFER';

-- 3. enum NotificationType += REVIEW
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW';

-- 4. enum NotificationType += DISPUTE
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE';

-- 5. enum MaintenanceOfferStatus
DO $$
BEGIN
  CREATE TYPE "MaintenanceOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. enum MaintenanceOfferActor
DO $$
BEGIN
  CREATE TYPE "MaintenanceOfferActor" AS ENUM ('LANDLORD', 'STAFF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 7. enum DisputeCategory
DO $$
BEGIN
  CREATE TYPE "DisputeCategory" AS ENUM ('WORK_QUALITY', 'NO_SHOW', 'PRICE_DISPUTE', 'SAFETY', 'HARASSMENT', 'FRAUD', 'PROPERTY_DAMAGE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 8. maintenance_tasks: cột agreed_amount
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "agreed_amount" DECIMAL(12, 2);

-- 9. maintenance_tasks: cột agreed_at
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "agreed_at" TIMESTAMP(3);

-- 10. maintenance_tasks: cột negotiation_version
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "negotiation_version" INTEGER NOT NULL DEFAULT 0;

-- 11. maintenance_task_applications: cột proposed_amount
ALTER TABLE "maintenance_task_applications" ADD COLUMN IF NOT EXISTS "proposed_amount" DECIMAL(12, 2);

-- 12. bảng maintenance_task_offers
CREATE TABLE IF NOT EXISTS "maintenance_task_offers" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "proposed_by_id" TEXT NOT NULL,
  "proposed_by_role" "MaintenanceOfferActor" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "note" TEXT,
  "status" "MaintenanceOfferStatus" NOT NULL DEFAULT 'PENDING',
  "responded_by_id" TEXT,
  "responded_at" TIMESTAMP(3),
  "response_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_task_offers_pkey" PRIMARY KEY ("id")
);

-- 13. unique index (task_id, version) của đề xuất giá
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_task_offers_task_id_version_key"
  ON "maintenance_task_offers" ("task_id", "version");

-- 14. index (task_id, status) của đề xuất giá
CREATE INDEX IF NOT EXISTS "maintenance_task_offers_task_id_status_idx"
  ON "maintenance_task_offers" ("task_id", "status");

-- 15. FK maintenance_task_offers.task_id
DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 16. FK maintenance_task_offers.proposed_by_id
DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 17. FK maintenance_task_offers.responded_by_id
DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 18. reports: cột category
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" "DisputeCategory" NOT NULL DEFAULT 'OTHER';

-- 19. reports: cột task_id
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "task_id" TEXT;

-- 20. reports: cột resolution
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolution" TEXT;

-- 21. reports: cột resolved_by_id
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_by_id" TEXT;

-- 22. reports: cột resolved_at
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);

-- 23. reports: cột updated_at
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 24. index reports (status, created_at)
CREATE INDEX IF NOT EXISTS "reports_status_created_at_idx" ON "reports" ("status", "created_at");

-- 25. index reports (reporter_id, created_at)
CREATE INDEX IF NOT EXISTS "reports_reporter_id_created_at_idx" ON "reports" ("reporter_id", "created_at");

-- 26. index reports (task_id)
CREATE INDEX IF NOT EXISTS "reports_task_id_idx" ON "reports" ("task_id");

-- 27. FK reports.task_id
DO $$
BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 28. FK reports.resolved_by_id
DO $$
BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 29. bảng report_attachments
CREATE TABLE IF NOT EXISTS "report_attachments" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "file_ref" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- 30. index report_attachments (report_id)
CREATE INDEX IF NOT EXISTS "report_attachments_report_id_idx" ON "report_attachments" ("report_id");

-- 31. FK report_attachments.report_id
DO $$
BEGIN
  ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 32. conversations: cột task_id
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "task_id" TEXT;

-- 33. index conversations (task_id)
CREATE INDEX IF NOT EXISTS "conversations_task_id_idx" ON "conversations" ("task_id");

-- 34. FK conversations.task_id
DO $$
BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 35. messages: cột client_message_id
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "client_message_id" TEXT;

-- 36. messages: cột attachment_ref
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_ref" TEXT;

-- 37. messages: cột attachment_mime
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_mime" TEXT;

-- 38. messages: cột attachment_bytes
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_bytes" INTEGER;

-- 39. messages: cột attachment_name
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;

-- 40. unique index messages (conversation_id, client_message_id)
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_id_client_message_id_key"
  ON "messages" ("conversation_id", "client_message_id");

-- 41. notifications: cột read_at
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);

-- 42. notifications: cột dedupe_key
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;

-- 43. unique index notifications (dedupe_key)
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications" ("dedupe_key");

-- 44. index notifications (user_id, created_at)
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");
