import { describe, expect, it } from 'vitest';
import {
  searchPostBodySchema,
  searchPostGetQuerySchema,
} from '../../src/validations/post.validation';

describe('post search validation', () => {
  it('chặn toạ độ trên GET thay vì âm thầm bỏ qua', () => {
    const result = searchPostGetQuerySchema.safeParse({
      keyword: 'quận 1',
      lat: '10.1',
      lng: '106.2',
      radius: '5',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
    }
  });

  it('cho phép filter thường và parse amenityIds CSV trên GET', () => {
    const result = searchPostGetQuerySchema.safeParse({
      keyword: 'quận 1',
      minPrice: '1000000',
      amenityIds: 'amenity-1,amenity-2',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        keyword: 'quận 1',
        minPrice: 1000000,
        amenityIds: ['amenity-1', 'amenity-2'],
      });
      expect(result.data).not.toHaveProperty('lat');
      expect(result.data).not.toHaveProperty('lng');
      expect(result.data).not.toHaveProperty('radius');
    }
  });

  it('nhận toạ độ và amenityIds dạng mảng trong POST body', () => {
    const result = searchPostBodySchema.safeParse({
      keyword: 'quận 1',
      amenityIds: ['amenity-1', 'amenity-2'],
      lat: 10.1,
      lng: 106.2,
      radius: 5,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        lat: 10.1,
        lng: 106.2,
        radius: 5,
        amenityIds: ['amenity-1', 'amenity-2'],
      });
    }
  });

  it('vẫn chặn toạ độ thiếu cặp trong POST body', () => {
    const result = searchPostBodySchema.safeParse({ lat: 10.1 });

    expect(result.success).toBe(false);
  });
});
