import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize, authorizeStaff, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { upload, validateUploadedImages } from '../config/multer';
import { maintenanceController } from '../controllers/maintenance.controller';
import {
  maintenanceCreateSchema,
  maintenanceStatusSchema,
  maintenanceTriageSchema,
} from '../validations/resource.validation';
import { maintenanceTaskFromIssueSchema } from '../validations/maintenanceTask.validation';

/**
 * PHIẾU SỰ CỐ KHÁCH THUÊ BÁO CÁO — `/api/v1/maintenance`.
 *
 * 🆕 Batch 2 (điều chỉnh luồng): đây là ĐIỂM BẮT ĐẦU của quy trình marketplace.
 * Khách thuê báo sự cố (kèm ảnh) → chủ trọ tiếp nhận (`/triage`) → chủ trọ tạo
 * công việc cần thợ (`POST /:id/tasks`) → thợ ứng tuyển ở `/api/v1/maintenance-tasks`.
 *
 * KHÔNG nhầm với `/api/v1/maintenance-tasks` (marketplace do chủ trọ đăng).
 * Khách thuê KHÔNG có đường nào tự đăng việc cho thợ: `POST /:id/tasks` chỉ dành
 * cho LANDLORD và nơi làm việc được suy ra từ chính sự cố.
 *
 * Thứ tự khai báo quan trọng: route tĩnh `/my` phải đứng trước `/:id`.
 */
const router = Router();
const maintenanceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});

router.use(maintenanceRateLimiter);
router.use(authenticate);

// --- Khách thuê: báo sự cố (multipart vì có ảnh hiện trạng, ảnh là tuỳ chọn) ---
router.post(
  '/',
  authorize('TENANT'),
  upload.array('images', 5),
  validateUploadedImages,
  validate(maintenanceCreateSchema),
  maintenanceController.create,
);

// --- Dùng chung: danh sách sự cố trong phạm vi của mình ---
router.get('/my', authorizeStaffOr('MAINTENANCE', 'TENANT', 'LANDLORD'), maintenanceController.getMine);

// --- Chủ trọ: tiếp nhận sự cố & chuyển thành công việc cần thợ ---
router.patch(
  '/:id/triage',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  validate(maintenanceTriageSchema),
  maintenanceController.triage,
);
router.post(
  '/:id/tasks',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  upload.array('images', 5),
  validateUploadedImages,
  validate(maintenanceTaskFromIssueSchema),
  maintenanceController.createTaskFromIssue,
);

// --- Vòng đời xử lý (giữ nguyên hành vi cũ) ---
router.patch(
  '/:id/status',
  authorizeStaff('MAINTENANCE'),
  validate(maintenanceStatusSchema),
  maintenanceController.update,
);

// --- Chi tiết: đặt CUỐI để không nuốt route tĩnh `/my` ---
router.get('/:id', authorizeStaffOr('MAINTENANCE', 'TENANT', 'LANDLORD'), maintenanceController.getById);

export default router;
