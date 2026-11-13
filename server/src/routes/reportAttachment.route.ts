import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { reportAttachmentController } from '../controllers/reportAttachment.controller';

/**
 * 🆕 Batch 4 — `/api/v1/report-attachments/:id?token=...`.
 *
 * Tách khỏi `/api/v1/reports` vì `<img>` của trình duyệt không gửi được header
 * `Authorization`: danh tính đi qua token HMAC ngắn hạn, và server đọc lại quyền
 * (người báo cáo hoặc admin) trước khi trả bytes. Rate limit riêng để một trang
 * tranh chấp nhiều ảnh không tiêu hạn mức API chung. `app.ts` loại route này khỏi
 * access log để token không bị ghi lại.
 */
const router = Router();

const attachmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:id', attachmentLimiter, reportAttachmentController.get);

export default router;
