import { Router } from 'express';
import { occupancyController } from '../controllers/occupancy.controller';
import { authenticate, authorize, authorizeStaffOr } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { occupancyDeclarationSchema, occupancyRejectionSchema } from '../validations/occupancy.validation';

const router = Router();
router.use(authenticate);

/**
 * Tenant: khai báo / xem lịch sử của chính mình.
 * LANDLORD không được khai thay (server còn kiểm tra hợp đồng ACTIVE).
 *
 * `GET /my` chỉ đọc dữ liệu của chính người gọi, nên mọi role đều mở được
 * trang `/tenant/occupancy` (ADMIN/STAFF sẽ thấy danh sách rỗng). Quyền GHI
 * vẫn chỉ dành cho TENANT.
 */
router.post('/', authorize('TENANT'), validate(occupancyDeclarationSchema), occupancyController.declare);
router.get(
  '/my',
  authorize('TENANT', 'LANDLORD', 'STAFF', 'ADMIN'),
  occupancyController.listMine,
);

/**
 * Lịch sử + trạng thái hiện tại của một phòng: chủ trọ sở hữu, HOẶC tenant có
 * hợp đồng ACTIVE. Service kiểm tra chính xác — route chỉ chặn role lạ.
 */
router.get('/room/:roomId', authorizeStaffOr('PROPERTIES_ROOMS', 'TENANT', 'LANDLORD'), occupancyController.getRoomOccupancy);

/**
 * Chủ trọ (hoặc nhân viên được cấp quyền PROPERTIES_ROOMS) xác minh/từ chối.
 * Service kiểm tra tiếp quyền sở hữu phòng nên không thể xác minh phòng người khác.
 */
router.get('/pending', authorizeStaffOr('PROPERTIES_ROOMS', 'LANDLORD'), occupancyController.listPending);
router.patch('/:id/verify', authorizeStaffOr('PROPERTIES_ROOMS', 'LANDLORD'), occupancyController.verify);
router.patch(
  '/:id/reject',
  authorizeStaffOr('PROPERTIES_ROOMS', 'LANDLORD'),
  validate(occupancyRejectionSchema),
  occupancyController.reject,
);

export default router;
