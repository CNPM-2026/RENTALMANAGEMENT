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
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().optional(), // Mặc định sẽ set 5km nếu có lat/lng
  
  // Sắp xếp & Phân trang
  sortBy: z.enum(['newest', 'price_asc', 'price_desc']).optional().default('newest'),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
});