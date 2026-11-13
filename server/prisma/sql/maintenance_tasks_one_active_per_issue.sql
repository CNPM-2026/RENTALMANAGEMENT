-- BATCH 2.2 (M3) + BATCH 3 — một công việc ĐANG HOẠT ĐỘNG cho mỗi sự cố nguồn.
--
-- Đây là artefact SQL để review/áp dụng. `prisma db push` KHÔNG quản lý partial
-- index, nên ràng buộc này không thể khai báo trong `schema.prisma` (chỉ có thể
-- ghi chú). Áp dụng trên DEV bằng:
--
--   node scripts/apply-maintenance-task-index.js --confirm
--
-- (script chạy preflight trùng lặp trước, DROP + CREATE lại nếu predicate hiện
-- tại hẹp hơn, rồi xác minh unique/valid/ready + đủ 4 trạng thái từ pg_catalog;
-- chạy lại nhiều lần không gây lỗi).
--
-- Predicate phải phủ ĐỦ bốn trạng thái đang hoạt động. Nếu chỉ phủ
-- ('OPEN','ASSIGNED') thì ngay khi thợ bấm "Bắt đầu" (ASSIGNED → IN_PROGRESS)
-- công việc rơi ra khỏi index và hệ thống lại cho phép tạo công việc THỨ HAI
-- cho cùng một sự cố — đúng lỗ hổng Batch 2.2 đã bịt.
--
-- Ngữ nghĩa: CANCELLED không nằm trong predicate ⇒ lịch sử huỷ KHÔNG giới hạn số
-- lần đăng lại từ cùng một sự cố. Ứng dụng vẫn giữ Serializable + P2034 → 409;
-- index này là lớp cuối cùng chặn một caller không Serializable/script vận hành.

CREATE UNIQUE INDEX IF NOT EXISTS maintenance_tasks_one_active_per_issue
  ON maintenance_tasks (source_issue_id)
  WHERE status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');

