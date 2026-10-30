import { z } from 'zod';

export const matchingAnswersSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  })).min(1).max(100),
});

export const matchingPreferencesSchema = z.object({
  budgetMin: z.coerce.number().finite().nonnegative().optional(),
  budgetMax: z.coerce.number().finite().nonnegative().optional(),
  preferredGender: z.enum(['MALE', 'FEMALE', 'OTHER', 'ANY']).optional(),
  preferredProvince: z.string().trim().max(100).optional(),
  preferredDistrict: z.string().trim().max(100).optional(),
  preferredWard: z.string().trim().max(100).optional(),
  smokingAllowed: z.boolean().optional(),
  petAllowed: z.boolean().optional(),
  cleanlinessLevel: z.coerce.number().int().min(1).max(5).optional(),
  sleepSchedule: z.string().trim().max(30).optional(),
  occupationPreference: z.string().trim().max(100).optional(),
  note: z.string().max(2000).optional(),
}).refine((value) => value.budgetMin === undefined || value.budgetMax === undefined || value.budgetMin <= value.budgetMax, {
  message: 'Ngân sách tối thiểu phải nhỏ hơn hoặc bằng ngân sách tối đa',
  path: ['budgetMax'],
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Cần cung cấp ít nhất một tiêu chí tìm kiếm',
});
