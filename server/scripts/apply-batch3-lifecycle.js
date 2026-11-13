#!/usr/bin/env node
'use strict';

/**
 * BATCH 3 — schema delta cho vòng đời THỰC THI & NGHIỆM THU của công việc bảo trì.
 *
 * Nguồn SQL chuẩn: `prisma/sql/batch-3-staff-completion-lifecycle.sql`.
 *
 * An toàn (cùng khuôn với `apply-maintenance-task-index.js`):
 *  - Mặc định CHỈ ĐỌC: in target, trạng thái hiện tại, preflight trùng lặp và
 *    đúng các câu SQL sẽ chạy.
 *  - Chỉ ghi khi có `--confirm`.
 *  - Từ chối chạy khi `NODE_ENV=production`.
 *  - Mọi câu đều idempotent (`IF NOT EXISTS` / `duplicate_object`), chạy lại
 *    nhiều lần không đổi kết quả.
 *  - Không sửa/xoá dữ liệu nghiệp vụ. Preflight thấy sự cố có >1 công việc
 *    đang hoạt động thì DỪNG (mã 2) và in ra để con người quyết định.
 *
 * Cách dùng:
 *   node scripts/apply-batch3-lifecycle.js            (preflight, chỉ đọc)
 *   node scripts/apply-batch3-lifecycle.js --confirm  (áp dụng)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { assertSingleStatement } = require('./lib/sql-statements');
const { assertDeploymentTarget } = require('./lib/target-guard');

/** Trạng thái "đang hoạt động" — phải khớp predicate của partial unique index. */
const ACTIVE_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'];

/** Trạng thái Batch 3 bắt buộc phải có sau khi áp dụng. */
const REQUIRED_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'COMPLETED'];

const INDEX_NAME = 'maintenance_tasks_one_active_per_issue';
/** Index đơn cũ bị thay bởi composite (task_id, kind) — xem §A3 của báo cáo. */
const LEGACY_IMAGE_INDEX = 'maintenance_task_images_task_id_idx';
const COMPOSITE_IMAGE_INDEX = 'maintenance_task_images_task_id_kind_idx';


const STATEMENTS = [
  {
    label: 'enum MaintenanceTaskStatus += IN_PROGRESS',
    sql: `ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';`,
  },
  {
    label: 'enum MaintenanceTaskStatus += SUBMITTED',
    sql: `ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';`,
  },
  {
    label: 'enum MaintenanceTaskStatus += COMPLETED',
    sql: `ALTER TYPE "MaintenanceTaskStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';`,
  },
  {
    label: 'enum MaintenanceTaskImageKind',
    sql: `DO $$
BEGIN
  CREATE TYPE "MaintenanceTaskImageKind" AS ENUM ('TASK', 'COMPLETION');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'maintenance_tasks: cột dấu vết thực thi/nghiệm thu',
    sql: `ALTER TABLE "maintenance_tasks"
  ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_reviewed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completion_review_note" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_attempts" INTEGER NOT NULL DEFAULT 0;`,
  },
  {
    label: 'maintenance_task_images: cột kind',
    sql: `ALTER TABLE "maintenance_task_images"
  ADD COLUMN IF NOT EXISTS "kind" "MaintenanceTaskImageKind" NOT NULL DEFAULT 'TASK';`,
  },
  {
    label: 'index tra cứu (assigned_staff_id, status)',
    sql: `CREATE INDEX IF NOT EXISTS "maintenance_tasks_assigned_staff_id_status_idx"
  ON "maintenance_tasks" ("assigned_staff_id", "status");`,
  },
  {
    label: 'index tra cứu (task_id, kind)',
    sql: `CREATE INDEX IF NOT EXISTS "maintenance_task_images_task_id_kind_idx"
  ON "maintenance_task_images" ("task_id", "kind");`,
  },
  {
    label: `drop index cũ bị thay thế ${LEGACY_IMAGE_INDEX}`,
    sql: `DROP INDEX IF EXISTS "${LEGACY_IMAGE_INDEX}";`,
  },
  {
    label: `drop partial unique index ${INDEX_NAME} (sẽ tạo lại với predicate rộng hơn)`,
    sql: `DROP INDEX IF EXISTS "${INDEX_NAME}";`,
  },
  {
    label: `tạo lại ${INDEX_NAME} phủ ${ACTIVE_STATUSES.join('/')}`,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_NAME}"
  ON "maintenance_tasks" ("source_issue_id")
  WHERE "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');`,
  },
];

