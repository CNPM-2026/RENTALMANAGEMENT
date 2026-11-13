import { z } from 'zod';

// Lọc theo tiện ích: query string là CSV (`id1,id2`), body có thể là mảng thật.
const amenityIdsInput = z.preprocess(
  (value) => (typeof value === 'string' ? (value ? value.split(',') : undefined) : value),
  z.array(z.string()).optional(),
);

/**
 * Filter KHÔNG nhạy cảm — dùng được qua GET query string.
 *
 * `lat`/`lng`/`radius` KHÔNG nằm ở đây: CodeQL coi toạ độ đọc từ GET là dữ liệu
 * nhạy cảm (có thể lộ qua access log, browser history, referer). Chúng chỉ được
 * nhận qua body của `POST /posts/search`.
 */
const postSearchFilterFields = {
  // Tìm kiếm cơ bản
  keyword: z.string().optional(),

  // Lọc theo giá (Dành cho Room)
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),

  // Lọc theo diện tích
  minArea: z.coerce.number().optional(),
  maxArea: z.coerce.number().optional(),

  // Lọc theo khu vực
  province: z.string().optional(),
  district: z.string().optional(),
  ward: z.string().optional(),

  // Lọc theo tiện ích (Truyền vào mảng ID, ví dụ: id1,id2)
  amenityIds: amenityIdsInput,

  // Sắp xếp & Phân trang
  sortBy: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};

/** GET chỉ nhận filter thường; toạ độ bị từ chối thay vì âm thầm bỏ qua. */
export const searchPostGetQuerySchema = z
  .object(postSearchFilterFields)
  .strict();

const validateCoordinatePair = (
  value: { lat?: number; lng?: number },
  ctx: z.RefinementCtx,
) => {
  if ((value.lat === undefined) !== (value.lng === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'lat và lng phải được truyền cùng nhau', path: ['lat'] });
  }
};

/** Body của `POST /posts/search` (có toạ độ nhạy cảm). */
export const searchPostBodySchema = z
  .object({
    ...postSearchFilterFields,
    // Tìm theo bản đồ / Vị trí (Tọa độ user & Bán kính km)
    lat: z.coerce.number().finite().min(-90).max(90).optional(),
    lng: z.coerce.number().finite().min(-180).max(180).optional(),
    radius: z.coerce.number().finite().positive().max(1000).optional(), // Mặc định 5km nếu có lat/lng
  })
  .superRefine(validateCoordinatePair);
