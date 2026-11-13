#!/usr/bin/env node
'use strict';

/**
 * PARTIAL UNIQUE INDEX "một công việc ĐANG HOẠT ĐỘNG cho mỗi sự cố nguồn".
 *
 *   CREATE UNIQUE INDEX maintenance_tasks_one_active_per_issue
 *     ON maintenance_tasks (source_issue_id)
 *     WHERE status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED');
 *
 * Vì sao predicate phải đủ 4 trạng thái: sau khi thợ bấm "Bắt đầu"
 * (ASSIGNED → IN_PROGRESS) hoặc gửi nghiệm thu (SUBMITTED), công việc phải TIẾP
 * TỤC nằm trong predicate. Predicate hẹp (`OPEN, ASSIGNED`) mà Batch 2.2 từng
 * dùng sẽ để lọt việc thứ hai cho cùng sự cố ngay khi việc đầu đang thi công.
 *
 * Script này là lớp cuối cùng (ứng dụng đã chạy Serializable + P2034 → 409):
 * `prisma db push` KHÔNG quản lý partial index nên ràng buộc phải tạo bằng SQL.
 *
 * An toàn:
 *  - Mặc định CHỈ ĐỌC: kiểm tra trùng lặp + in đúng câu SQL sẽ chạy.
 *  - Chỉ ghi khi có `--confirm`.
 *  - Allowlist host DEV (`scripts/lib/target-guard.js`), từ chối production.
 *  - Nếu preflight thấy sự cố có >1 công việc đang hoạt động: KHÔNG sửa dữ liệu,
 *    in issue id ra và thoát mã 2.
 *  - Index đã tồn tại nhưng predicate HẸP: `--confirm` sẽ DROP + CREATE lại.
 *    Không `--confirm` thì thoát mã 2 và nói rõ đây KHÔNG phải trạng thái đạt.
 *
 * Cách dùng:
 *   node scripts/apply-maintenance-task-index.js            (preflight, chỉ đọc)
 *   node scripts/apply-maintenance-task-index.js --confirm  (áp dụng)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { assertSingleStatement } = require('./lib/sql-statements');
const { assertDeploymentTarget } = require('./lib/target-guard');

const INDEX_NAME = 'maintenance_tasks_one_active_per_issue';

/** Predicate CHUẨN — phải khớp Batch 3 (`apply-batch3-lifecycle.js`). */
const EXPECTED_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'];

const CREATE_SQL = `CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX_NAME}"
  ON "maintenance_tasks" ("source_issue_id")
  WHERE "status" IN (${EXPECTED_STATUSES.map((status) => `'${status}'`).join(', ')});`;

const DROP_SQL = `DROP INDEX IF EXISTS "${INDEX_NAME}";`;

const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

const prisma = new PrismaClient();

const textOrEmpty = (value) => (value === null || value === undefined ? '' : String(value));

const tableColumns = () =>
  prisma.$queryRawUnsafe(
    `SELECT column_name, data_type, udt_name, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'maintenance_tasks'
        AND column_name IN ('source_issue_id', 'status')
      ORDER BY column_name;`,
  );

const statusEnum = () =>
  prisma.$queryRawUnsafe(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'MaintenanceTaskStatus'
      ORDER BY e.enumsortorder;`,
  );

const existingIndexes = () =>
  prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'maintenance_tasks'
      ORDER BY indexname;`,
  );

const targetIndex = () =>
  prisma.$queryRawUnsafe(
    `SELECT i.relname AS index_name,
            ix.indisunique AS is_unique,
            ix.indisvalid AS is_valid,
            ix.indisready AS is_ready,
            pg_get_expr(ix.indpred, ix.indrelid) AS predicate,
            pg_get_indexdef(ix.indexrelid) AS definition
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
      WHERE t.relname = 'maintenance_tasks'
        AND t.relnamespace = 'public'::regnamespace
        AND i.relname = $1;`,
    INDEX_NAME,
  );

const duplicateActiveTasks = (statuses) => {
  // Chỉ dùng giá trị ĐANG CÓ trong enum để preflight chạy được trước khi áp Batch 3.
  const list = statuses.map((status) => `'${status}'`).join(', ');
  if (!list) return Promise.resolve([]);
  return prisma.$queryRawUnsafe(
    `SELECT source_issue_id, count(*)::int AS active_tasks
       FROM maintenance_tasks
      WHERE status::text IN (${list})
      GROUP BY source_issue_id
     HAVING count(*) > 1
      ORDER BY active_tasks DESC, source_issue_id;`,
  );
};

/**
 * Predicate phải phủ ĐÚNG bốn trạng thái hoạt động và KHÔNG chứa CANCELLED.
 * So khớp theo token `'STATUS'` để tránh nhầm `'OPEN'` với chuỗi khác.
 */
const predicateCoversExpectedStatuses = (predicate) => {
  const normalized = textOrEmpty(predicate).toUpperCase();
  if (!normalized) return false;
  const hasAll = EXPECTED_STATUSES.every((status) => normalized.includes(`'${status}'`));
  return hasAll && !normalized.includes(`'CANCELLED'`);
};

