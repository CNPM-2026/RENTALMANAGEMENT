-- CreateEnum
CREATE TYPE "MaintenanceTaskImageKind" AS ENUM ('TASK', 'COMPLETION');

-- CreateEnum
CREATE TYPE "MaintenanceOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MaintenanceOfferActor" AS ENUM ('LANDLORD', 'STAFF');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('WORK_QUALITY', 'NO_SHOW', 'PRICE_DISPUTE', 'SAFETY', 'HARASSMENT', 'FRAUD', 'PROPERTY_DAMAGE', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MaintenanceTaskStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "MaintenanceTaskStatus" ADD VALUE 'COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OFFER';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE';

-- AlterEnum
ALTER TYPE "ReviewTargetType" ADD VALUE 'TASK';

-- DropIndex
DROP INDEX "maintenance_task_images_task_id_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "task_id" TEXT;

-- AlterTable
ALTER TABLE "maintenance_task_applications" ADD COLUMN     "proposed_amount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "maintenance_task_images" ADD COLUMN     "kind" "MaintenanceTaskImageKind" NOT NULL DEFAULT 'TASK';

-- AlterTable
ALTER TABLE "maintenance_tasks" ADD COLUMN     "agreed_amount" DECIMAL(12,2),
ADD COLUMN     "agreed_at" TIMESTAMP(3),
ADD COLUMN     "completion_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completion_note" TEXT,
ADD COLUMN     "completion_review_note" TEXT,
ADD COLUMN     "completion_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "completion_submitted_at" TIMESTAMP(3),
ADD COLUMN     "negotiation_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "attachment_bytes" INTEGER,
ADD COLUMN     "attachment_mime" TEXT,
ADD COLUMN     "attachment_name" TEXT,
ADD COLUMN     "attachment_ref" TEXT,
ADD COLUMN     "client_message_id" TEXT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "category" "DisputeCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT,
ADD COLUMN     "task_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "report_attachments" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "file_ref" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_task_offers" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "proposed_by_id" TEXT NOT NULL,
    "proposed_by_role" "MaintenanceOfferActor" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "status" "MaintenanceOfferStatus" NOT NULL DEFAULT 'PENDING',
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "response_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_task_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_attachments_report_id_idx" ON "report_attachments"("report_id");

-- CreateIndex
CREATE INDEX "maintenance_task_offers_task_id_status_idx" ON "maintenance_task_offers"("task_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_task_offers_task_id_version_key" ON "maintenance_task_offers"("task_id", "version");

-- CreateIndex
CREATE INDEX "conversations_task_id_idx" ON "conversations"("task_id");

-- CreateIndex
CREATE INDEX "maintenance_task_images_task_id_kind_idx" ON "maintenance_task_images"("task_id", "kind");

-- CreateIndex
CREATE INDEX "maintenance_tasks_assigned_staff_id_status_idx" ON "maintenance_tasks"("assigned_staff_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversation_id_client_message_id_key" ON "messages"("conversation_id", "client_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_task_id_idx" ON "reports"("task_id");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

