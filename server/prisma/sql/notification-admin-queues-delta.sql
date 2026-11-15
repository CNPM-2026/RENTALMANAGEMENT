-- NOTIFICATION ADMIN QUEUE DELTA
-- Thêm type riêng cho hai hàng đợi Admin:
--   POST_PENDING   -> tin đăng mới chờ duyệt
--   SUPPORT_TICKET -> phiếu hỗ trợ mới
-- Có thể chạy lặp lại an toàn.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'POST_PENDING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT_TICKET';
