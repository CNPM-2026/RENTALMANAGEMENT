import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { chatMessageSchema, conversationSchema } from '../validations/resource.validation';

const router = Router();
router.use(authenticate);

router.post('/conversations', validate(conversationSchema), chatController.createConversation);
router.get('/conversations', chatController.getMyConversations);
router.get('/conversations/:id/messages', chatController.getMessages);
// Chat chỉ gửi VĂN BẢN. Tính năng gửi ảnh đã được gỡ khỏi API: không còn
// middleware upload nào ở route này, nên client không thể đính kèm tệp.
router.post(
  '/conversations/:id/messages',
  validate(chatMessageSchema),
  chatController.sendMessage,
);
router.patch('/conversations/:id/read', chatController.markAsRead);

export default router;