const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

const prisma = new PrismaClient();

const text = (value) => (value === null || value === undefined ? '' : String(value));

const statusEnumValues = () =>
  prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'MaintenanceTaskStatus'
      ORDER BY e.enumsortorder;`,
  );

const imageKindEnumValues = () =>
  prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'MaintenanceTaskImageKind'
      ORDER BY e.enumsortorder;`,
  );

const taskColumns = () =>
  prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'maintenance_tasks'
        AND column_name IN ('status', 'started_at', 'completion_submitted_at',
                            'completion_note', 'completion_reviewed_at',
                            'completion_review_note', 'completion_attempts')
      ORDER BY column_name;`,
  );

const imageColumns = () =>
  prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'maintenance_task_images'
        AND column_name IN ('kind', 'image_url')
      ORDER BY column_name;`,
  );

const indexDefs = () =>
  prisma.$queryRawUnsafe(
    `SELECT tablename, indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('maintenance_tasks', 'maintenance_task_images')
      ORDER BY tablename, indexname;`,
  );

const activeTaskIndex = () =>
  prisma.$queryRawUnsafe(
    `SELECT i.relname AS index_name,
            ix.indisunique AS is_unique,
            pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
            pg_get_indexdef(ix.indexrelid) AS definition
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
      WHERE t.relname = 'maintenance_tasks' AND i.relname = $1;`,
    INDEX_NAME,
  );