const indexIsCorrect = (index) =>
  Boolean(index) &&
  Boolean(index.is_unique) &&
  Boolean(index.is_valid) &&
  Boolean(index.is_ready) &&
  predicateCoversExpectedStatuses(index.predicate);

const main = async () => {
  requireEnv(['DB_URL']);
  const confirm = process.argv.includes('--confirm');
  const target = assertDeploymentTarget(process.env.DB_URL);

  assertSingleStatement(CREATE_SQL, `CREATE ${INDEX_NAME}`);
  assertSingleStatement(DROP_SQL, `DROP ${INDEX_NAME}`);

  console.log(`🎯 Target (DEV): db=${target.database} host=${target.host}`);
  console.log(`📋 Index: ${INDEX_NAME}`);
  console.log(`📋 Predicate chuẩn: status IN (${EXPECTED_STATUSES.join(', ')})`);
  console.log(`📋 SQL sẽ áp dụng:\n${CREATE_SQL.split('\n').map((line) => `   ${line}`).join('\n')}`);

  // ---- Preflight (chỉ đọc) ------------------------------------------------
  const columns = await tableColumns();
  console.log('\n🔎 Cột liên quan');
  for (const column of columns) {
    console.log(`  ${column.column_name}: ${column.data_type} (${column.udt_name}) nullable=${column.is_nullable}`);
  }

  const enumValues = await statusEnum().catch(() => []);
  console.log(`\n🔎 MaintenanceTaskStatus: ${enumValues.map((row) => row.value).join(', ') || '(không đọc được)'}`);

  const indexes = await existingIndexes();
  console.log('\n🔎 Index hiện có trên maintenance_tasks');
  for (const index of indexes) console.log(`  ${index.indexname}: ${index.indexdef}`);

  const [existing] = await targetIndex();
  if (existing) {
    console.log('\n🔎 Index đích đã tồn tại');
    console.log(`  unique=${existing.is_unique} valid=${existing.is_valid} ready=${existing.is_ready}`);
    console.log(`  predicate=${textOrEmpty(existing.predicate)}`);
    console.log(`  ${textOrEmpty(existing.definition)}`);
    if (indexIsCorrect(existing)) {
      console.log('\n✅ Index đã ĐÚNG đặc tả (unique + partial phủ đủ 4 trạng thái) — không cần làm gì.');
      return 0;
    }
    console.error('\n⛔ Index tồn tại nhưng KHÔNG đúng đặc tả (predicate hẹp/thiếu unique/không valid).');
    console.error('   Trạng thái này KHÔNG được coi là đạt: công việc IN_PROGRESS/SUBMITTED sẽ rơi khỏi predicate.');
    if (!confirm) {
      console.log('⚠️  CHƯA SỬA (thiếu --confirm). Chạy lại với --confirm để DROP + CREATE lại index đúng predicate.');
      return 2;
    }
  }

  const duplicates = await duplicateActiveTasks(
    EXPECTED_STATUSES.filter((status) => enumValues.some((row) => row.value === status)),
  );
  if (duplicates.length > 0) {
    console.error('\n⛔ Có sự cố đang có NHIỀU công việc hoạt động — KHÔNG áp dụng index.');
    for (const row of duplicates) {
      console.error(`  issue=${row.source_issue_id} active_tasks=${row.active_tasks}`);
    }
    console.error('  Cần con người quyết định trước (không tự sửa dữ liệu nghiệp vụ).');
    return 2;
  }
  console.log(`\n✅ Preflight: không có sự cố nào có >1 công việc ${EXPECTED_STATUSES.join('/')}.`);

  if (!confirm) {
    console.log('\n⚠️  CHƯA ÁP DỤNG (thiếu --confirm). Đây là bản xem trước, KHÔNG phải deploy thành công.');
    return 0;
  }

  // ---- Apply ---------------------------------------------------------------
  if (existing) {
    console.log('\n🚀 DROP index cũ (predicate hẹp) rồi tạo lại...');
    await prisma.$executeRawUnsafe(DROP_SQL);
  } else {
    console.log('\n🚀 Tạo index...');
  }
  await prisma.$executeRawUnsafe(CREATE_SQL);

  const [verified] = await targetIndex();
  if (!verified) {
    console.error('❌ Không đọc lại được index sau khi tạo.');
    return 1;
  }
  console.log('✅ Đã tạo index');
  console.log(`  ${textOrEmpty(verified.definition)}`);
  console.log(`  unique=${verified.is_unique} valid=${verified.is_valid} ready=${verified.is_ready}`);
  console.log(`  predicate=${textOrEmpty(verified.predicate)}`);

  if (!indexIsCorrect(verified)) {
    console.error('❌ Index sau khi tạo KHÔNG đúng đặc tả (unique/valid/predicate) — kiểm tra lại bằng tay.');
    return 1;
  }
  console.log('\n✅ Xác minh từ pg_catalog: unique + valid + partial trên (source_issue_id) phủ đủ 4 trạng thái.');
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
  INDEX_NAME,
  EXPECTED_STATUSES,
  CREATE_SQL,
  DROP_SQL,
  predicateCoversExpectedStatuses,
  indexIsCorrect,
};

