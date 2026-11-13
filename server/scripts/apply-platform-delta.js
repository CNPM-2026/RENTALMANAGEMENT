#!/usr/bin/env node
'use strict';

/**
 * PLATFORM OVERHAUL DELTA — thương lượng giá, tranh chấp, chat đính kèm, thông báo.
 *
 * Nguồn SQL chuẩn: `prisma/sql/platform-overhaul-delta.sql` (chỉ để review).
 *
 * An toàn (cùng khuôn với `apply-batch3-lifecycle.js`):
 *  - Mặc định CHỈ ĐỌC: in target, trạng thái hiện tại, data impact và đúng các
 *    câu SQL sẽ chạy.
 *  - Chỉ ghi khi có `--confirm`.
 *  - Từ chối chạy khi `NODE_ENV=production`.
 *  - MỖI entry là ĐÚNG MỘT câu SQL. `assertSingleStatement()` chặn trước khi gọi
 *    `$executeRawUnsafe()`: nhiều câu trong một lần gọi sẽ chạy chung một
 *    transaction, khiến script dừng giữa đường và để lại trạng thái nửa vời.
 *  - Mọi câu idempotent (`IF NOT EXISTS` / `duplicate_object`) nên chạy lại sau
 *    khi bị gián đoạn là an toàn (resumable, không cần rollback).
 *  - KHÔNG sửa/xoá dữ liệu nghiệp vụ: chỉ thêm bảng/cột/index/nhãn enum.
 *  - Xác minh SAU KHI chạy đủ mọi đối tượng (enum, bảng, cột, index unique,
 *    index thường, FK). Thiếu bất kỳ đối tượng nào => exit code 1, KHÔNG báo
 *    thành công.
 *
 * Cách dùng:
 *   node scripts/apply-platform-delta.js            (preflight, chỉ đọc)
 *   node scripts/apply-platform-delta.js --confirm  (áp dụng)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { assertSingleStatement } = require('./lib/sql-statements');
const { assertDeploymentTarget } = require('./lib/target-guard');
const OFFER_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'];
const OFFER_ACTORS = ['LANDLORD', 'STAFF'];
const DISPUTE_CATEGORIES = [
  'WORK_QUALITY',
  'NO_SHOW',
  'PRICE_DISPUTE',
  'SAFETY',
  'HARASSMENT',
  'FRAUD',
  'PROPERTY_DAMAGE',
  'OTHER',
];
const REVIEW_TARGET_ADDITIONS = ['TASK'];
const NOTIFICATION_ADDITIONS = ['OFFER', 'REVIEW', 'DISPUTE'];

/** Enum bắt buộc phải có đủ nhãn sau khi áp dụng. */
const ENUM_SPECS = [
  ['ReviewTargetType', REVIEW_TARGET_ADDITIONS],
  ['NotificationType', NOTIFICATION_ADDITIONS],
  ['MaintenanceOfferStatus', OFFER_STATUSES],
  ['MaintenanceOfferActor', OFFER_ACTORS],
  ['DisputeCategory', DISPUTE_CATEGORIES],
];

/** Bảng bắt buộc phải tồn tại. */
const TABLE_SPECS = ['maintenance_task_offers', 'report_attachments'];

/** Cột bắt buộc phải tồn tại: [table, column, udt_name mong đợi]. */
const COLUMN_SPECS = [
  ['maintenance_tasks', 'agreed_amount', 'numeric'],
  ['maintenance_tasks', 'agreed_at', 'timestamp'],
  ['maintenance_tasks', 'negotiation_version', 'int4'],
  ['maintenance_task_applications', 'proposed_amount', 'numeric'],
  ['reports', 'category', 'DisputeCategory'],
  ['reports', 'task_id', 'text'],
  ['reports', 'resolution', 'text'],
  ['reports', 'resolved_by_id', 'text'],
  ['reports', 'resolved_at', 'timestamp'],
  ['reports', 'updated_at', 'timestamp'],
  ['conversations', 'task_id', 'text'],
  ['messages', 'client_message_id', 'text'],
  ['messages', 'attachment_ref', 'text'],
  ['messages', 'attachment_mime', 'text'],
  ['messages', 'attachment_bytes', 'int4'],
  ['messages', 'attachment_name', 'text'],
  ['notifications', 'read_at', 'timestamp'],
  ['notifications', 'dedupe_key', 'text'],
];

