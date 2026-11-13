'use strict';

/**
 * RECONCILE DEV — phòng đã thuê thì không còn nhu cầu thuê/xem phòng.
 *
 * Vì sao cần: luồng runtime đã huỷ nhu cầu ngay khi phòng chuyển `RENTED`
 * (`roomDemand.service.ts`), nhưng dữ liệu cũ có thể lệch theo hai hướng:
 *  1. Có hợp đồng `ACTIVE` mà `rooms.status` vẫn là `AVAILABLE` ⇒ tenant vẫn
 *     thấy phòng "còn trống" và gửi yêu cầu/đặt lịch mới.
 *  2. Yêu cầu thuê `SUBMITTED`/`CONTRACT_READY`, lịch xem `PENDING`/`CONFIRMED`
 *     còn mở trên phòng đã thuê (tạo trước khi có luồng huỷ).
 *
 * Bất biến:
 *  - "Đã thuê" = có hợp đồng `ACTIVE` HOẶC `rooms.status = 'RENTED'`.
 *  - CHỈ chạy trên target DEV (scripts/lib/target-guard.js) và cần `--confirm`.
 *  - Idempotent: mọi lệnh UPDATE đều kèm điều kiện trạng thái ⇒ chạy lại là no-op.
 *  - KHÔNG xoá bản ghi, KHÔNG sửa hợp đồng/hoá đơn; chỉ đồng bộ `rooms.status`
 *    và chuyển nhu cầu còn mở sang `CANCELLED`.
 *  - Không gửi thông báo: đây là bản vá dữ liệu DEV; luồng runtime mới là nơi
 *    phát thông báo cho tenant.
 */

require('dotenv').config({ path: '.env' });

const { PrismaClient } = require('@prisma/client');
const { assertDeploymentTarget } = require('./lib/target-guard');

const prisma = new PrismaClient();

const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`❌ Thiếu biến môi trường: ${missing.join(', ')}`);
    process.exit(1);
  }
};

/** Phòng có hợp đồng ACTIVE nhưng trạng thái chưa phải RENTED. */
const driftRoomsQuery = `
  SELECT r."id", r."room_number", p."name" AS "property_name"
    FROM "rooms" r
    JOIN "properties" p ON p."id" = r."property_id"
   WHERE r."status" <> 'RENTED'
     AND EXISTS (
       SELECT 1 FROM "contracts" c
        WHERE c."room_id" = r."id" AND c."status" = 'ACTIVE'
     )
   ORDER BY p."name", r."room_number";`;

/** Yêu cầu thuê còn mở trên phòng đã thuê. */
const openRequestsQuery = `
  SELECT rr."id", rr."status", rr."room_id", r."room_number"
    FROM "rental_requests" rr
    JOIN "rooms" r ON r."id" = rr."room_id"
   WHERE rr."status" IN ('SUBMITTED', 'CONTRACT_READY')
     AND (
       r."status" = 'RENTED'
       OR EXISTS (
         SELECT 1 FROM "contracts" c
          WHERE c."room_id" = rr."room_id" AND c."status" = 'ACTIVE'
       )
     )
   ORDER BY r."room_number", rr."created_at";`;

/** Lịch xem còn mở trên phòng đã thuê (khớp theo phòng hoặc bài đăng của phòng). */
const openAppointmentsQuery = `
  SELECT a."id", a."status", a."appointment_time", a."room_id", r."room_number"
    FROM "appointments" a
    LEFT JOIN "rooms" r ON r."id" = a."room_id"
   WHERE a."status" IN ('PENDING', 'CONFIRMED')
     AND (
       EXISTS (
         SELECT 1 FROM "rooms" ar
          WHERE ar."id" = a."room_id" AND ar."status" = 'RENTED'
       )
       OR EXISTS (
         SELECT 1 FROM "contracts" c
          WHERE c."status" = 'ACTIVE'
            AND (
              c."room_id" = a."room_id"
              OR c."room_id" = (SELECT p."room_id" FROM "posts" p WHERE p."id" = a."post_id")
            )
       )
     )
   ORDER BY a."appointment_time";`;

/** Đồng bộ trạng thái phòng theo hợp đồng ACTIVE. */
const markRoomsRentedStatement = `
  UPDATE "rooms" r
     SET "status" = 'RENTED'
   WHERE r."status" <> 'RENTED'
     AND EXISTS (
       SELECT 1 FROM "contracts" c
        WHERE c."room_id" = r."id" AND c."status" = 'ACTIVE'
     );`;

