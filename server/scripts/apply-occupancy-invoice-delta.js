#!/usr/bin/env node
'use strict';

/**
 * OCCUPANCY & INVOICE DELTA — số người ở (tenant khai / chủ trọ xác minh) và
 * snapshot tính tiền điện–nước trên hoá đơn.
 *
 * Nguồn SQL chuẩn: `prisma/sql/occupancy-invoice-delta.sql` (chỉ để review).
 *
 * Vì sao cần:
 *  - Tiền nước tính theo ĐẦU NGƯỜI/kỳ nên cần một bản ghi "số người đã được chủ
 *    trọ xác minh" có lịch sử; `rooms.max_occupants` chỉ là SỨC CHỨA, không phải
 *    số người đang ở.
 *  - Hoá đơn đã phát hành phải giữ nguyên công thức tại thời điểm phát hành. Nếu
 *    chỉ đọc `rooms.water_rate`/số người hiện tại khi hiển thị, mọi thay đổi giá
 *    hoặc số người sau đó sẽ làm sai lịch sử.
 *
 * An toàn:
 *  - Mặc định CHỈ ĐỌC; chỉ ghi khi có `--confirm`.
 *  - Allowlist host DEV + từ chối `NODE_ENV=production`.
 *  - MỖI entry đúng MỘT câu SQL (`assertSingleStatement`).
 *  - Toàn bộ ADDITIVE: enum mới, bảng mới, cột nullable. Không sửa/xoá dữ liệu
 *    nghiệp vụ, không backfill, không đổi kiểu cột hiện có.
 *  - Idempotent ⇒ chạy lại sau gián đoạn là an toàn (resumable).
 *  - Xác minh lại đầy đủ sau khi áp; thiếu bất kỳ đối tượng nào ⇒ exit 1.
 *
 * Cách dùng:
 *   node scripts/apply-occupancy-invoice-delta.js            (preflight)
 *   node scripts/apply-occupancy-invoice-delta.js --confirm  (áp dụng)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { assertSingleStatement } = require('./lib/sql-statements');
const { assertDeploymentTarget } = require('./lib/target-guard');

const DECLARATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUPERSEDED'];
const ACTIVE_DECLARATION_STATUSES = ['PENDING', 'VERIFIED'];

const DECLARATION_TABLE = 'room_occupancy_declarations';
const ACTIVE_DECLARATION_INDEX = 'room_occupancy_declarations_one_active_per_tenant';

/** Cột snapshot trên `invoices`: [column, kiểu SQL, udt_name mong đợi]. */
const INVOICE_COLUMNS = [
  ['electricity_start', 'INTEGER', 'int4'],
  ['electricity_end', 'INTEGER', 'int4'],
  ['electricity_consumption', 'INTEGER', 'int4'],
  ['water_consumption', 'INTEGER', 'int4'],
  ['water_occupants', 'INTEGER', 'int4'],
  ['electricity_unit_price', 'DECIMAL(12, 2)', 'numeric'],
  ['water_unit_price', 'DECIMAL(12, 2)', 'numeric'],
  ['occupancy_declaration_id', 'TEXT', 'text'],
];

