-- CONTRACT LIFECYCLE DELTA
-- Chấm dứt hợp đồng (bằng chứng + Admin duyệt + hoàn cọc) và ký tiếp / gia hạn.
-- CHỈ THÊM kiểu dữ liệu/bảng mới; có thể chạy lặp lại an toàn.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractTerminationStatus') THEN
    CREATE TYPE "ContractTerminationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractTerminationReason') THEN
    CREATE TYPE "ContractTerminationReason" AS ENUM (
      'TENANT_MOVED_OUT',
      'TENANT_VIOLATION',
      'LANDLORD_VIOLATION',
      'MUTUAL_AGREEMENT',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepositRefundStatus') THEN
    CREATE TYPE "DepositRefundStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractRenewalStatus') THEN
    CREATE TYPE "ContractRenewalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');
  END IF;
END $$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTRACT_TERMINATION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTRACT_RENEWAL';

CREATE TABLE IF NOT EXISTS "contract_termination_requests" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "initiator_role" "Role" NOT NULL,
  "reason" "ContractTerminationReason" NOT NULL,
  "details" TEXT NOT NULL,
  "requested_effective_date" TIMESTAMP(3),
  "status" "ContractTerminationStatus" NOT NULL DEFAULT 'PENDING',
  "deposit_refund_required" BOOLEAN NOT NULL DEFAULT false,
  "deposit_refund_amount" DECIMAL(10,2),
  "refund_status" "DepositRefundStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "refund_paid_at" TIMESTAMP(3),
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_termination_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_termination_requests_contract_id_status_idx"
  ON "contract_termination_requests"("contract_id", "status");
CREATE INDEX IF NOT EXISTS "contract_termination_requests_status_created_at_idx"
  ON "contract_termination_requests"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_termination_requests_contract_id_fkey'
  ) THEN
    ALTER TABLE "contract_termination_requests"
      ADD CONSTRAINT "contract_termination_requests_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_termination_requests_requested_by_id_fkey'
  ) THEN
    ALTER TABLE "contract_termination_requests"
      ADD CONSTRAINT "contract_termination_requests_requested_by_id_fkey"
      FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_termination_requests_reviewed_by_id_fkey'
  ) THEN
    ALTER TABLE "contract_termination_requests"
      ADD CONSTRAINT "contract_termination_requests_reviewed_by_id_fkey"
      FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "contract_termination_attachments" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "file_ref" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_termination_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_termination_attachments_request_id_idx"
  ON "contract_termination_attachments"("request_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_termination_attachments_request_id_fkey'
  ) THEN
    ALTER TABLE "contract_termination_attachments"
      ADD CONSTRAINT "contract_termination_attachments_request_id_fkey"
      FOREIGN KEY ("request_id") REFERENCES "contract_termination_requests"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "contract_renewal_requests" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "proposed_end_date" TIMESTAMP(3),
  "proposed_monthly_rent" DECIMAL(10,2),
  "note" TEXT,
  "status" "ContractRenewalStatus" NOT NULL DEFAULT 'PENDING',
  "responded_by_id" TEXT,
  "responded_at" TIMESTAMP(3),
  "response_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_renewal_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_renewal_requests_contract_id_status_idx"
  ON "contract_renewal_requests"("contract_id", "status");
CREATE INDEX IF NOT EXISTS "contract_renewal_requests_status_created_at_idx"
  ON "contract_renewal_requests"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_renewal_requests_contract_id_fkey'
  ) THEN
    ALTER TABLE "contract_renewal_requests"
      ADD CONSTRAINT "contract_renewal_requests_contract_id_fkey"
      FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_renewal_requests_requested_by_id_fkey'
  ) THEN
    ALTER TABLE "contract_renewal_requests"
      ADD CONSTRAINT "contract_renewal_requests_requested_by_id_fkey"
      FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_renewal_requests_responded_by_id_fkey'
  ) THEN
    ALTER TABLE "contract_renewal_requests"
      ADD CONSTRAINT "contract_renewal_requests_responded_by_id_fkey"
      FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
