-- NOTIFICATION DEEP-LINK TYPES
-- Các luồng dưới đây từng dùng chung type SYSTEM nên client không thể suy ra
-- `reference_id` trỏ tới bảng nào (rental request / sự cố / lời mời ở ghép /
-- hồ sơ KYC). Tách type riêng để mỗi thông báo deep-link đúng bản ghi.
-- Có thể chạy lặp lại an toàn.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RENTAL_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MAINTENANCE_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ROOMMATE_INVITATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'KYC';
