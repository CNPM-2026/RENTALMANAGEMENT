#!/usr/bin/env node
'use strict';

/**
 * PURGE ẢNH KYC ĐÃ DUYỆT
 *
 * Chính sách: ảnh CCCD chỉ được giữ trong lúc admin đối soát. Khi hồ sơ đã
 * APPROVED, asset phải bị xoá khỏi Cloudinary và hai cột `front_id_url` /
 * `back_id_url` phải NULL. Luồng duyệt mới giữ ref cho tới khi Cloudinary xoá
 * thành công; script này dọn hồ sơ APPROVED cũ và retry các lần xoá bị lỗi.
 *
 * An toàn:
 *  - Mặc định CHỈ ĐỌC; chỉ xoá khi có `--confirm`.
 *  - Chỉ đụng `status = APPROVED`; không xoá ảnh của hồ sơ đang chờ/ bị từ chối.
 *  - Chỉ đặt cột về NULL sau khi Cloudinary xác nhận xoá thành công. Nếu lỗi,
 *    ref được giữ lại để lần chạy sau thử lại (không tạo orphan âm thầm).
 *
 * Cách dùng:
 *   node scripts/purge-approved-kyc-images.js            (preflight)
 *   node scripts/purge-approved-kyc-images.js --confirm  (áp dụng)
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const { v2: cloudinary } = require('cloudinary');

const confirm = process.argv.includes('--confirm');
const cloudinaryEnabled = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME
  && process.env.CLOUDINARY_API_KEY
  && process.env.CLOUDINARY_API_SECRET,
);

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const IMAGE_FIELDS = ['frontIdUrl', 'backIdUrl'];

(async () => {
  const prisma = new PrismaClient();
  try {
    const approved = await prisma.kycSubmission.findMany({
      where: { status: 'APPROVED' },
      select: { id: true, frontIdUrl: true, backIdUrl: true },
      orderBy: { reviewedAt: 'asc' },
    });
    const rows = approved.filter((row) => row.frontIdUrl || row.backIdUrl);

    console.log(`[kyc-purge] Hồ sơ APPROVED còn ảnh: ${rows.length}`);
    if (rows.length === 0) return;

    if (!confirm) {
      console.log('[kyc-purge] Preflight only. Thêm --confirm để xoá Cloudinary và NULL hai cột.');
      return;
    }
    if (!cloudinaryEnabled) {
      throw new Error('Thiếu CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET — không thể xoá ảnh.');
    }

    let failures = 0;
    for (const row of rows) {
      const data = {};
      for (const field of IMAGE_FIELDS) {
        const publicId = row[field];
        if (!publicId) continue;
        try {
          const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: 'image',
            type: 'authenticated',
            invalidate: true,
          });
          // Cloudinary trả "not found" khi asset đã bị xoá trước đó — vẫn coi là
          // thành công để có thể dọn ref cũ trong DB.
          if (!['ok', 'not found'].includes(result.result)) {
            throw new Error(`Cloudinary trả kết quả "${result.result}"`);
          }
          data[field] = null;
        } catch (error) {
          failures += 1;
          console.error(`[kyc-purge] ${row.id} ${field}: ${error.message}`);
        }
      }
      if (Object.keys(data).length > 0) {
        await prisma.kycSubmission.update({ where: { id: row.id }, data });
        console.log(`[kyc-purge] ${row.id}: đã xoá ${Object.keys(data).join(', ')}`);
      }
    }

    if (failures > 0) {
      console.error(`[kyc-purge] ${failures} asset chưa xoá được; chạy lại sau khi kiểm tra Cloudinary.`);
      process.exitCode = 1;
    } else {
      console.log('[kyc-purge] Hoàn tất: không còn ảnh KYC của hồ sơ APPROVED.');
    }
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(`[kyc-purge] ${error.message}`);
  process.exitCode = 1;
});
