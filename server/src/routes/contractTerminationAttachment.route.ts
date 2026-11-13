import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { contractTerminationAttachmentController } from '../controllers/contractTerminationAttachment.controller';

/**
 * `/api/v1/contract-termination-attachments/:id?token=...`
 *
 * `<img>`/link của trình duyệt không gửi được header Authorization, nên danh
 * tính đi qua token HMAC ngắn hạn. Server luôn đọc lại quan hệ hợp đồng trước
 * khi trả bytes. Route được gắn trước `apiLimiter` và bị loại khỏi access log
 * để token không bị ghi lại.
 */
const router = Router();

const attachmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:id', attachmentLimiter, contractTerminationAttachmentController.get);

export default router;
