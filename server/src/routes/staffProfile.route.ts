import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { staffProfileController } from '../controllers/staffProfile.controller';
import {
  staffAvailabilitySchema,
  staffBrowseBodySchema,
  staffBrowseGetQuerySchema,
  staffProfileUpsertSchema,
} from '../validations/staffProfile.validation';

/**
 * STAFF MARKETPLACE — hồ sơ thợ độc lập (role = STAFF).
 *
 * KHÔNG nhầm với `/api/v1/staff` (staff.route.ts): route đó quản lý
 * `StaffMembership` — nhân viên được chủ trọ cấp quyền quản lý tài sản. Thợ
 * marketplace là tài khoản độc lập, tự đăng ký và làm việc với nhiều chủ trọ,
 * nên phải ở namespace riêng với luật truy cập riêng.
 */
const router = Router();

router.use(authenticate);

// --- Hồ sơ của chính thợ ---
router.get('/me', authorize('STAFF'), staffProfileController.getMine);
router.put('/me', authorize('STAFF'), validate(staffProfileUpsertSchema), staffProfileController.upsertMine);
router.patch(
  '/me/availability',
  authorize('STAFF'),
  validate(staffAvailabilitySchema),
  staffProfileController.updateAvailability,
);

// --- Chủ trọ khám phá thợ ---
// GET chỉ nhận filter thường. Toạ độ/bán kính là dữ liệu nhạy cảm nên đi qua
// POST body để không bị lộ trong URL (access log, browser history, referer).
router.post(
  '/browse',
  authorize('LANDLORD', 'ADMIN'),
  validate(staffBrowseBodySchema),
  staffProfileController.browseByLocation,
);
router.get('/', authorize('LANDLORD', 'ADMIN'), validate(staffBrowseGetQuerySchema, 'query'), staffProfileController.browse);

// --- Hồ sơ công khai (mọi user đã đăng nhập) ---
// Đặt SAU các route tĩnh để `/me` không bị hiểu thành `:userId`.
router.get('/:userId', staffProfileController.getPublicProfile);

export default router;
