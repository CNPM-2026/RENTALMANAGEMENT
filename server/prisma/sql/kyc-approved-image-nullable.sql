-- KYC APPROVED IMAGE RETENTION
-- Ảnh CCCD chỉ cần để admin đối soát. Sau khi hồ sơ APPROVED, ứng dụng xoá asset
-- trên Cloudinary và đặt hai cột này NULL. Vì vậy hai cột phải cho phép NULL.
-- Idempotent: chạy lại nhiều lần không đổi gì thêm.

ALTER TABLE "kyc_submissions" ALTER COLUMN "front_id_url" DROP NOT NULL;
ALTER TABLE "kyc_submissions" ALTER COLUMN "back_id_url" DROP NOT NULL;
