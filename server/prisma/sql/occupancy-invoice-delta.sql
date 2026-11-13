-- =============================================================================
-- OCCUPANCY & INVOICE SNAPSHOT DELTA
-- =============================================================================
-- CHƯA ÁP DỤNG. Cần chủ dự án duyệt TRƯỚC khi chạy trên Supabase DEV.
--
-- Nguồn thi hành: scripts/apply-occupancy-invoice-delta.js (dry-run mặc định,
-- --confirm để ghi; allowlist host DEV; xác minh lại sau khi chạy).
-- File .sql này được SINH TỰ ĐỘNG từ STATEMENTS của script — chỉ để review.
--
-- ADDITIVE: enum mới, bảng mới, cột nullable. Không backfill, không sửa/xoá
-- dữ liệu. MỖI câu phải chạy trong MỘT transaction riêng (ALTER TYPE ADD VALUE).
-- =============================================================================

-- 1. enum NotificationType += OCCUPANCY
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OCCUPANCY';

-- 2. enum OccupancyDeclarationStatus
DO $$
BEGIN
  CREATE TYPE "OccupancyDeclarationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUPERSEDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. bảng room_occupancy_declarations
CREATE TABLE IF NOT EXISTS "room_occupancy_declarations" (
  "id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "contract_id" TEXT,
  "occupants" INTEGER NOT NULL,
  "status" "OccupancyDeclarationStatus" NOT NULL DEFAULT 'PENDING',
  "declared_by_id" TEXT NOT NULL,
  "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verified_by_id" TEXT,
  "verified_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "superseded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "room_occupancy_declarations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "room_occupancy_declarations_occupants_positive" CHECK ("occupants" > 0)
);

-- 4. index lịch sử (room_id, tenant_id, verified_at) — tên mặc định của Prisma
--    (đổi tên nếu DB đã có index tên cũ, để `prisma migrate diff` không báo lệch).
DO $$
BEGIN
  IF to_regclass('public."room_occupancy_declarations_room_tenant_verified_idx"') IS NOT NULL
     AND to_regclass('public."room_occupancy_declarations_room_id_tenant_id_verified_at_idx"') IS NULL THEN
    ALTER INDEX "room_occupancy_declarations_room_tenant_verified_idx"
      RENAME TO "room_occupancy_declarations_room_id_tenant_id_verified_at_idx";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "room_occupancy_declarations_room_id_tenant_id_verified_at_idx"
  ON "room_occupancy_declarations" ("room_id", "tenant_id", "verified_at");

-- 5. index hàng đợi duyệt (status, declared_at) — tên mặc định của Prisma
DO $$
BEGIN
  IF to_regclass('public."room_occupancy_declarations_status_declared_idx"') IS NOT NULL
     AND to_regclass('public."room_occupancy_declarations_status_declared_at_idx"') IS NULL THEN
    ALTER INDEX "room_occupancy_declarations_status_declared_idx"
      RENAME TO "room_occupancy_declarations_status_declared_at_idx";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "room_occupancy_declarations_status_declared_at_idx"
  ON "room_occupancy_declarations" ("status", "declared_at");

-- 6. partial unique index room_occupancy_declarations_one_active_per_tenant
CREATE UNIQUE INDEX IF NOT EXISTS "room_occupancy_declarations_one_active_per_tenant"
  ON "room_occupancy_declarations" ("room_id", "tenant_id")
  WHERE "status" IN ('PENDING', 'VERIFIED') AND "superseded_at" IS NULL;

-- 7. FK room_occupancy_declarations.room_id
DO $$
BEGIN
  ALTER TABLE "room_occupancy_declarations" ADD CONSTRAINT "room_occupancy_declarations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. FK room_occupancy_declarations.tenant_id
DO $$
BEGIN
  ALTER TABLE "room_occupancy_declarations" ADD CONSTRAINT "room_occupancy_declarations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. FK room_occupancy_declarations.declared_by_id
DO $$
BEGIN
  ALTER TABLE "room_occupancy_declarations" ADD CONSTRAINT "room_occupancy_declarations_declared_by_id_fkey" FOREIGN KEY ("declared_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. FK room_occupancy_declarations.verified_by_id
DO $$
BEGIN
  ALTER TABLE "room_occupancy_declarations" ADD CONSTRAINT "room_occupancy_declarations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 11. FK room_occupancy_declarations.contract_id
DO $$
BEGIN
  ALTER TABLE "room_occupancy_declarations" ADD CONSTRAINT "room_occupancy_declarations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 12. invoices: cột electricity_start
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "electricity_start" INTEGER;

-- 13. invoices: cột electricity_end
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "electricity_end" INTEGER;

-- 14. invoices: cột electricity_consumption
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "electricity_consumption" INTEGER;

-- 15. invoices: cột water_consumption
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "water_consumption" INTEGER;

-- 16. invoices: cột water_occupants
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "water_occupants" INTEGER;

-- 17. invoices: cột electricity_unit_price
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "electricity_unit_price" DECIMAL(12, 2);

-- 18. invoices: cột water_unit_price
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "water_unit_price" DECIMAL(12, 2);

-- 19. invoices: cột occupancy_declaration_id
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "occupancy_declaration_id" TEXT;

-- 20. index invoices (occupancy_declaration_id)
CREATE INDEX IF NOT EXISTS "invoices_occupancy_declaration_id_idx" ON "invoices" ("occupancy_declaration_id");

-- 21. FK invoices.occupancy_declaration_id
DO $$
BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_occupancy_declaration_id_fkey" FOREIGN KEY ("occupancy_declaration_id") REFERENCES "room_occupancy_declarations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
