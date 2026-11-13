'use strict';

/**
 * SEED DEV — khai báo số người ở đã xác minh cho dữ liệu hiện hữu.
 *
 * Vì sao cần: `generateInvoice` chặn bằng `OCCUPANCY_NOT_VERIFIED` khi phòng
 * chưa có khai báo VERIFIED (tiền nước tính theo đầu người). Trên DEV, các hợp
 * đồng ACTIVE đã tồn tại từ trước nên nếu không seed, chủ trọ không phát hành
 * được hoá đơn cho tới khi tenant tự khai + chủ trọ xác minh.
 *
 * Bất biến:
 *  - CHỈ chạy trên target DEV (scripts/lib/target-guard.js) và cần `--confirm`.
 *  - Idempotent: hợp đồng đã có khai báo PENDING/VERIFIED chưa bị thay thế thì
 *    bỏ qua; chạy lại nhiều lần không tạo thêm bản ghi.
 *  - KHÔNG sửa/xoá dữ liệu khác; chỉ INSERT vào room_occupancy_declarations.
 *  - `occupants = 1` là giá trị bảo thủ cho DEV (không suy đoán từ dữ liệu khác);
 *    tenant vẫn có thể khai lại số người thật, chủ trọ xác minh lại.
 */

require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const { assertDeploymentTarget } = require('./lib/target-guard');

const DECLARATION_TABLE = 'room_occupancy_declarations';
const DEFAULT_OCCUPANTS = 1;

const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

const prisma = new PrismaClient();

/** Các hợp đồng ACTIVE chưa có khai báo đang hiệu lực (PENDING/VERIFIED). */
const pendingContracts = () =>
  prisma.$queryRawUnsafe(`
    SELECT c."id" AS contract_id,
           c."room_id",
           c."tenant_id",
           r."room_number",
           r."max_occupants",
           p."landlord_id"
      FROM "contracts" c
      JOIN "rooms" r ON r."id" = c."room_id"
      JOIN "properties" p ON p."id" = r."property_id"
     WHERE c."status" = 'ACTIVE'
       AND NOT EXISTS (
         SELECT 1
           FROM "${DECLARATION_TABLE}" d
          WHERE d."room_id" = c."room_id"
            AND d."tenant_id" = c."tenant_id"
            AND d."status" IN ('PENDING', 'VERIFIED')
            AND d."superseded_at" IS NULL
       )
     ORDER BY c."created_at";`);

/** INSERT ... SELECT: một câu, idempotent nhờ NOT EXISTS ở trên. */
const insertStatement = `
INSERT INTO "${DECLARATION_TABLE}"
  ("id", "room_id", "tenant_id", "contract_id", "occupants", "status",
   "declared_by_id", "declared_at", "verified_by_id", "verified_at")
SELECT gen_random_uuid()::text,
       c."room_id",
       c."tenant_id",
       c."id",
       LEAST(${DEFAULT_OCCUPANTS}, GREATEST(r."max_occupants", 1)),
       'VERIFIED',
       c."tenant_id",
       now(),
       p."landlord_id",
       now()
  FROM "contracts" c
  JOIN "rooms" r ON r."id" = c."room_id"
  JOIN "properties" p ON p."id" = r."property_id"
 WHERE c."status" = 'ACTIVE'
   AND NOT EXISTS (
     SELECT 1
       FROM "${DECLARATION_TABLE}" d
      WHERE d."room_id" = c."room_id"
        AND d."tenant_id" = c."tenant_id"
        AND d."status" IN ('PENDING', 'VERIFIED')
        AND d."superseded_at" IS NULL
   );`;

const main = async () => {
  requireEnv(['DB_URL']);
  const confirm = process.argv.includes('--confirm');
  const target = assertDeploymentTarget(process.env.DB_URL);

  console.log(`🎯 Target (DEV): db=${target.database} host=${target.host}`);
  console.log('📋 Seed khai báo VERIFIED cho hợp đồng ACTIVE chưa có khai báo hiệu lực.');
  console.log(`   occupants mặc định = ${DEFAULT_OCCUPANTS} (tối đa theo rooms.max_occupants).`);

  const candidates = await pendingContracts();
  if (!candidates.length) {
    console.log('\n✅ Không có hợp đồng nào cần seed — mọi hợp đồng ACTIVE đã có khai báo.');
    return 0;
  }

  console.log(`\n📌 Sẽ tạo ${candidates.length} khai báo VERIFIED:`);
  for (const row of candidates) {
    console.log(
      `   - contract=${row.contract_id} room=${row.room_number} tenant=${row.tenant_id} ` +
        `occupants=${Math.min(DEFAULT_OCCUPANTS, Math.max(Number(row.max_occupants), 1))}`,
    );
  }

  if (!confirm) {
    console.log('\n⚠️  CHƯA GHI (thiếu --confirm). Đây là bản xem trước.');
    return 0;
  }

  const inserted = await prisma.$executeRawUnsafe(insertStatement);
  console.log(`\n✅ Đã tạo ${inserted} khai báo VERIFIED.`);

  const [{ rows }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS rows FROM "${DECLARATION_TABLE}" WHERE "status" = 'VERIFIED';`,
  );
  console.log(`   Tổng khai báo VERIFIED hiện có: ${rows}`);
  console.log('\n✅ Hoàn tất seed DEV. Không sửa bảng nào khác.');
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

module.exports = { pendingContracts, insertStatement, DEFAULT_OCCUPANTS };
