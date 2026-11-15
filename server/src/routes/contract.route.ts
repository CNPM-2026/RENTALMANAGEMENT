import { Router } from 'express';
import { contractController } from '../controllers/contract.controller';
import { authenticate, authorize, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { upload, validateUploadedImages } from '../config/multer';
import {
  contractRenewalQuerySchema,
  contractRenewalRespondSchema,
  contractRenewalSchema,
  contractSchema,
  contractStatusSchema,
  contractTerminationQuerySchema,
  contractTerminationReviewSchema,
  contractTerminationSchema,
} from '../validations/resource.validation';

const router = Router();

router.use(authenticate); // Tất cả đều phải đăng nhập

// Chủ trọ, hoặc nhân viên được cấp quyền APPOINTMENTS, được tạo hợp đồng.
router.post('/', authorizeStaffOr('APPOINTMENTS', 'LANDLORD'), validate(contractSchema), contractController.create);

// Admin xem toàn bộ; các role còn lại chỉ xem hợp đồng thuộc phạm vi của mình.
// STAFF có membership được scope theo chủ trọ (quyền APPOINTMENTS); STAFF không
// có membership mở được trang nhưng danh sách rỗng.
router.get(
  '/my',
  authorizeStaffOr('APPOINTMENTS', 'ADMIN', 'LANDLORD', 'TENANT', 'STAFF'),
  contractController.getMyContracts,
);

// --- Chấm dứt hợp đồng: gửi yêu cầu (kèm ảnh) → Admin duyệt → theo dõi hoàn cọc ---
router.get(
  '/termination-requests',
  authorizeStaffOr('APPOINTMENTS', 'ADMIN', 'LANDLORD', 'TENANT', 'STAFF'),
  validate(contractTerminationQuerySchema, 'query'),
  contractController.getTerminationRequests,
);
router.post(
  '/:id/termination-requests',
  authorize('LANDLORD', 'TENANT'),
  upload.array('images', 5),
  validateUploadedImages,
  validate(contractTerminationSchema),
  contractController.createTerminationRequest,
);
router.patch(
  '/termination-requests/:requestId/review',
  authorize('ADMIN'),
  validate(contractTerminationReviewSchema),
  contractController.reviewTerminationRequest,
);
router.patch(
  '/termination-requests/:requestId/refund-paid',
  authorize('LANDLORD'),
  contractController.confirmDepositRefund,
);

// --- Ký tiếp / gia hạn: một bên đề xuất, bên còn lại phản hồi ---
router.get(
  '/renewal-requests',
  authorizeStaffOr('APPOINTMENTS', 'ADMIN', 'LANDLORD', 'TENANT', 'STAFF'),
  validate(contractRenewalQuerySchema, 'query'),
  contractController.getRenewalRequests,
);
router.post(
  '/:id/renewal-requests',
  authorize('LANDLORD', 'TENANT'),
  validate(contractRenewalSchema),
  contractController.createRenewalRequest,
);
router.patch(
  '/renewal-requests/:requestId/respond',
  authorize('LANDLORD', 'TENANT'),
  validate(contractRenewalRespondSchema),
  contractController.respondRenewalRequest,
);

// Chủ trọ (hoặc nhân viên có quyền APPOINTMENTS) cập nhật trạng thái hợp đồng.
router.patch('/:id/status', authorizeStaffOr('APPOINTMENTS', 'LANDLORD'), validate(contractStatusSchema), contractController.updateStatus);

export default router;