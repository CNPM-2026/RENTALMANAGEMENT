import { Router } from 'express';
import { contractController } from '../controllers/contract.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { contractSchema, contractStatusSchema } from '../validations/resource.validation';

const router = Router();

router.use(authenticate); // Tất cả đều phải đăng nhập

// Chỉ chủ trọ mới được tạo hợp đồng
router.post('/', authorize('LANDLORD'), validate(contractSchema), contractController.create);

// Cả chủ trọ và người thuê đều xem được danh sách của mình
router.get('/my', contractController.getMyContracts);

// Chỉ chủ trọ mới được cập nhật trạng thái (hủy hợp đồng)
router.patch('/:id/status', authorize('LANDLORD'), validate(contractStatusSchema), contractController.updateStatus);

export default router;