const STATEMENTS = [
  {
    label: "enum NotificationType += OCCUPANCY",
    sql: `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OCCUPANCY';`,
  },
  {
    label: 'enum OccupancyDeclarationStatus',
    sql: `DO $$
BEGIN
  CREATE TYPE "OccupancyDeclarationStatus" AS ENUM (${DECLARATION_STATUSES.map((value) => `'${value}'`).join(', ')});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: `bảng ${DECLARATION_TABLE}`,
    sql: `CREATE TABLE IF NOT EXISTS "${DECLARATION_TABLE}" (
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
);`,
  },
  {
    // Tên index = mặc định của Prisma (schema không dùng `map:`); DB đã áp bản
    // cũ được đổi tên tại chỗ để `prisma migrate diff` về 0.
    label: 'rename index lịch sử (room_id, tenant_id, verified_at) nếu còn tên cũ',
    sql: `DO $$
BEGIN
  IF to_regclass('public."room_occupancy_declarations_room_tenant_verified_idx"') IS NOT NULL
     AND to_regclass('public."room_occupancy_declarations_room_id_tenant_id_verified_at_idx"') IS NULL THEN
    ALTER INDEX "room_occupancy_declarations_room_tenant_verified_idx"
      RENAME TO "room_occupancy_declarations_room_id_tenant_id_verified_at_idx";
  END IF;
END $$;`,
  },
  {
    label: 'index lịch sử (room_id, tenant_id, verified_at)',
    sql: `CREATE INDEX IF NOT EXISTS "room_occupancy_declarations_room_id_tenant_id_verified_at_idx"
  ON "${DECLARATION_TABLE}" ("room_id", "tenant_id", "verified_at");`,
  },
  {
    label: 'rename index hàng đợi duyệt (status, declared_at) nếu còn tên cũ',
    sql: `DO $$
BEGIN
  IF to_regclass('public."room_occupancy_declarations_status_declared_idx"') IS NOT NULL
     AND to_regclass('public."room_occupancy_declarations_status_declared_at_idx"') IS NULL THEN
    ALTER INDEX "room_occupancy_declarations_status_declared_idx"
      RENAME TO "room_occupancy_declarations_status_declared_at_idx";
  END IF;
END $$;`,
  },
  {
    label: 'index hàng đợi duyệt (status, declared_at)',
    sql: `CREATE INDEX IF NOT EXISTS "room_occupancy_declarations_status_declared_at_idx"
  ON "${DECLARATION_TABLE}" ("status", "declared_at");`,
  },
  {
    label: `partial unique index ${ACTIVE_DECLARATION_INDEX}`,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "${ACTIVE_DECLARATION_INDEX}"
  ON "${DECLARATION_TABLE}" ("room_id", "tenant_id")
  WHERE "status" IN (${ACTIVE_DECLARATION_STATUSES.map((value) => `'${value}'`).join(', ')}) AND "superseded_at" IS NULL;`,
  },
  {
    label: 'FK room_occupancy_declarations.room_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "${DECLARATION_TABLE}" ADD CONSTRAINT "room_occupancy_declarations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK room_occupancy_declarations.tenant_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "${DECLARATION_TABLE}" ADD CONSTRAINT "room_occupancy_declarations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK room_occupancy_declarations.declared_by_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "${DECLARATION_TABLE}" ADD CONSTRAINT "room_occupancy_declarations_declared_by_id_fkey" FOREIGN KEY ("declared_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK room_occupancy_declarations.verified_by_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "${DECLARATION_TABLE}" ADD CONSTRAINT "room_occupancy_declarations_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
  {
    label: 'FK room_occupancy_declarations.contract_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "${DECLARATION_TABLE}" ADD CONSTRAINT "room_occupancy_declarations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
];

// Cột snapshot trên invoices — mỗi cột một câu ALTER (resumable từng cột).
for (const [column, sqlType] of INVOICE_COLUMNS) {
  STATEMENTS.push({
    label: `invoices: cột ${column}`,
    sql: `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "${column}" ${sqlType};`,
  });
}

STATEMENTS.push(
  {
    label: 'index invoices (occupancy_declaration_id)',
    sql: `CREATE INDEX IF NOT EXISTS "invoices_occupancy_declaration_id_idx" ON "invoices" ("occupancy_declaration_id");`,
  },
  {
    label: 'FK invoices.occupancy_declaration_id',
    sql: `DO $$
BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_occupancy_declaration_id_fkey" FOREIGN KEY ("occupancy_declaration_id") REFERENCES "${DECLARATION_TABLE}"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;`,
  },
);

/** Đối tượng bắt buộc sau khi áp dụng. */
const COLUMN_SPECS = [
  ['room_occupancy_declarations', 'id', 'text'],
  ['room_occupancy_declarations', 'room_id', 'text'],
  ['room_occupancy_declarations', 'tenant_id', 'text'],
  ['room_occupancy_declarations', 'contract_id', 'text'],
  ['room_occupancy_declarations', 'occupants', 'int4'],
  ['room_occupancy_declarations', 'status', 'OccupancyDeclarationStatus'],
  ['room_occupancy_declarations', 'declared_by_id', 'text'],
  ['room_occupancy_declarations', 'declared_at', 'timestamp'],
  ['room_occupancy_declarations', 'verified_by_id', 'text'],
  ['room_occupancy_declarations', 'verified_at', 'timestamp'],
  ['room_occupancy_declarations', 'rejection_reason', 'text'],
  ['room_occupancy_declarations', 'superseded_at', 'timestamp'],
  ...INVOICE_COLUMNS.map(([column, , udt]) => ['invoices', column, udt]),
];

const INDEX_SPECS = [
  ['room_occupancy_declarations', 'room_occupancy_declarations_room_id_tenant_id_verified_at_idx', false],
  ['room_occupancy_declarations', 'room_occupancy_declarations_status_declared_at_idx', false],
  // PostgreSQL chuẩn hoá `IN (...)` thành `= ANY (ARRAY[...])` trong
  // pg_get_expr ⇒ KHÔNG so khớp nguyên văn; kiểm tra từng mảnh ngữ nghĩa.
  ['room_occupancy_declarations', ACTIVE_DECLARATION_INDEX, true, ['PENDING', 'VERIFIED', 'superseded_at IS NULL']],
  ['invoices', 'invoices_occupancy_declaration_id_idx', false],
];

const FK_SPECS = [
  ['room_occupancy_declarations', 'room_occupancy_declarations_room_id_fkey', 'rooms'],
  ['room_occupancy_declarations', 'room_occupancy_declarations_tenant_id_fkey', 'users'],
  ['room_occupancy_declarations', 'room_occupancy_declarations_declared_by_id_fkey', 'users'],
  ['room_occupancy_declarations', 'room_occupancy_declarations_verified_by_id_fkey', 'users'],
  ['room_occupancy_declarations', 'room_occupancy_declarations_contract_id_fkey', 'contracts'],
  ['invoices', 'invoices_occupancy_declaration_id_fkey', DECLARATION_TABLE],
];


const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

const prisma = new PrismaClient();

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
    `SELECT c.conname AS constraint_name, rt.relname AS ref_table
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

/** Dữ liệu hiện có — chỉ đọc, để chứng minh DDL không sửa nghiệp vụ. */
const dataSnapshot = async () => {
  const [rooms] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS rows FROM rooms;`);
  const [contracts] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS rows FROM contracts;`);
  const [invoices] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS rows FROM invoices;`);
  return [
    { table_name: 'rooms', rows: rooms.rows },
    { table_name: 'contracts', rows: contracts.rows },
    { table_name: 'invoices', rows: invoices.rows },
  ];
};

