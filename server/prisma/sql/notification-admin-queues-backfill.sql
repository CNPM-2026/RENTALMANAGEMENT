-- BACKFILL NOTIFICATION ADMIN QUEUE TYPES
-- Chuyển các thông báo cũ đang là SYSTEM sang type riêng để deep-link đúng
-- hàng đợi. Chỉ cập nhật khi reference_id thật sự trỏ tới post/ticket và
-- người nhận là ADMIN; chạy lặp lại an toàn.

UPDATE "notifications" AS n
SET "type" = 'POST_PENDING'
WHERE n."type" = 'SYSTEM'
  AND n."title" = 'Tin đăng mới chờ duyệt'
  AND EXISTS (
    SELECT 1 FROM "posts" p WHERE p."id" = n."reference_id"
  )
  AND EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = n."user_id" AND u."role" = 'ADMIN'
  );

UPDATE "notifications" AS n
SET "type" = 'SUPPORT_TICKET'
WHERE n."type" = 'SYSTEM'
  AND n."title" = 'Yêu cầu hỗ trợ mới'
  AND EXISTS (
    SELECT 1 FROM "support_tickets" t WHERE t."id" = n."reference_id"
  )
  AND EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = n."user_id" AND u."role" = 'ADMIN'
  );
