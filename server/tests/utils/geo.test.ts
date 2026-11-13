import { describe, expect, it } from 'vitest';
import { boundingBox, haversineDistanceKm, longitudeRanges, roundDistanceKm, toCoordinates } from '../../src/utils/geo';

/**
 * Toán địa lý là nền của mọi con số "cách X km" hiển thị cho chủ trọ/thợ.
 * Sai ở đây nghĩa là giao việc dựa trên khoảng cách bịa, nên các test dưới đây
 * tập trung vào hai điều: con số đúng (Haversine) và KHÔNG BAO GIỜ suy diễn
 * khoảng cách khi thiếu toạ độ.
 */
describe('geo.toCoordinates', () => {
  it('trả null khi thiếu một trong hai trục (không coi null là 0,0)', () => {
    expect(toCoordinates(null, 105)).toBeNull();
    expect(toCoordinates(21, null)).toBeNull();
    expect(toCoordinates(undefined, undefined)).toBeNull();
  });

  it('trả null với toạ độ ngoài miền hoặc không hữu hạn', () => {
    expect(toCoordinates(91, 105)).toBeNull();
    expect(toCoordinates(21, 181)).toBeNull();
    expect(toCoordinates(Number.NaN, 105)).toBeNull();
    expect(toCoordinates(21, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('giữ nguyên toạ độ hợp lệ', () => {
    expect(toCoordinates(21.0278, 105.8342)).toEqual({ latitude: 21.0278, longitude: 105.8342 });
    // (0,0) chỉ hợp lệ khi client THẬT SỰ gửi 0 — không phải giá trị mặc định.
    expect(toCoordinates(0, 0)).toEqual({ latitude: 0, longitude: 0 });
  });
});

describe('geo.haversineDistanceKm', () => {
  it('tính khoảng cách Hà Nội - TP.HCM trong khoảng 1.100-1.200 km', () => {
    const distance = haversineDistanceKm(
      { latitude: 21.0278, longitude: 105.8342 },
      { latitude: 10.8231, longitude: 106.6297 },
    );
    expect(distance).not.toBeNull();
    expect(distance as number).toBeGreaterThan(1100);
    expect(distance as number).toBeLessThan(1200);
  });

  it('trả 0 cho cùng một điểm', () => {
    expect(haversineDistanceKm({ latitude: 21, longitude: 105 }, { latitude: 21, longitude: 105 })).toBeCloseTo(0, 6);
  });

  it('trả null thay vì bịa số khi thiếu toạ độ', () => {
    expect(haversineDistanceKm(null, { latitude: 21, longitude: 105 })).toBeNull();
    expect(haversineDistanceKm({ latitude: 21, longitude: 105 }, null)).toBeNull();
  });
});

describe('geo.roundDistanceKm', () => {
  it('làm tròn tới 0.1 km và giữ null', () => {
    expect(roundDistanceKm(1.234)).toBe(1.2);
    expect(roundDistanceKm(1.26)).toBe(1.3);
    expect(roundDistanceKm(null)).toBeNull();
  });
});

describe('geo.boundingBox', () => {
  it('bao quanh tâm theo bán kính và kẹp vĩ độ trong [-90, 90]', () => {
    const box = boundingBox({ latitude: 21, longitude: 105 }, 10);
    expect(box).not.toBeNull();
    expect(box!.minLatitude).toBeCloseTo(21 - 10 / 111.32, 5);
    expect(box!.maxLatitude).toBeCloseTo(21 + 10 / 111.32, 5);
    expect(box!.minLongitude).toBeLessThan(105);
    expect(box!.maxLongitude).toBeGreaterThan(105);

    const nearPole = boundingBox({ latitude: 89.9, longitude: 0 }, 100);
    expect(nearPole!.maxLatitude).toBeLessThanOrEqual(90);
  });

  it('trả null khi bán kính không hợp lệ', () => {
    expect(boundingBox({ latitude: 21, longitude: 105 }, 0)).toBeNull();
    expect(boundingBox({ latitude: 21, longitude: 105 }, -5)).toBeNull();
  });
});

describe('geo.longitudeRanges', () => {
  it('trả một khoảng khi hộp không vượt đường đổi ngày', () => {
    const ranges = longitudeRanges({ minLatitude: 20, maxLatitude: 22, minLongitude: 104, maxLongitude: 106 });
    expect(ranges).toEqual([{ min: 104, max: 106 }]);
  });

  it('tách thành hai khoảng khi hộp vượt đường đổi ngày (không bỏ sót nửa vùng)', () => {
    const box = boundingBox({ latitude: 0, longitude: 179.9 }, 100);
    expect(box).not.toBeNull();
    const ranges = longitudeRanges(box!);
    expect(ranges).toHaveLength(2);
    expect(ranges[0].min).toBe(-180);
    expect(ranges[1].max).toBe(180);
  });

  it('trả toàn miền khi hộp phủ hết 360 độ', () => {
    expect(longitudeRanges({ minLatitude: -10, maxLatitude: 10, minLongitude: -200, maxLongitude: 200 })).toEqual([
      { min: -180, max: 180 },
    ]);
  });
});
