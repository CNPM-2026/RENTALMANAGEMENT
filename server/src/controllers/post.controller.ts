import { NextFunction, Response } from 'express';
import { postService } from '../services/post.service';
import { AuthRequest, resourceOwnerId } from '../middlewares/auth.middleware';

export const postController = {
  getById: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      return res.json({
        success: true,
        data: await postService.getById(String(req.params.id), req.user),
      });
    } catch (error) {
      return next(error);
    }
  },
  create: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // req.files chứa thông tin các file được upload (từ multer)
      const files = req.files as Express.Multer.File[];
      const result = await postService.createPost(resourceOwnerId(req), req.body, files);
      
      return res.status(201).json({
        success: true,
        message: 'Đăng tin thành công, vui lòng chờ Admin duyệt',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },

  getApprovedPosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.getApprovedPosts(req.query);
      
      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  },
  /**
   * GET chỉ dành cho filter KHÔNG nhạy cảm.
   *
   * Không đọc `lat`/`lng`/`radius` từ `req.query`: toạ độ trong URL có thể bị
   * ghi vào access log, browser history hoặc referer. Tìm theo bản đồ dùng
   * `searchByLocation` (POST).
   */
  search: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const query = req.query as PostSearchSource;
      const result = await postService.searchPosts(basePostSearchInput(query));

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        ...result, // Spread data và meta ra
      });
    } catch (error) {
      return next(error);
    }
  },

  /**
   * POST body cho filter có toạ độ nhạy cảm.
   *
   * Controller CHỈ đọc `req.body`; không fallback về `req.query` cho
   * `lat`/`lng`/`radius` vì fallback sẽ tái tạo đúng luồng dữ liệu mà CodeQL
   * cảnh báo.
   */
  searchByLocation: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const body = req.body as PostSearchSource;
      const result = await postService.searchPosts(postSearchInputWithLocation(body));

      return res.status(200).json({
        success: true,
        message: 'Lấy danh sách bài đăng thành công',
        ...result, // Spread data và meta ra
      });
    } catch (error) {
      return next(error);
    }
  },
  getMyPosts: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await postService.getMyPosts(resourceOwnerId(req));
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  },

  update: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      const result = await postService.updatePost(resourceOwnerId(req), String(req.params.id), req.body, files);
      return res.status(200).json({ 
        success: true, 
        message: 'Cập nhật bài đăng thành công (Đang chờ duyệt lại)', 
        data: result 
      });
    } catch (error) {
      return next(error);
    }
  },

  delete: async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await postService.deletePost(resourceOwnerId(req), req.user!.landlordId ? 'LANDLORD' : req.user!.role, String(req.params.id));
      return res.status(200).json({ success: true, message: 'Xóa bài đăng thành công' });
    } catch (error) {
      return next(error);
    }
  },
};

/**
 * Nguồn filter đã được middleware Zod parse (GET query hoặc POST body).
 * Query string có thể còn là chuỗi nên các helper bên dưới chuẩn hoá lại.
 */
type PostSearchSource = {
  keyword?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  minArea?: string | number;
  maxArea?: string | number;
  province?: string;
  district?: string;
  ward?: string;
  amenityIds?: string[] | string;
  lat?: string | number;
  lng?: string | number;
  radius?: string | number;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
  page?: string | number;
  limit?: string | number;
};

/** Filter thường — an toàn cho GET query; tuyệt đối không chứa toạ độ. */
function basePostSearchInput(source: PostSearchSource) {
  return {
    keyword: source.keyword,
    minPrice: toOptionalNumber(source.minPrice),
    maxPrice: toOptionalNumber(source.maxPrice),
    minArea: toOptionalNumber(source.minArea),
    maxArea: toOptionalNumber(source.maxArea),
    province: source.province,
    district: source.district,
    ward: source.ward,
    amenityIds: toOptionalStringArray(source.amenityIds),
    sortBy: source.sortBy,
    page: toPositiveInt(source.page, 1),
    limit: toPositiveInt(source.limit, 10),
  };
}

/** Filter có toạ độ — CHỈ gọi với `req.body` từ route POST. */
function postSearchInputWithLocation(source: PostSearchSource) {
  return {
    ...basePostSearchInput(source),
    lat: toOptionalNumber(source.lat),
    lng: toOptionalNumber(source.lng),
    radius: toOptionalNumber(source.radius),
  };
}

/** Query string luôn là chuỗi: `''`/không phải số -> `undefined` (không thành 0). */
function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Nhận mảng thật hoặc CSV (`id1,id2`); rỗng -> `undefined`. */
function toOptionalStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    return items.length > 0 ? items : undefined;
  }
  if (typeof value === 'string') {
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

/** Số nguyên dương, nếu không hợp lệ thì dùng mặc định (không bao giờ thành 0). */
function toPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
