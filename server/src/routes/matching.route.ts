import { Router } from 'express';
import { matchingController } from '../controllers/matching.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { matchingAnswersSchema, matchingPreferencesSchema } from '../validations/matching.validation';

const router = Router();

// Ai cũng xem được câu hỏi (Public)
router.get('/questions', matchingController.getQuestions);

// Các API dưới đây phải đăng nhập
router.use(authenticate);

router.post('/answers', validate(matchingAnswersSchema), matchingController.submitAnswers);
router.put('/preferences', validate(matchingPreferencesSchema), matchingController.updatePreferences);
router.get('/suggestions', matchingController.getSuggestedRoommates);

export default router;