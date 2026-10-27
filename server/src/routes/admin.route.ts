import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Chỉ ADMIN mới được vào
router.use(authenticate, authorize('ADMIN'));

router.get('/posts/pending', adminController.getPendingPosts);
router.patch('/posts/:id/status', adminController.updatePostStatus);

export default router;