import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { maintenanceImageController } from '../controllers/maintenanceImage.controller';

/**
 * 🆕 Batch 2.1 (M2) — `/api/v1/maintenance-images`.
 *
 * Tách khỏi `/api/v1/maintenance` và `/api/v1/maintenance-tasks` vì:
 * - trình duyệt tải ảnh bằng `<img>` (không có header `Authorization`) nên danh
 *   tính đi qua token HMAC ngắn hạn trong query string;
 * - có hạn mức riêng: một trang chi tiết có thể tải 5 ảnh, không thể tiêu hết
 *   hạn mức API chung (`apiLimiter`) của người dùng.
 *
 * Token KHÔNG được log: `app.ts` cấu hình morgan bỏ qua tiền tố này.
 */
const router = Router();

const imageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:kind/:id', imageLimiter, maintenanceImageController.get);

export default router;
