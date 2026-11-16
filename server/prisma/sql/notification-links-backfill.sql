-- BACKFILL NOTIFICATION DEEP-LINK TYPES
-- Chuyển các thông báo cũ đang là SYSTEM sang type riêng. Chỉ cập nhật khi
-- `reference_id` thật sự trỏ tới bảng tương ứng để không gắn nhầm đối tượng.
-- Chạy lặp lại an toàn.

UPDATE "notifications" AS n
SET "type" = 'RENTAL_REQUEST'
WHERE n."type" = 'SYSTEM'
  AND n."title" IN (
    'Yêu cầu thuê phòng mới',
    'Cập nhật yêu cầu thuê phòng',
    'Yêu cầu thuê phòng được chấp thuận',
    'Yêu cầu thuê phòng đã bị huỷ'
  )
  AND EXISTS (
    SELECT 1 FROM "rental_requests" r WHERE r."id" = n."reference_id"
  );

UPDATE "notifications" AS n
SET "type" = 'MAINTENANCE_REQUEST'
WHERE n."type" = 'SYSTEM'
  AND n."title" = 'Sự cố mới từ khách thuê'
  AND EXISTS (
    SELECT 1 FROM "maintenance_requests" m WHERE m."id" = n."reference_id"
  );

UPDATE "notifications" AS n
SET "type" = 'ROOMMATE_INVITATION'
WHERE n."type" = 'SYSTEM'
  AND n."title" IN (
    'Lời mời kết nối mới',
    'Lời mời kết nối đã bị từ chối',
    'Lời mời kết nối đã được hủy'
  )
  AND EXISTS (
    SELECT 1 FROM "roommate_invitations" i WHERE i."id" = n."reference_id"
  );

UPDATE "notifications" AS n
SET "type" = 'KYC'
WHERE n."type" = 'SYSTEM'
  AND n."title" = 'Hồ sơ KYC mới'
  AND EXISTS (
    SELECT 1 FROM "kyc_submissions" k WHERE k."id" = n."reference_id"
  )
  AND EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = n."user_id" AND u."role" = 'ADMIN'
  );

-- Thông báo vòng đời hợp đồng gửi cho hai bên từng lưu ID yêu cầu, nhưng trang
-- chi tiết duy nhất họ mở được là hợp đồng. Đổi sang contract_id để deep-link
-- đúng; thông báo cho Admin vẫn giữ ID yêu cầu (màn duyệt chấm dứt).
UPDATE "notifications" AS n
SET "reference_id" = r."contract_id"
FROM "contract_termination_requests" r
WHERE n."type" = 'CONTRACT_TERMINATION'
  AND n."reference_id" = r."id"
  AND EXISTS (
    SELECT 1
    FROM "users" u
    WHERE u."id" = n."user_id"
      AND u."role" IN ('TENANT', 'LANDLORD')
  );

UPDATE "notifications" AS n
SET "reference_id" = r."contract_id"
FROM "contract_renewal_requests" r
WHERE n."type" = 'CONTRACT_RENEWAL'
  AND n."reference_id" = r."id"
  AND EXISTS (
    SELECT 1
    FROM "users" u
    WHERE u."id" = n."user_id"
      AND u."role" IN ('TENANT', 'LANDLORD')
  );