/** Index bắt buộc: [table, index, phải-unique, danh sách cột mong đợi]. */
const INDEX_SPECS = [
  ['maintenance_task_offers', 'maintenance_task_offers_task_id_version_key', true, ['task_id', 'version']],
  ['maintenance_task_offers', 'maintenance_task_offers_task_id_status_idx', false, ['task_id', 'status']],
  ['reports', 'reports_status_created_at_idx', false, ['status', 'created_at']],
  ['reports', 'reports_reporter_id_created_at_idx', false, ['reporter_id', 'created_at']],
  ['reports', 'reports_task_id_idx', false, ['task_id']],
  ['report_attachments', 'report_attachments_report_id_idx', false, ['report_id']],
  ['conversations', 'conversations_task_id_idx', false, ['task_id']],
  // UNIQUE nhưng NULL được phép lặp => tin nhắn cũ không bị ảnh hưởng.
  ['messages', 'messages_conversation_id_client_message_id_key', true, ['conversation_id', 'client_message_id']],
  ['notifications', 'notifications_dedupe_key_key', true, ['dedupe_key']],
  ['notifications', 'notifications_user_id_created_at_idx', false, ['user_id', 'created_at']],
];

/** Khoá ngoại bắt buộc: [table, constraint, cột nguồn, bảng đích, cột đích]. */
const FK_SPECS = [
  ['maintenance_task_offers', 'maintenance_task_offers_task_id_fkey', 'task_id', 'maintenance_tasks', 'id'],
  ['maintenance_task_offers', 'maintenance_task_offers_proposed_by_id_fkey', 'proposed_by_id', 'users', 'id'],
  ['maintenance_task_offers', 'maintenance_task_offers_responded_by_id_fkey', 'responded_by_id', 'users', 'id'],
  ['reports', 'reports_task_id_fkey', 'task_id', 'maintenance_tasks', 'id'],
  ['reports', 'reports_resolved_by_id_fkey', 'resolved_by_id', 'users', 'id'],
  ['report_attachments', 'report_attachments_report_id_fkey', 'report_id', 'reports', 'id'],
  ['conversations', 'conversations_task_id_fkey', 'task_id', 'maintenance_tasks', 'id'],
];

/**
 * DANH SÁCH THI HÀNH — MỖI ENTRY LÀ ĐÚNG MỘT CÂU SQL.
 *
 * Thứ tự bắt buộc: enum trước, bảng/cột/index/FK sau. Không gộp nhiều câu vào
 * một entry (xem `scripts/lib/sql-statements.js`).
 */
