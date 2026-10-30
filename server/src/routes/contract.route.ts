import { Router } from 'express';
import { contractController } from '../controllers/contract.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { contractSchema, contractStatusSchema } from '../validations/resource.validation';

const router = Router();

router.use(authenticate); // Tất cả đều phải đăng nhập

// Chỉ chủ trọ mới được tạo hợp đồng
router.post('/', authorize('LANDLORD'), validate(contractSchema), contractController.create);

// Admin xem toàn bộ; các role còn lại chỉ xem hợp đồng thuộc phạm vi của mình.
router.get('/my', authorize('ADMIN', 'LANDLORD', 'TENANT', 'AGENT'), contractController.getMyContracts);

// Chỉ chủ trọ mới được cập nhật trạng thái (hủy hợp đồng)
router.patch('/:id/status', authorize('LANDLORD'), validate(contractStatusSchema), contractController.updateStatus);

export default router;