/**
 * PostgreSQL chuẩn hoá `IN (...)` thành `= ANY (ARRAY[...])` trong `pg_get_expr`,
 * nên không thể so khớp nguyên văn câu SQL. Hàm này kiểm tra ngữ nghĩa: MỌI
 * mảnh mong đợi phải xuất hiện trong predicate thực tế.
 * @param {string|null|undefined} predicate
 * @param {string|string[]|undefined} expected
 */
const predicateMatchesFragments = (predicate, expected) => {
  const fragments = !expected ? [] : Array.isArray(expected) ? expected : [expected];
  const actual = String(predicate ?? '');
  return fragments.every((fragment) => actual.includes(fragment));
};

/**
 * Bản ghi "đang hoạt động" trùng (room, tenant) sẽ chặn partial unique index.
 * Bảng có thể chưa tồn tại ở lần chạy đầu ⇒ trả [] thay vì lỗi.
 */
const duplicateActiveDeclarations = () =>
  prisma
    .$queryRawUnsafe(
      `SELECT room_id, tenant_id, count(*)::int AS rows
         FROM "${DECLARATION_TABLE}"
        WHERE "status"::text IN ('PENDING', 'VERIFIED') AND "superseded_at" IS NULL
        GROUP BY room_id, tenant_id
       HAVING count(*) > 1
        ORDER BY rows DESC
        LIMIT 10;`,
    )
    .catch(() => []);