const STATEMENTS = [
  // 1. Nhãn enum (chỉ thêm) ---------------------------------------------------
  {
    label: 'enum ReviewTargetType += TASK',
    sql: `ALTER TYPE "ReviewTargetType" ADD VALUE IF NOT EXISTS 'TASK';`,
  },
  {
    label: 'enum NotificationType += OFFER',
    sql: `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OFFER';`,
  },
  {
    label: 'enum NotificationType += REVIEW',
    sql: `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW';`,
  },
  {
    label: 'enum NotificationType += DISPUTE',
    sql: `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DISPUTE';`,
  },
  {
    label: 'enum MaintenanceOfferStatus',
    sql: `DO $$
BEGIN
  CREATE TYPE "MaintenanceOfferStatus" AS ENUM (${OFFER_STATUSES.map((value) => `'${value}'`).join(', ')});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'enum MaintenanceOfferActor',
    sql: `DO $$
BEGIN
  CREATE TYPE "MaintenanceOfferActor" AS ENUM (${OFFER_ACTORS.map((value) => `'${value}'`).join(', ')});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'enum DisputeCategory',
    sql: `DO $$
BEGIN
  CREATE TYPE "DisputeCategory" AS ENUM (${DISPUTE_CATEGORIES.map((value) => `'${value}'`).join(', ')});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`,
  },

  // 2. Thương lượng giá — cột ------------------------------------------------
  {
    label: 'maintenance_tasks: cột agreed_amount',
    sql: `ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "agreed_amount" DECIMAL(12, 2);`,
  },
  {
    label: 'maintenance_tasks: cột agreed_at',
    sql: `ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "agreed_at" TIMESTAMP(3);`,
  },
  {
    label: 'maintenance_tasks: cột negotiation_version',
    sql: `ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "negotiation_version" INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    label: 'maintenance_task_applications: cột proposed_amount',
    sql: `ALTER TABLE "maintenance_task_applications" ADD COLUMN IF NOT EXISTS "proposed_amount" DECIMAL(12, 2);`,
  },


  // 3. Thương lượng giá — bảng + index + FK ----------------------------------
  {
    label: 'bảng maintenance_task_offers',
    sql: `CREATE TABLE IF NOT EXISTS "maintenance_task_offers" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "proposed_by_id" TEXT NOT NULL,
  "proposed_by_role" "MaintenanceOfferActor" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "note" TEXT,
  "status" "MaintenanceOfferStatus" NOT NULL DEFAULT 'PENDING',
  "responded_by_id" TEXT,
  "responded_at" TIMESTAMP(3),
  "response_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_task_offers_pkey" PRIMARY KEY ("id")
);`,
  },
  {
    label: 'unique index (task_id, version) của đề xuất giá',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_task_offers_task_id_version_key"
  ON "maintenance_task_offers" ("task_id", "version");`,
  },
  {
    label: 'index (task_id, status) của đề xuất giá',
    sql: `CREATE INDEX IF NOT EXISTS "maintenance_task_offers_task_id_status_idx"
  ON "maintenance_task_offers" ("task_id", "status");`,
  },
  {
    label: 'FK maintenance_task_offers.task_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK maintenance_task_offers.proposed_by_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK maintenance_task_offers.responded_by_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "maintenance_task_offers" ADD CONSTRAINT "maintenance_task_offers_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },

  // 4. Báo cáo/tranh chấp — cột ----------------------------------------------
  {
    label: 'reports: cột category',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" "DisputeCategory" NOT NULL DEFAULT 'OTHER';`,
  },
  {
    label: 'reports: cột task_id',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "task_id" TEXT;`,
  },
  {
    label: 'reports: cột resolution',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolution" TEXT;`,
  },
  {
    label: 'reports: cột resolved_by_id',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_by_id" TEXT;`,
  },
  {
    label: 'reports: cột resolved_at',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3);`,
  },
  {
    label: 'reports: cột updated_at',
    sql: `ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`,
  },


  // 5. Báo cáo/tranh chấp — index + FK ---------------------------------------
  {
    label: 'index reports (status, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS "reports_status_created_at_idx" ON "reports" ("status", "created_at");`,
  },
  {
    label: 'index reports (reporter_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS "reports_reporter_id_created_at_idx" ON "reports" ("reporter_id", "created_at");`,
  },
  {
    label: 'index reports (task_id)',
    sql: `CREATE INDEX IF NOT EXISTS "reports_task_id_idx" ON "reports" ("task_id");`,
  },
  {
    label: 'FK reports.task_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK reports.resolved_by_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'bảng report_attachments',
    sql: `CREATE TABLE IF NOT EXISTS "report_attachments" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "file_ref" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_attachments_pkey" PRIMARY KEY ("id")
);`,
  },
  {
    label: 'index report_attachments (report_id)',
    sql: `CREATE INDEX IF NOT EXISTS "report_attachments_report_id_idx" ON "report_attachments" ("report_id");`,
  },
  {
    label: 'FK report_attachments.report_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "report_attachments" ADD CONSTRAINT "report_attachments_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },

  // 6. Chat — neo hội thoại vào công việc ------------------------------------
  {
    label: 'conversations: cột task_id',
    sql: `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "task_id" TEXT;`,
  },
  {
    label: 'index conversations (task_id)',
    sql: `CREATE INDEX IF NOT EXISTS "conversations_task_id_idx" ON "conversations" ("task_id");`,
  },
  {
    label: 'FK conversations.task_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },


  // 7. Chat — tệp đính kèm private + idempotency -----------------------------
  {
    label: 'messages: cột client_message_id',
    sql: `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "client_message_id" TEXT;`,
  },
  {
    label: 'messages: cột attachment_ref',
    sql: `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_ref" TEXT;`,
  },
  {
    label: 'messages: cột attachment_mime',
    sql: `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_mime" TEXT;`,
  },
  {
    label: 'messages: cột attachment_bytes',
    sql: `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_bytes" INTEGER;`,
  },
  {
    label: 'messages: cột attachment_name',
    sql: `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment_name" TEXT;`,
  },
  {
    label: 'unique index messages (conversation_id, client_message_id)',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_id_client_message_id_key"
  ON "messages" ("conversation_id", "client_message_id");`,
  },

  // 8. Thông báo: read timestamp + khoá chống trùng --------------------------
  {
    label: 'notifications: cột read_at',
    sql: `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);`,
  },
  {

    label: 'notifications: cột dedupe_key',
    sql: `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT;`,
  },
  {
    label: 'unique index notifications (dedupe_key)',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications" ("dedupe_key");`,
  },
  {
    label: 'index notifications (user_id, created_at)',
    sql: `CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");`,
  },
];


