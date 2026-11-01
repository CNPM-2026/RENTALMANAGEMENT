import { z } from 'zod';

export const searchPostSchema = z.object({
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
  amenityIds: z.string().optional().transform(val => val ? val.split(',') : undefined),
  
  // Tìm theo bản đồ / Vị trí (Tọa độ user & Bán kính km)
  lat: z.coerce.number().finite().min(-90).max(90).optional(),
  lng: z.coerce.number().finite().min(-180).max(180).optional(),
  radius: z.coerce.number().finite().positive().max(1000).optional(), // Mặc định sẽ set 5km nếu có lat/lng
  
  // Sắp xếp & Phân trang
  sortBy: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
}).superRefine((value, ctx) => {
  if ((value.lat === undefined) !== (value.lng === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'lat và lng phải được truyền cùng nhau', path: ['lat'] });
  }
});