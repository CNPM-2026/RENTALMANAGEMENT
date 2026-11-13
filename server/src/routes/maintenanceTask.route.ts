import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { upload, validateUploadedImages } from '../config/multer';
import { maintenanceTaskController } from '../controllers/maintenanceTask.controller';
import {
  maintenanceApplicationCreateSchema,
  maintenanceCompletionConfirmSchema,
  maintenanceCompletionRejectSchema,
  maintenanceTaskAssignedQuerySchema,
  maintenanceTaskBrowseBodySchema,
  maintenanceTaskCompletionSchema,
  maintenanceTaskGetQuerySchema,
  maintenanceTaskListQuerySchema,
  maintenanceTaskUpdateSchema,
} from '../validations/maintenanceTask.validation';
import {
  maintenanceOfferDecisionSchema,
  maintenanceOfferProposeSchema,
} from '../validations/maintenanceOffer.validation';

/**
 * MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2) — `/api/v1/maintenance-tasks`.
 *
 * KHÔNG nhầm với `/api/v1/maintenance` (phiếu sự cố do khách thuê gửi) và không
 * nhầm với `/api/v1/staff` (`StaffMembership` — nhân viên chủ trọ cấp quyền).
 *
 * 🆕 Variant B: KHÔNG có `POST /` — công việc chỉ được tạo từ một báo cáo sự cố
 * qua `POST /api/v1/maintenance/:id/tasks`, nên mọi công việc đều có
 * `sourceIssueId` và nơi làm việc suy ra từ chính sự cố.
 *
 * Thứ tự khai báo quan trọng: các route tĩnh (`/mine`, `/applications/mine`) phải
 * đứng trước `/:id`, nếu không Express sẽ hiểu `mine` là một id.
 */
const router = Router();

/** Ghi công việc/đơn ứng tuyển: giới hạn như route bài đăng để chống spam. */
const taskWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

// --- Thợ: công việc đang mở + đơn của chính mình ---
// GET chỉ nhận filter thường (category/skill/search...). Toạ độ/bán kính là dữ
// liệu nhạy cảm nên đi qua POST body, tránh lộ trong URL/access log/referer.
router.post(
  '/browse',
  authorize('STAFF'),
  validate(maintenanceTaskBrowseBodySchema),
  maintenanceTaskController.browseOpenByLocation,
);
router.get(
  '/',
  authorize('STAFF'),
  validate(maintenanceTaskGetQuerySchema, 'query'),
  maintenanceTaskController.browseOpen,
);
router.get('/applications/mine', authorize('STAFF'), maintenanceTaskController.listMyApplications);

// --- 🆕 Batch 3: THỢ thực thi công việc đã được giao -------------------------
// `/assigned` là route TĨNH nên phải đứng trước `/:id` (nếu không Express sẽ
// hiểu "assigned" là một id công việc).
router.get(
  '/assigned',
  authorize('STAFF'),
  validate(maintenanceTaskAssignedQuerySchema, 'query'),
  maintenanceTaskController.listAssigned,
);
router.post('/:id/start', authorize('STAFF'), taskWriteLimiter, maintenanceTaskController.startWork);
router.post(
  '/:id/completion',
  authorize('STAFF'),
  taskWriteLimiter,
  // Ảnh nghiệm thu đi qua CÙNG pipeline upload riêng tư + kiểm tra chữ ký tệp
  // như ảnh hiện trạng; URL do client gửi không bao giờ được lưu.
  upload.array('images', 5),
  validateUploadedImages,
  validate(maintenanceTaskCompletionSchema),
  maintenanceTaskController.submitCompletion,
);

// --- 🆕 Batch 3: CHỦ TRỌ duyệt nghiệm thu ------------------------------------
router.post(
  '/:id/completion/confirm',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  taskWriteLimiter,
  validate(maintenanceCompletionConfirmSchema),
  maintenanceTaskController.confirmCompletion,
);
router.post(
  '/:id/completion/reject',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  taskWriteLimiter,
  validate(maintenanceCompletionRejectSchema),
  maintenanceTaskController.rejectCompletion,
);

// --- 🆕 Batch 3: nộp nghiệm thu / duyệt (xem ở trên) ------------------------

// --- 🆕 Batch 3: THƯƠNG LƯỢNG GIÁ ------------------------------------------
// Cả hai role đều gọi được; service xác định vai trò thật từ quan hệ công việc
// (chủ sở hữu hay thợ được giao) nên không thể tự nhận vai trò qua token/body.
router.get('/:id/offers', authorize('LANDLORD', 'STAFF'), maintenanceTaskController.getOffers);
router.post(
  '/:id/offers',
  authorize('LANDLORD', 'STAFF'),
  taskWriteLimiter,
  validate(maintenanceOfferProposeSchema),
  maintenanceTaskController.proposeOffer,
);
router.post(
  '/:id/offers/:offerId/accept',
  authorize('LANDLORD', 'STAFF'),
  taskWriteLimiter,
  validate(maintenanceOfferDecisionSchema),
  maintenanceTaskController.acceptOffer,
);
router.post(
  '/:id/offers/:offerId/reject',
  authorize('LANDLORD', 'STAFF'),
  taskWriteLimiter,
  validate(maintenanceOfferDecisionSchema),
  maintenanceTaskController.rejectOffer,
);
router.delete(
  '/:id/offers/:offerId',
  authorize('LANDLORD', 'STAFF'),
  taskWriteLimiter,
  maintenanceTaskController.withdrawOffer,
);

// --- Chủ trọ: quản lý công việc của mình ---
router.get(
  '/mine',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  validate(maintenanceTaskListQuerySchema, 'query'),
  maintenanceTaskController.getMine,
);
router.patch(
  '/:id',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  taskWriteLimiter,
  upload.array('images', 5),
  validateUploadedImages,
  validate(maintenanceTaskUpdateSchema),
  maintenanceTaskController.update,
);
router.post('/:id/cancel', authorizeStaffOr('MAINTENANCE', 'LANDLORD'), taskWriteLimiter, maintenanceTaskController.cancel);

// --- Chủ trọ: đơn ứng tuyển & giao việc ---
router.get('/:id/applications', authorizeStaffOr('MAINTENANCE', 'LANDLORD'), maintenanceTaskController.listApplications);
router.post(
  '/:id/applications/:applicationId/accept',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  taskWriteLimiter,
  maintenanceTaskController.acceptApplication,
);
router.post(
  '/:id/applications/:applicationId/reject',
  authorizeStaffOr('MAINTENANCE', 'LANDLORD'),
  taskWriteLimiter,
  maintenanceTaskController.rejectApplication,
);

// --- Thợ: ứng tuyển / rút đơn ---
router.delete('/:id/applications/me', authorize('STAFF'), taskWriteLimiter, maintenanceTaskController.withdraw);
router.post(
  '/:id/applications',
  authorize('STAFF'),
  taskWriteLimiter,
  validate(maintenanceApplicationCreateSchema),
  maintenanceTaskController.apply,
);

// --- Chi tiết: đặt CUỐI để không nuốt các route tĩnh phía trên ---
router.get('/:id', maintenanceTaskController.getById);

export default router;