const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

const prisma = new PrismaClient();

const text = (value) => (value === null || value === undefined ? '' : String(value));

const enumValues = (typeName) =>
  prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = $1
      ORDER BY e.enumsortorder;`,
    typeName,
  );

const columnsOf = (table) =>
  prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY column_name;`,
    table,
  );

const tableExists = (table) =>
  prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS present
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1;`,
    table,
  );

const indexInfo = (table, index) =>
  prisma.$queryRawUnsafe(
    `SELECT i.relname AS index_name,
            ix.indisunique AS is_unique,
            ix.indisvalid AS is_valid,
            ix.indisready AS is_ready,
            pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
            pg_get_indexdef(ix.indexrelid) AS definition,
            ARRAY(
              SELECT a.attname
                FROM generate_series(0, ix.indnkeyatts - 1) AS s(pos)
                JOIN pg_attribute a
                  ON a.attrelid = ix.indrelid AND a.attnum = ix.indkey[s.pos]
               ORDER BY s.pos
            ) AS columns
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
      WHERE t.relname = $1
        AND t.relnamespace = 'public'::regnamespace
        AND i.relname = $2;`,
    table,
    index,
  );

const foreignKeyInfo = (table, constraint) =>
  prisma.$queryRawUnsafe(
    `SELECT c.conname AS constraint_name,
            rt.relname AS ref_table,
            ARRAY(
              SELECT a.attname
                FROM unnest(c.conkey) AS k(attnum)
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
            ) AS columns,
            ARRAY(
              SELECT a.attname
                FROM unnest(c.confkey) AS k(attnum)
                JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum
            ) AS ref_columns
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_class rt ON rt.oid = c.confrelid
      WHERE c.contype = 'f'
        AND t.relname = $1
        AND t.relnamespace = 'public'::regnamespace
        AND c.conname = $2;`,
    table,
    constraint,
  );


const rowCounts = () =>
  prisma.$queryRawUnsafe(
    `SELECT 'maintenance_tasks' AS table_name, count(*)::int AS rows FROM maintenance_tasks
     UNION ALL SELECT 'maintenance_task_applications', count(*)::int FROM maintenance_task_applications
     UNION ALL SELECT 'reports', count(*)::int FROM "reports"
     UNION ALL SELECT 'conversations', count(*)::int FROM conversations
     UNION ALL SELECT 'messages', count(*)::int FROM messages
     UNION ALL SELECT 'notifications', count(*)::int FROM notifications;`,
  );

/** Data impact của THAY ĐỔI HÀNH VI (không phải thay đổi dữ liệu). */
const behaviouralPreflight = () =>
  prisma
    .$queryRawUnsafe(
      `SELECT
         count(*) FILTER (WHERE status::text = 'ASSIGNED' AND agreed_amount IS NULL)::int AS assigned_without_price,
         count(*) FILTER (WHERE status::text = 'COMPLETED')::int AS completed_tasks
       FROM maintenance_tasks;`,
    )
    .catch(() => []);

/**
 * Dữ liệu chặn việc tạo UNIQUE index. Chạy TRƯỚC khi ghi để không bao giờ để
 * script chết giữa đường vì dữ liệu trùng.
 */
const duplicateClientMessageIds = () =>
  prisma
    .$queryRawUnsafe(
      `SELECT conversation_id, client_message_id, count(*)::int AS rows
         FROM messages
        WHERE client_message_id IS NOT NULL
        GROUP BY conversation_id, client_message_id
       HAVING count(*) > 1
        ORDER BY rows DESC
        LIMIT 10;`,
    )
    .catch(() => []);

/**
 * Trả về danh sách đối tượng CÒN THIẾU (đọc từ catalog). Dùng cho cả preflight
 * và post-apply verification — nhờ vậy hai bên không thể lệch nhau.
 */
const collectMissingObjects = async () => {
  const missing = { enums: [], tables: [], columns: [], indexes: [], foreignKeys: [] };

  for (const [typeName, expected] of ENUM_SPECS) {
    const values = await enumValues(typeName).catch(() => []);
    for (const value of expected) {
      if (!values.some((row) => row.value === value)) missing.enums.push(`${typeName}.${value}`);
    }
  }

  for (const table of TABLE_SPECS) {
    const [row] = await tableExists(table).catch(() => []);
    if (!row || Number(row.present) === 0) missing.tables.push(table);
  }

  const tablesToInspect = [...new Set(COLUMN_SPECS.map(([table]) => table))];
  const columnsByTable = {};
  for (const table of tablesToInspect) {
    columnsByTable[table] = await columnsOf(table).catch(() => []);
  }
  for (const [table, column, expectedType] of COLUMN_SPECS) {
    const found = columnsByTable[table]?.find((row) => row.column_name === column);
    if (!found) {
      missing.columns.push(`${table}.${column}`);
    } else if (expectedType && found.udt_name !== expectedType) {
      missing.columns.push(`${table}.${column} (kiểu ${found.udt_name}, cần ${expectedType})`);
    }
  }

  for (const [table, index, expectUnique, expectedColumns] of INDEX_SPECS) {
    const [row] = await indexInfo(table, index).catch(() => []);
    if (!row) {
      missing.indexes.push(`${table}.${index}`);
      continue;
    }
    const actualColumns = Array.isArray(row.columns) ? row.columns.map(String) : [];
    const columnsMatch =
      actualColumns.length === expectedColumns.length &&
      expectedColumns.every((column, position) => actualColumns[position] === column);
    if (Boolean(row.is_unique) !== expectUnique || !row.is_valid || !row.is_ready || !columnsMatch) {
      missing.indexes.push(
        `${table}.${index} (unique=${row.is_unique}, valid=${row.is_valid}, ready=${row.is_ready}, ` +
          `cột=${actualColumns.join(',') || '?'})`,
      );
    }
  }

  for (const [table, constraint, column, refTable, refColumn] of FK_SPECS) {
    const [row] = await foreignKeyInfo(table, constraint).catch(() => []);
    const columns = Array.isArray(row?.columns) ? row.columns.map(String) : [];
    const refColumns = Array.isArray(row?.ref_columns) ? row.ref_columns.map(String) : [];
    if (!row || row.ref_table !== refTable || columns[0] !== column || refColumns[0] !== refColumn) {
      missing.foreignKeys.push(`${table}.${constraint}`);
    }
  }

  return missing;
};

const flattenMissing = (missing) => [
  ...missing.enums,
  ...missing.tables,
  ...missing.columns,
  ...missing.indexes,
  ...missing.foreignKeys,
];


const main = async () => {
  requireEnv(['DB_URL']);
  const confirm = process.argv.includes('--confirm');
  const target = assertDeploymentTarget(process.env.DB_URL);

  console.log(`🎯 Target (DEV): db=${target.database} host=${target.host}`);
  console.log(`📋 ${STATEMENTS.length} câu SQL (mỗi entry đúng một câu, idempotent), theo thứ tự:`);
  for (const statement of STATEMENTS) {
    assertSingleStatement(statement.sql, statement.label);
    console.log(`   • ${statement.label}`);
    console.log(statement.sql.split('\n').map((line) => `     ${line}`).join('\n'));
  }

  // ---- Preflight (chỉ đọc) -------------------------------------------------
  console.log('\n🔎 Trạng thái hiện tại');
  for (const [typeName] of ENUM_SPECS) {
    const values = await enumValues(typeName).catch(() => []);
    console.log(`  ${typeName}: ${values.map((row) => row.value).join(', ') || '(chưa có)'}`);
  }

  const counts = await rowCounts().catch((error) => {
    console.log(`  (không đọc được số bản ghi: ${error?.message ?? error})`);
    return [];
  });
  for (const row of counts) console.log(`  ${row.table_name}: ${row.rows}`);

  const impact = await behaviouralPreflight();
  for (const row of impact) {
    console.log(
      `  ⚠️  Hành vi: ${row.assigned_without_price} công việc đã giao nhưng CHƯA chốt giá → phải thương lượng trước khi bắt đầu.`,
    );
    console.log(`  ℹ️  ${row.completed_tasks} công việc đã hoàn thành → đủ điều kiện đánh giá (không backfill).`);
  }

  const duplicates = await duplicateClientMessageIds();
  if (duplicates.length > 0) {
    console.error('\n⛔ Có tin nhắn trùng (conversation_id, client_message_id) — KHÔNG tạo unique index.');
    for (const row of duplicates) {
      console.error(`  conversation=${row.conversation_id} client_message_id=${row.client_message_id} rows=${row.rows}`);
    }
    console.error('  Cần con người quyết định trước (không tự sửa dữ liệu nghiệp vụ).');
    return 2;
  }

  const missingBefore = await collectMissingObjects();
  const pending = flattenMissing(missingBefore);

  if (pending.length === 0) {
    console.log('\n✅ Schema đã đúng đặc tả — không cần chạy lại.');
    return 0;
  }

  console.log('\n📌 Còn thiếu:');
  for (const item of pending) console.log(`   - ${item}`);

  if (!confirm) {
    console.log('\n⚠️  CHƯA ÁP DỤNG (thiếu --confirm). Đây là bản xem trước, KHÔNG phải deploy thành công.');
    console.log('    Chạy lại với --confirm sau khi chủ dự án duyệt các câu SQL trên.');
    return 0;
  }

  // ---- Apply ---------------------------------------------------------------
  console.log('\n🚀 Đang áp dụng (từng câu, đúng thứ tự)...');
  for (const [position, statement] of STATEMENTS.entries()) {
    assertSingleStatement(statement.sql, statement.label);
    try {
      await prisma.$executeRawUnsafe(statement.sql);
      console.log(`  ✅ [${position + 1}/${STATEMENTS.length}] ${statement.label}`);
    } catch (error) {
      console.error(
        `\n❌ Dừng tại câu ${position + 1}/${STATEMENTS.length} (${statement.label}): ${error?.message ?? error}`,
      );
      console.error('   Mọi câu đã chạy đều đã commit (mỗi câu một transaction). Toàn bộ DDL ở trên idempotent');
      console.error('   nên có thể sửa nguyên nhân rồi CHẠY LẠI script — không cần rollback.');
      return 1;
    }
  }

  // ---- Verify --------------------------------------------------------------
  console.log('\n🔎 Xác minh sau khi áp dụng');
  const missingAfter = await collectMissingObjects();
  const stillMissing = flattenMissing(missingAfter);
  if (stillMissing.length > 0) {
    console.error('❌ Schema sau khi áp dụng KHÔNG khớp đặc tả:');
    for (const item of stillMissing) console.error(`   - ${item}`);
    return 1;
  }
  console.log(`  ✅ Đủ ${ENUM_SPECS.length} enum, ${TABLE_SPECS.length} bảng, ${COLUMN_SPECS.length} cột, ` +
    `${INDEX_SPECS.length} index, ${FK_SPECS.length} khoá ngoại.`);

  const finalCounts = await rowCounts().catch(() => []);
  const unchanged =
    counts.length === finalCounts.length &&
    counts.every(
      (row, position) =>
        row.table_name === finalCounts[position].table_name && Number(row.rows) === Number(finalCounts[position].rows),
    );
  console.log(
    unchanged
      ? '  ✅ Số bản ghi không đổi (không có dữ liệu nghiệp vụ nào bị sửa).'
      : '  ⚠️ Số bản ghi thay đổi — kiểm tra lại.',
  );
  if (!unchanged) return 1;

  console.log('\n✅ Hoàn tất schema delta của nền tảng.');
  return 0;
};

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = code ?? 0;
    })
    .catch((error) => {
      console.error(`❌ ${error?.message ?? error}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => undefined);
    });
}

module.exports = {
  STATEMENTS,
  ENUM_SPECS,
  TABLE_SPECS,
  COLUMN_SPECS,
  INDEX_SPECS,
  FK_SPECS,
  collectMissingObjects,
};

