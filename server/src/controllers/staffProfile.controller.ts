import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { staffProfileService } from '../services/staffProfile.service';

export const staffProfileController = {
  getMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await staffProfileService.getMine(req.user!.id) });
    } catch (error) {
      return next(error);
    }
  },

  upsertMine: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await staffProfileService.upsertMine(req.user!.id, req.body) });
    } catch (error) {
      return next(error);
    }
  },

  updateAvailability: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await staffProfileService.updateAvailability(req.user!.id, req.body.isAvailable),
      });
    } catch (error) {
      return next(error);
    }
  },

  getPublicProfile: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({ success: true, data: await staffProfileService.getPublicProfile(String(req.params.userId)) });
    } catch (error) {
      return next(error);
    }
  },

  browse: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // `validate(..., 'query')` đã kiểm tra/ép kiểu, nhưng controller vẫn đọc
      // lại bằng hàm thuần để không phụ thuộc việc middleware có mutate
      // `req.query` hay không, và để không bao giờ gửi NaN/0 xuống Prisma.
      const query = req.query as {
        category?: string;
        isAvailable?: boolean;
        search?: string;
        page?: string | number;
        limit?: string | number;
      };
      const result = await staffProfileService.browse({
        category: query.category,
        isAvailable: typeof query.isAvailable === 'boolean' ? query.isAvailable : undefined,
        search: query.search,
        page: toPositiveInt(query.page, 1),
        limit: toPositiveInt(query.limit, 20),
      });
      return res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      return next(error);
    }
  },
};

/** Số nguyên dương, nếu không hợp lệ thì dùng mặc định (không bao giờ thành 0). */
function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
