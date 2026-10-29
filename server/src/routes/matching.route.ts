import { Router } from 'express';
import { matchingController } from '../controllers/matching.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Ai cũng xem được câu hỏi (Public)
router.get('/questions', matchingController.getQuestions);

// Các API dưới đây phải đăng nhập
router.use(authenticate);

router.post('/answers', matchingController.submitAnswers);
router.put('/preferences', matchingController.updatePreferences);
router.get('/suggestions', matchingController.getSuggestedRoommates);

export default router;