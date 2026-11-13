import { describe, expect, it } from 'vitest';
import {
  matchingPreferencesSchema,
  roommatePostBrowseBodySchema,
  roommatePostGetQuerySchema,
} from '../../src/validations/matching.validation';

describe('matching preference validation', () => {
  it('rejects an empty preference object', () => {
    expect(matchingPreferencesSchema.safeParse({}).success).toBe(false);
  });

  it('accepts district, ward and budget criteria', () => {
    const result = matchingPreferencesSchema.safeParse({
      budgetMin: 1000000,
      budgetMax: 5000000,
      preferredDistrict: 'District 1',
      preferredWard: 'Ben Nghe',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an inverted budget range', () => {
    const result = matchingPreferencesSchema.safeParse({
      budgetMin: 5000000,
      budgetMax: 1000000,
    });

    expect(result.success).toBe(false);
  });
});

describe('roommate post browse validation', () => {
  it('chặn gender trên GET thay vì âm thầm bỏ qua', () => {
    const result = roommatePostGetQuerySchema.safeParse({
      keyword: 'quận 1',
      gender: 'MALE',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('cho phép filter thường trên GET', () => {
    const result = roommatePostGetQuerySchema.safeParse({
      keyword: 'quận 1',
      province: 'Hồ Chí Minh',
      minPrice: '1000000',
      hasRoom: 'true',
      sortBy: 'price_asc',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        keyword: 'quận 1',
        minPrice: 1000000,
        hasRoom: true,
        sortBy: 'price_asc',
      });
      expect(result.data).not.toHaveProperty('gender');
    }
  });

  it('nhận gender trong POST body', () => {
    const result = roommatePostBrowseBodySchema.safeParse({
      keyword: 'quận 1',
      gender: 'MALE',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe('MALE');
      expect(result.data.sortBy).toBe('best_match');
      expect(result.data.limit).toBe(60);
    }
  });

  it('vẫn chặn khoảng giá ngược trong POST body', () => {
    const result = roommatePostBrowseBodySchema.safeParse({
      minPrice: 5000000,
      maxPrice: 1000000,
    });

    expect(result.success).toBe(false);
  });
});