const collectMissingObjects = async () => {
  const missing = { enums: [], tables: [], columns: [], indexes: [], foreignKeys: [] };

  const notificationTypes = await enumValues('NotificationType').catch(() => []);
  if (!notificationTypes.some((row) => row.value === 'OCCUPANCY')) missing.enums.push('NotificationType.OCCUPANCY');

  const statuses = await enumValues('OccupancyDeclarationStatus').catch(() => []);
  for (const status of DECLARATION_STATUSES) {
    if (!statuses.some((row) => row.value === status)) missing.enums.push(`OccupancyDeclarationStatus.${status}`);
  }

  const [declarationTable] = await tableExists(DECLARATION_TABLE).catch(() => []);
  if (!declarationTable || Number(declarationTable.present) === 0) missing.tables.push(DECLARATION_TABLE);

  const tablesToInspect = [...new Set(COLUMN_SPECS.map(([table]) => table))];
  const columnsByTable = {};
  for (const table of tablesToInspect) columnsByTable[table] = await columnsOf(table).catch(() => []);
  for (const [table, column, expectedType] of COLUMN_SPECS) {
    const found = columnsByTable[table]?.find((row) => row.column_name === column);
    if (!found) missing.columns.push(`${table}.${column}`);
    else if (expectedType && found.udt_name !== expectedType) {
      missing.columns.push(`${table}.${column} (kiểu ${found.udt_name}, cần ${expectedType})`);
    }
  }

  for (const [table, index, expectUnique, predicateFragment] of INDEX_SPECS) {
    const [row] = await indexInfo(table, index).catch(() => []);
    if (!row) {
      missing.indexes.push(`${table}.${index}`);
      continue;
    }
    const predicateOk = predicateMatchesFragments(row.predicate, predicateFragment);
    if (Boolean(row.is_unique) !== expectUnique || !row.is_valid || !row.is_ready || !predicateOk) {
      missing.indexes.push(`${table}.${index} (unique=${row.is_unique}, valid=${row.is_valid}, predicate=${row.predicate})`);
    }
  }

  for (const [table, constraint, refTable] of FK_SPECS) {
    const [row] = await foreignKeyInfo(table, constraint).catch(() => []);
    if (!row || row.ref_table !== refTable) missing.foreignKeys.push(`${table}.${constraint}`);
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
  const notificationTypes = await enumValues('NotificationType').catch(() => []);
  const declarationStatuses = await enumValues('OccupancyDeclarationStatus').catch(() => []);
  console.log(`  NotificationType: ${notificationTypes.map((row) => row.value).join(', ') || '(không đọc được)'}`);
  console.log(`  OccupancyDeclarationStatus: ${declarationStatuses.map((row) => row.value).join(', ') || '(chưa có)'}`);

  const snapshot = await dataSnapshot().catch(() => []);
  for (const row of snapshot) console.log(`  ${row.table_name}: ${row.rows} (sẽ KHÔNG bị sửa)`);

  const duplicates = await duplicateActiveDeclarations();
  if (duplicates.length > 0) {
    console.error('\n⛔ Có (room, tenant) đang có >1 khai báo PENDING/VERIFIED — KHÔNG tạo unique index.');
    for (const row of duplicates) {
      console.error(`  room=${row.room_id} tenant=${row.tenant_id} rows=${row.rows}`);
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
      console.error('   Mỗi câu đã chạy đều đã commit và idempotent ⇒ sửa nguyên nhân rồi CHẠY LẠI, không cần rollback.');
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
  const [activeIndex] = await indexInfo(DECLARATION_TABLE, ACTIVE_DECLARATION_INDEX).catch(() => []);
  console.log(`  ✅ Đủ ${COLUMN_SPECS.length} cột, ${INDEX_SPECS.length} index, ${FK_SPECS.length} khoá ngoại.`);
  console.log(`  ${ACTIVE_DECLARATION_INDEX}: unique=${activeIndex?.is_unique} predicate=${activeIndex?.predicate}`);

  const finalSnapshot = await dataSnapshot().catch(() => []);
  const unchanged =
    snapshot.length === finalSnapshot.length &&
    snapshot.every(
      (row, position) =>
        row.table_name === finalSnapshot[position].table_name && Number(row.rows) === Number(finalSnapshot[position].rows),
    );
  console.log(
    unchanged
      ? '  ✅ Số bản ghi không đổi (không có dữ liệu nghiệp vụ nào bị sửa).'
      : '  ⚠️ Số bản ghi thay đổi — kiểm tra lại.',
  );
  if (!unchanged) return 1;

  console.log('\n✅ Hoàn tất schema delta occupancy & invoice snapshot.');
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
  DECLARATION_STATUSES,
  ACTIVE_DECLARATION_STATUSES,
  DECLARATION_TABLE,
  ACTIVE_DECLARATION_INDEX,
  INVOICE_COLUMNS,
  COLUMN_SPECS,
  INDEX_SPECS,
  FK_SPECS,
  collectMissingObjects,
  predicateMatchesFragments,
};

