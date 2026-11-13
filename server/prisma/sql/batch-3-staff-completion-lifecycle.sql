-- =============================================================================
-- BATCH 3 — STAFF WORK EXECUTION & COMPLETION LIFECYCLE (schema delta)
-- =============================================================================
-- Chưa được áp dụng. Cần chủ dự án duyệt TRƯỚC khi chạy trên Supabase DEV.
--
-- Vì sao bắt buộc phải đổi schema: `MaintenanceTaskStatus` hiện chỉ có
-- OPEN/ASSIGNED/CANCELLED, nên KHÔNG thể biểu diễn "thợ đang làm", "thợ đã gửi
-- nghiệm thu, chờ chủ trọ duyệt" và "chủ trọ đã xác nhận hoàn thành". Không có
-- cột nào hiện có thể tái sử dụng cho các trạng thái đó (`assigned_at` chỉ là
-- mốc giao việc), và nhồi chúng vào cờ boolean sẽ cho phép hai lần nộp chồng
-- nhau — đúng thứ mà Batch 3 phải chặn.
--
-- Chạy có kiểm soát: `node scripts/apply-batch3-lifecycle.js` (chỉ đọc) rồi
-- `node scripts/apply-batch3-lifecycle.js --confirm` (áp dụng). Script này là
-- nguồn SQL chuẩn; file .sql chỉ để review.
--
-- Thứ tự bắt buộc: enum TRƯỚC, cột/index SAU. `ALTER TYPE ... ADD VALUE` không
-- được dùng trong cùng transaction với lệnh dùng giá trị mới, nên mỗi câu dưới
-- đây phải là một transaction riêng (script thực thi từng câu).
-- =============================================================================

-- 1. Trạng thái thực thi/nghiệm thu -------------------------------------------
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- 2. Loại ảnh (hiện trạng vs bằng chứng nghiệm thu) ---------------------------
DO $$
BEGIN
  CREATE TYPE "MaintenanceTaskImageKind" AS ENUM ('TASK', 'COMPLETION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Dấu vết thực thi & nghiệm thu --------------------------------------------
ALTER TABLE "maintenance_tasks"
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "maintenance_task_images"
  ADD COLUMN IF NOT EXISTS "kind" "MaintenanceTaskImageKind" NOT NULL DEFAULT 'TASK';

-- 4. Index tra cứu ------------------------------------------------------------
-- "Việc của tôi" (thợ) lọc theo (assigned_staff_id, status).
CREATE INDEX IF NOT EXISTS "maintenance_tasks_assigned_staff_id_status_idx"
  ON "maintenance_tasks" ("assigned_staff_id", "status");

-- Tách ảnh hiện trạng / ảnh nghiệm thu của một công việc.
CREATE INDEX IF NOT EXISTS "maintenance_task_images_task_id_kind_idx"
  ON "maintenance_task_images" ("task_id", "kind");

-- Index đơn cũ (task_id) bị composite (task_id, kind) thay thế hoàn toàn: mọi
-- truy vấn lọc theo task_id đều dùng được tiền tố của composite. Giữ lại chỉ tốn
-- chỗ ghi và làm `prisma migrate diff` báo lệch vĩnh viễn.
DROP INDEX IF EXISTS "maintenance_task_images_task_id_idx";


-- 5. Partial unique index của Batch 2.2 phải phủ MỌI trạng thái "đang hoạt động"
-- -----------------------------------------------------------------------------
-- Index cũ chỉ phủ ('OPEN','ASSIGNED'). Nếu giữ nguyên, ngay sau khi thợ bấm
-- "Bắt đầu" (ASSIGNED → IN_PROGRESS) công việc rơi ra khỏi predicate và
-- `createFromIssue` lại cho phép tạo công việc THỨ HAI cho cùng một sự cố —
-- đúng lỗ hổng mà Batch 2.2 đã bịt. Vì vậy predicate được mở rộng.
DROP INDEX IF EXISTS "maintenance_tasks_one_active_per_issue";
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_tasks_one_active_per_issue"
  ON "maintenance_tasks" ("source_issue_id")
  WHERE "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');