/** Thông tin một index bất kỳ (unique/valid/ready + cột) — dùng kiểm tra index ảnh. */
const indexInfo = (table, index) =>
  prisma.$queryRawUnsafe(
    `SELECT i.relname AS index_name,
            ix.indisunique AS is_unique,
            ix.indisvalid AS is_valid,
            ix.indisready AS is_ready,
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

/**
 * Đếm sự cố có >1 công việc đang hoạt động.
 *
 * `statuses` chỉ chứa giá trị ĐANG CÓ trong kiểu enum của DB: trước khi áp
 * schema delta, lọc `status IN ('IN_PROGRESS', …)` sẽ làm PostgreSQL báo
 * `22P02 invalid input value for enum` — preflight phải chạy được TRƯỚC khi
 * đổi enum, nên danh sách được lọc theo enum thực tế. Giá trị luôn lấy từ hằng
 * số `ACTIVE_STATUSES` (không phải input người dùng).
 */
const duplicateActiveTasks = (statuses) => {
  const list = statuses.map((status) => `'${status}'`).join(', ');
  return prisma.$queryRawUnsafe(
    `SELECT source_issue_id, count(*)::int AS active_tasks
       FROM maintenance_tasks
      WHERE status::text IN (${list})
      GROUP BY source_issue_id
     HAVING count(*) > 1
      ORDER BY active_tasks DESC, source_issue_id;`,
  );
};

const rowCounts = () =>
  prisma.$queryRawUnsafe(
    `SELECT 'maintenance_tasks' AS table_name, count(*)::int AS rows FROM maintenance_tasks
     UNION ALL
     SELECT 'maintenance_task_images', count(*)::int FROM maintenance_task_images
     UNION ALL
     SELECT 'maintenance_task_applications', count(*)::int FROM maintenance_task_applications
     UNION ALL
     SELECT 'maintenance_requests', count(*)::int FROM maintenance_requests;`,
  );

const predicateCoversActiveStatuses = (predicate) => {
  const normalized = text(predicate).toUpperCase();
  return Boolean(normalized) && ACTIVE_STATUSES.every((status) => normalized.includes(`'${status}'`));
};

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
  const [statuses, kinds, tasks, images, indexes] = await Promise.all([
    statusEnumValues(),
    imageKindEnumValues().catch(() => []),
    taskColumns(),
    imageColumns(),
    indexDefs(),
  ]);
  console.log(`  MaintenanceTaskStatus: ${statuses.map((row) => row.value).join(', ') || '(không đọc được)'}`);
  console.log(`  MaintenanceTaskImageKind: ${kinds.map((row) => row.value).join(', ') || '(chưa có)'}`);
  for (const column of tasks) {
    console.log(
      `  maintenance_tasks.${column.column_name}: ${column.data_type} (${column.udt_name}) nullable=${column.is_nullable} default=${text(column.column_default) || '—'}`,
    );
  }
  for (const column of images) {
    console.log(
      `  maintenance_task_images.${column.column_name}: ${column.data_type} (${column.udt_name}) nullable=${column.is_nullable} default=${text(column.column_default) || '—'}`,
    );
  }
  console.log('  Index hiện có:');
  for (const index of indexes) console.log(`    ${index.tablename}.${index.indexname}: ${index.indexdef}`);

  const counts = await rowCounts().catch(() => []);
  if (counts.length) {
    console.log('  Số bản ghi (dữ liệu sẽ KHÔNG bị sửa):');
    for (const row of counts) console.log(`    ${row.table_name}: ${row.rows}`);
  }

  const duplicates = await duplicateActiveTasks(
    ACTIVE_STATUSES.filter((status) => statuses.some((row) => row.value === status)),
  );
  if (duplicates.length > 0) {
    console.error('\n⛔ Có sự cố đang có NHIỀU công việc hoạt động — KHÔNG áp dụng index.');
    for (const row of duplicates) {
      console.error(`  issue=${row.source_issue_id} active_tasks=${row.active_tasks}`);
    }
    console.error('  Cần con người quyết định trước (không tự sửa dữ liệu nghiệp vụ).');
    return 2;
  }
  console.log(`\n✅ Preflight: không có sự cố nào có >1 công việc ${ACTIVE_STATUSES.join('/')}.`);

  const existing = await activeTaskIndex();
  const [compositeImageIndex] = await indexInfo('maintenance_task_images', COMPOSITE_IMAGE_INDEX).catch(() => []);
  const [legacyImageIndex] = await indexInfo('maintenance_task_images', LEGACY_IMAGE_INDEX).catch(() => []);
  const compositeImageColumns = Array.isArray(compositeImageIndex?.columns)
    ? compositeImageIndex.columns.map(String)
    : [];
  const imageIndexesComplete =
    compositeImageColumns.length === 2 &&
    compositeImageColumns[0] === 'task_id' &&
    compositeImageColumns[1] === 'kind' &&
    Boolean(compositeImageIndex?.is_valid) &&
    Boolean(compositeImageIndex?.is_ready) &&
    !legacyImageIndex;

  const requiredColumns = [
    'started_at',
    'completion_submitted_at',
    'completion_note',
    'completion_reviewed_at',
    'completion_review_note',
    'completion_attempts',
  ];
  const kindColumnExisting = images.find((column) => column.column_name === 'kind');
  const alreadyComplete =
    REQUIRED_STATUSES.every((status) => statuses.some((row) => row.value === status)) &&
    requiredColumns.every((name) => tasks.some((column) => column.column_name === name)) &&
    Boolean(kindColumnExisting) &&
    existing.length === 1 &&
    Boolean(existing[0].is_unique) &&
    predicateCoversActiveStatuses(existing[0].predicate) &&
    imageIndexesComplete;

  if (alreadyComplete) {
    console.log('\n✅ Schema đã đúng đặc tả Batch 3 — không cần chạy lại.');
    console.log(`  predicate=${text(existing[0].predicate)}`);
    return 0;
  }

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
      console.error('   Mọi câu đã chạy đều đã commit và đều idempotent ⇒ sửa nguyên nhân rồi CHẠY LẠI, không cần rollback.');
      return 1;
    }
  }

  // ---- Verify --------------------------------------------------------------
  const [afterStatuses, afterKinds, afterTasks, afterImages, afterIndex] = await Promise.all([
    statusEnumValues(),
    imageKindEnumValues().catch(() => []),
    taskColumns(),
    imageColumns(),
    activeTaskIndex(),
  ]);
  const [afterCompositeImageIndex] = await indexInfo('maintenance_task_images', COMPOSITE_IMAGE_INDEX).catch(() => []);
  const [afterLegacyImageIndex] = await indexInfo('maintenance_task_images', LEGACY_IMAGE_INDEX).catch(() => []);
  const afterCompositeColumns = Array.isArray(afterCompositeImageIndex?.columns)
    ? afterCompositeImageIndex.columns.map(String)
    : [];
  const missingStatuses = REQUIRED_STATUSES.filter(
    (status) => !afterStatuses.some((row) => row.value === status),
  );
  const missingColumns = requiredColumns.filter(
    (name) => !afterTasks.some((column) => column.column_name === name),
  );
  const kindColumn = afterImages.find((column) => column.column_name === 'kind');
  const index = afterIndex[0];
  const imageIndexesOk =
    afterCompositeColumns.length === 2 &&
    afterCompositeColumns[0] === 'task_id' &&
    afterCompositeColumns[1] === 'kind' &&
    Boolean(afterCompositeImageIndex?.is_valid) &&
    Boolean(afterCompositeImageIndex?.is_ready) &&
    !afterLegacyImageIndex;

  console.log('\n🔎 Xác minh sau khi áp dụng');
  console.log(`  enum status: ${afterStatuses.map((row) => row.value).join(', ')}`);
  console.log(`  enum image kind: ${afterKinds.map((row) => row.value).join(', ')}`);
  console.log(
    `  kind column: ${kindColumn ? `${kindColumn.udt_name} nullable=${kindColumn.is_nullable} default=${text(kindColumn.column_default)}` : 'THIẾU'}`,
  );
  console.log(`  index: ${index ? `unique=${index.is_unique} predicate=${text(index.predicate)}` : 'THIẾU'}`);
  console.log(
    `  ${COMPOSITE_IMAGE_INDEX}: ${afterCompositeColumns.join(', ') || 'THIẾU'} (valid=${afterCompositeImageIndex?.is_valid ?? false})`,
  );
  console.log(`  ${LEGACY_IMAGE_INDEX}: ${afterLegacyImageIndex ? 'VẪN CÒN' : 'đã xoá'}`);

  const ok =
    missingStatuses.length === 0 &&
    missingColumns.length === 0 &&
    Boolean(kindColumn) &&
    kindColumn.udt_name === 'MaintenanceTaskImageKind' &&
    kindColumn.is_nullable === 'NO' &&
    Boolean(index) &&
    Boolean(index.is_unique) &&
    predicateCoversActiveStatuses(index.predicate) &&
    imageIndexesOk;

  if (!ok) {
    if (missingStatuses.length) console.error(`❌ Thiếu enum: ${missingStatuses.join(', ')}`);
    if (missingColumns.length) console.error(`❌ Thiếu cột: ${missingColumns.join(', ')}`);
    if (!imageIndexesOk) console.error('❌ Index ảnh không đúng: cần composite (task_id, kind) và đã xoá index đơn cũ.');
    console.error('❌ Schema sau khi áp dụng KHÔNG khớp đặc tả — kiểm tra lại bằng tay.');
    return 1;
  }

  const finalCounts = await rowCounts().catch(() => []);
  const unchanged =
    counts.length === finalCounts.length &&
    counts.every(
      (row, position) =>
        row.table_name === finalCounts[position].table_name && row.rows === finalCounts[position].rows,
    );
  console.log(
    unchanged
      ? '  ✅ Số bản ghi không đổi (không có dữ liệu nghiệp vụ nào bị sửa).'
      : '  ⚠️ Số bản ghi thay đổi — kiểm tra lại.',
  );
  console.log('\n✅ Hoàn tất schema delta Batch 3.');
  return unchanged ? 0 : 1;
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
  ACTIVE_STATUSES,
  REQUIRED_STATUSES,
  INDEX_NAME,
  LEGACY_IMAGE_INDEX,
  COMPOSITE_IMAGE_INDEX,
  predicateCoversActiveStatuses,
};
