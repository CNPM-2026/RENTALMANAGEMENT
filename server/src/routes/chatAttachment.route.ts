import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chatAttachmentController } from '../controllers/chatAttachment.controller';

/**
 * 🆕 Batch 5 — `/api/v1/chat-attachments/:id?token=...`.
 * `<img>` không gửi được `Authorization`, nên danh tính đi qua token HMAC ngắn
 * hạn; server đọc lại tư cách thành viên hội thoại trước khi trả bytes. Route
 * được `app.ts` loại khỏi access log để token không bị ghi lại.
 */
const router = Router();

const attachmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:id', attachmentLimiter, chatAttachmentController.get);

export default router;
