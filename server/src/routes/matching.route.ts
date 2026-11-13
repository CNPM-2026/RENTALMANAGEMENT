import { Router } from 'express';
import { matchingController } from '../controllers/matching.controller';
import { authenticate, authenticateOptional } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { matchingAnswersSchema, matchingPreferencesSchema, roommatePostSearchSchema } from '../validations/matching.validation';

const router = Router();

// Ai cũng xem được câu hỏi (Public)
router.get('/questions', matchingController.getQuestions);
router.get(
  '/posts',
  authenticateOptional,
  validate(roommatePostSearchSchema, 'query'),
  matchingController.getRoommatePosts,
);
router.get('/posts/:userId', authenticateOptional, matchingController.getRoommateProfile);

// Các API dưới đây phải đăng nhập
router.use(authenticate);

router.get('/answers', matchingController.getMyAnswers);

router.post('/answers', validate(matchingAnswersSchema), matchingController.submitAnswers);
router.put('/preferences', validate(matchingPreferencesSchema), matchingController.updatePreferences);
router.get('/preferences', matchingController.getPreferences);
router.get('/suggestions', matchingController.getSuggestedRoommates);

export default router;