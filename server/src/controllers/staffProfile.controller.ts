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

  /**
   * GET chỉ dành cho filter KHÔNG nhạy cảm.
   *
   * Không đọc `latitude`/`longitude`/`radiusKm` từ `req.query`: dữ liệu vị trí
   * trong URL có thể bị ghi vào access log, browser history hoặc referer. Muốn
   * lọc/sắp xếp theo khoảng cách, client gọi `browseByLocation` (POST).
   */
  browse: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query as StaffBrowseSource;
      const result = await staffProfileService.browse(baseBrowseInput(query));
      return res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST body cho filter có dữ liệu vị trí nhạy cảm.
   *
   * Controller CHỈ đọc `req.body`; không fallback về `req.query` cho các trường
   * geo vì fallback sẽ tái tạo đúng luồng dữ liệu mà CodeQL cảnh báo.
   */
  browseByLocation: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as StaffBrowseSource;
      const result = await staffProfileService.browse(browseInputWithLocation(body));
      return res.json({ success: true, data: result.items, meta: result.meta });
    } catch (error) {
      return next(error);
    }
  },
};

/**
 * Nguồn filter đã được middleware Zod parse (GET query hoặc POST body).
 * Giá trị số vẫn để dạng `unknown`-ish vì query string có thể là chuỗi.
 */
type StaffBrowseSource = {
  category?: string;
  isAvailable?: boolean;
  search?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  radiusKm?: string | number | null;
  sort?: 'newest' | 'nearest';
  page?: string | number;
  limit?: string | number;
};

/** Filter thường — an toàn cho cả GET query và POST body. */
const baseBrowseInput = (source: StaffBrowseSource) => ({
  category: source.category,
  isAvailable: typeof source.isAvailable === 'boolean' ? source.isAvailable : undefined,
  search: source.search,
  sort: source.sort,
  page: toPositiveInt(source.page, 1),
  limit: toPositiveInt(source.limit, 20),
});

/**
 * Filter có geo — CHỈ được gọi với `req.body` từ route POST.
 * Giữ nguyên `toOptionalNumber` để `''`/dữ liệu lỗi không biến thành 0.
 */
const browseInputWithLocation = (source: StaffBrowseSource) => ({
  ...baseBrowseInput(source),
  latitude: toOptionalNumber(source.latitude),
  longitude: toOptionalNumber(source.longitude),
  radiusKm: toOptionalNumber(source.radiusKm),
});

/** Số nguyên dương, nếu không hợp lệ thì dùng mặc định (không bao giờ thành 0). */
function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Query string rỗng/không phải số -> `undefined` (KHÔNG thành 0). */
function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
