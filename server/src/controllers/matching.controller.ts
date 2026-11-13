import { NextFunction, Response } from 'express';
import { matchingService } from '../services/matching.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export const matchingController = {
  getQuestions: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getQuestions();
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getMyAnswers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getMyAnswers(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * GET chỉ dành cho filter KHÔNG nhạy cảm.
   *
   * Không đọc `gender` từ `req.query`: giới tính trong URL có thể bị ghi vào
   * access log, browser history hoặc referer. Lọc theo giới tính dùng
   * `browseRoommatePosts` (POST).
   */
  getRoommatePosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query as RoommatePostSource;
      const result = await matchingService.getRoommatePosts(
        baseRoommatePostInput(query),
        req.user?.id,
      );
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng tìm bạn ở ghép thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST body cho filter có dữ liệu nhạy cảm (giới tính).
   *
   * Controller CHỈ đọc `req.body`; không fallback về `req.query` cho `gender`
   * vì fallback sẽ tái tạo đúng luồng dữ liệu mà CodeQL cảnh báo.
   */
  browseRoommatePosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as RoommatePostSource;
      const result = await matchingService.getRoommatePosts(
        roommatePostInputWithGender(body),
        req.user?.id,
      );
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng tìm bạn ở ghép thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getRoommateProfile: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const [result] = await matchingService.getRoommatePosts(
        { authorId: String(req.params.userId), limit: 1 },
        req.user?.id,
      );
      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy hồ sơ tìm bạn ở ghép đang hiển thị',
        });
      }
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  submitAnswers: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.submitAnswers(req.user!.id, req.body.answers);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) {
      return next(error);
    }
  },

  updatePreferences: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.updatePreferences(req.user!.id, req.body);
      return res.status(200).json({ success: true, message: 'Cập nhật tiêu chí thành công', data: result });
    } catch (error) {
      return next(error);
    }
  },

  getPreferences: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getPreferences(req.user!.id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  getSuggestedRoommates: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await matchingService.getSuggestedRoommates(req.user!.id);
      return res.status(200).json({ 
        success: true, 
        message: 'Lấy danh sách người ở ghép tương thích thành công', 
        data: result 
      });
    } catch (error) {
      return next(error);
    }
  },
};

/**
 * Nguồn filter đã được middleware Zod parse (GET query hoặc POST body).
 * Query string có thể còn là chuỗi nên các helper bên dưới chuẩn hoá lại.
 */
type RoommatePostSource = {
  keyword?: string;
  province?: string;
  district?: string;
  ward?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  hasRoom?: boolean | string;
  sleepSchedule?: string;
  smokingAllowed?: boolean | string;
  petAllowed?: boolean | string;
  minCleanliness?: string | number;
  sortBy?: 'best_match' | 'newest' | 'price_asc' | 'price_desc';
  limit?: string | number;
};

/** Filter thường — an toàn cho GET query; tuyệt đối không chứa `gender`. */
function baseRoommatePostInput(source: RoommatePostSource) {
  return {
    keyword: source.keyword,
    province: source.province,
    district: source.district,
    ward: source.ward,
    minPrice: toOptionalNumber(source.minPrice),
    maxPrice: toOptionalNumber(source.maxPrice),
    hasRoom: toOptionalBoolean(source.hasRoom),
    sleepSchedule: source.sleepSchedule,
    smokingAllowed: toOptionalBoolean(source.smokingAllowed),
    petAllowed: toOptionalBoolean(source.petAllowed),
    minCleanliness: toOptionalNumber(source.minCleanliness),
    sortBy: source.sortBy,
    limit: toPositiveInt(source.limit, 60),
  };
}

/** Filter có giới tính — CHỈ gọi với `req.body` từ route POST. */
function roommatePostInputWithGender(source: RoommatePostSource) {
  return {
    ...baseRoommatePostInput(source),
    gender: source.gender,
  };
}

/** Query string luôn là chuỗi: `''`/không phải số -> `undefined` (không thành 0). */
function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Chỉ nhận true/false thật hoặc chuỗi 'true'/'false'; còn lại -> `undefined`. */
function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Số nguyên dương, nếu không hợp lệ thì dùng mặc định (không bao giờ thành 0). */
function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
