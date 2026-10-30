import { z } from 'zod';

export const updateProfileSchema = z.object({
  fullName: z.string().min(2, 'Tên quá ngắn').optional(),
  phone: z.string().regex(/(84|0[3|5|7|8|9])+([0-9]{8})\b/, 'SĐT không hợp lệ').optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Ngày sinh không hợp lệ' }).optional(),
  bio: z.string().max(200, 'Bio tối đa 200 ký tự').optional(),
  occupation: z.string().optional(),
});