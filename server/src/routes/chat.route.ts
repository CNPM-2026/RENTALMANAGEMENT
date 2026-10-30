import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { conversationSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

router.post('/conversations', validate(conversationSchema), chatController.createConversation);
router.get('/conversations', chatController.getMyConversations);
router.get('/conversations/:id/messages', chatController.getMessages);

export default router;