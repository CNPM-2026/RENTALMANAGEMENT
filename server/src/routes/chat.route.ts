import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/conversations', chatController.createConversation);
router.get('/conversations', chatController.getMyConversations);
router.get('/conversations/:id/messages', chatController.getMessages);

export default router;