import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { EvidenceKind, loadAuthorizedEvidence } from '../services/maintenanceEvidence.service';

/**
 * 🆕 Batch 2.1 (M2) — `GET /api/v1/maintenance-images/:kind/:id?token=...`
 *
 * Route KHÔNG dùng `authenticate`: thẻ `<img>` của trình duyệt không gửi được
 * header `Authorization`. Danh tính người xem nằm trong token HMAC ngắn hạn do
 * server cấp (`mintEvidenceUrl`), và server ĐỌC LẠI quan hệ nghiệp vụ trước khi
 * trả bytes — token không phải là quyền truy cập.
 *
 * Header trả về:
 * - `Cache-Control: private, max-age=<token TTL>` — chỉ cache trong trình duyệt
 *   của chính người xem, ngắn hạn, không cache ở proxy dùng chung.
 * - `Cross-Origin-Resource-Policy: cross-origin` để client Next.js (khác origin
 *   khi dev) vẫn render được ảnh, trong khi `helmet()` mặc định là `same-origin`.
 * - `Referrer-Policy: no-referrer` — không làm rò token sang origin khác.
 */
const parseKind = (value: unknown): EvidenceKind => {
  if (value === 'issue' || value === 'task') return value;
  throw new AppError('Loại ảnh không hợp lệ', 404, 'EVIDENCE_NOT_FOUND');
};

export const maintenanceImageController = {
  get: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const kind = parseKind(req.params.kind);
      const { buffer, contentType } = await loadAuthorizedEvidence(
        kind,
        String(req.params.id),
        typeof req.query.token === 'string' ? req.query.token : undefined,
      );

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buffer.byteLength));
      // KHÔNG log URL/token ở bất kỳ đâu: xem `app.ts` (morgan skip).
      res.setHeader('Cache-Control', 'private, max-age=600, no-transform');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(200).send(buffer);
    } catch (error) {
      return next(error);
    }
  },
};