/** Huỷ yêu cầu thuê còn mở (giữ nguyên yêu cầu đã duyệt/ký). */
const cancelRequestsStatement = `
  UPDATE "rental_requests" rr
     SET "status" = 'CANCELLED', "updated_at" = now()
   WHERE rr."status" IN ('SUBMITTED', 'CONTRACT_READY')
     AND (
       EXISTS (
         SELECT 1 FROM "rooms" r
          WHERE r."id" = rr."room_id" AND r."status" = 'RENTED'
       )
       OR EXISTS (
         SELECT 1 FROM "contracts" c
          WHERE c."room_id" = rr."room_id" AND c."status" = 'ACTIVE'
       )
     );`;

/** Huỷ lịch xem còn mở (giữ nguyên lịch đã COMPLETED/CANCELLED). */
const cancelAppointmentsStatement = `
  UPDATE "appointments" a
     SET "status" = 'CANCELLED'
   WHERE a."status" IN ('PENDING', 'CONFIRMED')
     AND (
       EXISTS (
         SELECT 1 FROM "rooms" r
          WHERE r."id" = a."room_id" AND r."status" = 'RENTED'
       )
       OR EXISTS (
         SELECT 1 FROM "contracts" c
          WHERE c."status" = 'ACTIVE'
            AND (
              c."room_id" = a."room_id"
              OR c."room_id" = (SELECT p."room_id" FROM "posts" p WHERE p."id" = a."post_id")
            )
       )
     );`;

const main = async () => {
  requireEnv(['DB_URL']);
  const confirm = process.argv.includes('--confirm');
  const target = assertDeploymentTarget(process.env.DB_URL);

  console.log(`🎯 Target (DEV): db=${target.database} host=${target.host}`);
  console.log('📋 Reconcile: phòng đã thuê ⇒ đồng bộ rooms.status + huỷ nhu cầu còn mở.');

  const [driftRooms, openRequests, openAppointments] = await Promise.all([
    prisma.$queryRawUnsafe(driftRoomsQuery),
    prisma.$queryRawUnsafe(openRequestsQuery),
    prisma.$queryRawUnsafe(openAppointmentsQuery),
  ]);

  if (!driftRooms.length && !openRequests.length && !openAppointments.length) {
    console.log('\n✅ Không có gì lệch — mọi phòng đã thuê đều RENTED và không còn nhu cầu mở.');
    return 0;
  }

  if (driftRooms.length) {
    console.log(`\n📌 ${driftRooms.length} phòng có hợp đồng ACTIVE nhưng chưa RENTED:`);
    for (const room of driftRooms) {
      console.log(`   - ${room.property_name} / ${room.room_number} (room=${room.id})`);
    }
  }
  if (openRequests.length) {
    console.log(`\n📌 ${openRequests.length} yêu cầu thuê còn mở trên phòng đã thuê:`);
    for (const request of openRequests) {
      console.log(`   - request=${request.id} room=${request.room_number} status=${request.status}`);
    }
  }
  if (openAppointments.length) {
    console.log(`\n📌 ${openAppointments.length} lịch xem còn mở trên phòng đã thuê:`);
    for (const appointment of openAppointments) {
      console.log(
        `   - appointment=${appointment.id} room=${appointment.room_number ?? '—'} ` +
          `status=${appointment.status} at=${new Date(appointment.appointment_time).toISOString()}`,
      );
    }
  }

  if (!confirm) {
    console.log('\n⚠️  CHƯA GHI (thiếu --confirm). Đây là bản xem trước.');
    return 0;
  }

  const [roomsUpdated, requestsCancelled, appointmentsCancelled] = await prisma.$transaction([
    prisma.$executeRawUnsafe(markRoomsRentedStatement),
    prisma.$executeRawUnsafe(cancelRequestsStatement),
    prisma.$executeRawUnsafe(cancelAppointmentsStatement),
  ]);

  console.log('\n✅ Đã áp dụng:');
  console.log(`   - rooms → RENTED: ${roomsUpdated}`);
  console.log(`   - rental_requests → CANCELLED: ${requestsCancelled}`);
  console.log(`   - appointments → CANCELLED: ${appointmentsCancelled}`);

  const remainingDrift = await prisma.$queryRawUnsafe(driftRoomsQuery);
  const remainingRequests = await prisma.$queryRawUnsafe(openRequestsQuery);
  const remainingAppointments = await prisma.$queryRawUnsafe(openAppointmentsQuery);
  console.log('\n🔎 Còn lại sau khi chạy:');
  console.log(`   - phòng lệch trạng thái: ${remainingDrift.length}`);
  console.log(`   - yêu cầu thuê còn mở: ${remainingRequests.length}`);
  console.log(`   - lịch xem còn mở: ${remainingAppointments.length}`);
  console.log('\n✅ Hoàn tất reconcile DEV. Không xoá bản ghi nào.');
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
  driftRoomsQuery,
  openRequestsQuery,
  openAppointmentsQuery,
  markRoomsRentedStatement,
  cancelRequestsStatement,
  cancelAppointmentsStatement,
};

