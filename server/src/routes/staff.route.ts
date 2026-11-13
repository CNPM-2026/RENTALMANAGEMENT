import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { staffController } from '../controllers/staff.controller';
import { staffInviteSchema, staffUpdateSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

// Quyền của CHÍNH mình: mọi tài khoản đã đăng nhập đều đọc được (chỉ dữ liệu
// của bản thân). Phải đứng trước nhóm route chỉ dành cho chủ trọ.
router.get('/membership/me', staffController.getMyMembership);

// Quản lý nhân viên & cấp quyền: CHỈ chủ trọ sở hữu tài khoản được thao tác.
// Nhân viên được cấp quyền không thể tự nâng quyền cho người khác.
router.use(authorize('LANDLORD'));
router.get('/', staffController.list);
router.post('/', validate(staffInviteSchema), staffController.invite);
router.patch('/:id', validate(staffUpdateSchema), staffController.update);
router.delete('/:id', staffController.remove);
export default router;
