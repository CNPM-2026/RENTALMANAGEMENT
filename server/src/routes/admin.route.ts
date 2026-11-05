import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Chỉ ADMIN mới được vào
router.use(authenticate, authorize('ADMIN'));

router.get('/posts/pending', adminController.getPendingPosts);
router.patch('/posts/:id/status', adminController.updatePostStatus);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.get('/kyc', adminController.getKyc);
router.patch('/kyc/:id/status', adminController.updateKyc);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/content-filter', adminController.getContentFilterKeywords);
router.post('/content-filter', adminController.addContentFilterKeyword);
router.delete('/content-filter/:id', adminController.removeContentFilterKeyword);

export default router;