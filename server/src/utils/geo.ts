/**
 * Toán địa lý dùng chung cho marketplace (Batch 2).
 *
 * Nguyên tắc an toàn dữ liệu:
 * - KHÔNG BAO GIỜ coi `null`/`undefined` là `(0, 0)`. Toạ độ thiếu phải được
 *   xử lý riêng ở nơi gọi (`distanceKm = null`), vì (0,0) là một điểm thật ở
 *   vịnh Guinea và sẽ tạo ra khoảng cách giả.
 * - Mọi giá trị không hữu hạn hoặc ngoài miền kinh/vĩ độ đều bị coi là KHÔNG
 *   có toạ độ (trả `null`), không ném lỗi: dữ liệu cũ có thể đã lưu số lạ.
 */

export type Coordinates = { latitude: number; longitude: number };

/** Bán kính trung bình của Trái Đất (km) — hằng số chuẩn cho công thức Haversine. */
const EARTH_RADIUS_KM = 6371.0088;

/** 1 độ vĩ độ ≈ 111.32 km (không đổi theo vị trí). */
const KM_PER_DEGREE_LATITUDE = 111.32;

export const isValidLatitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;

export const isValidLongitude = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;

/** Chuẩn hoá một cặp toạ độ: trả `null` nếu thiếu hoặc không hợp lệ. */
export const toCoordinates = (
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): Coordinates | null =>
  isValidLatitude(latitude) && isValidLongitude(longitude) ? { latitude, longitude } : null;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Khoảng cách đường chim bay (km) theo công thức Haversine.
 * Trả `null` khi một trong hai đầu thiếu toạ độ hợp lệ — nơi gọi phải hiển thị
 * "không xác định" thay vì một con số bịa.
 */
export const haversineDistanceKm = (
  from: Coordinates | null | undefined,
  to: Coordinates | null | undefined,
): number | null => {
  if (!from || !to) return null;

  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_KM * c;
};

/** Làm tròn khoảng cách tới 0.1 km để hiển thị, không dùng để so sánh chính xác. */
export const roundDistanceKm = (distanceKm: number | null): number | null =>
  distanceKm == null ? null : Math.round(distanceKm * 10) / 10;

export type BoundingBox = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

/**
 * Hộp bao quanh một điểm theo bán kính — dùng để LỌC Ở TẦNG SQL trước khi tính
 * Haversine chính xác. Nhờ vậy không phải nạp toàn bộ bảng vào bộ nhớ.
 *
 * - Vĩ độ bị kẹp trong [-90, 90].
 * - Gần cực hoặc bán kính lớn: hộp trải hết 360° kinh độ (trả `null` cho hai
 *   biên kinh độ để nơi gọi biết "không lọc theo kinh độ").
 */
export const boundingBox = (center: Coordinates, radiusKm: number): BoundingBox | null => {
  if (!isValidLatitude(center.latitude) || !isValidLongitude(center.longitude)) return null;
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) return null;

  const latitudeDelta = radiusKm / KM_PER_DEGREE_LATITUDE;
  const cosLatitude = Math.cos(toRadians(center.latitude));
  // Tại cực cos ≈ 0: một km theo kinh độ tương ứng vô số độ -> trải hết 360°.
  const longitudeDelta =
    Math.abs(cosLatitude) < 1e-6 ? 180 : radiusKm / (KM_PER_DEGREE_LATITUDE * Math.abs(cosLatitude));

  if (longitudeDelta >= 180) {
    return {
      minLatitude: Math.max(-90, center.latitude - latitudeDelta),
      maxLatitude: Math.min(90, center.latitude + latitudeDelta),
      minLongitude: -180,
      maxLongitude: 180,
    };
  }

  return {
    minLatitude: Math.max(-90, center.latitude - latitudeDelta),
    maxLatitude: Math.min(90, center.latitude + latitudeDelta),
    minLongitude: center.longitude - longitudeDelta,
    maxLongitude: center.longitude + longitudeDelta,
  };
};

export type LongitudeRange = { min: number; max: number };

/**
 * Chuyển hộp bao thành 1–2 khoảng kinh độ nằm trong [-180, 180].
 *
 * Khi hộp vượt đường đổi ngày (antimeridian) — ví dụ tâm 179.5° bán kính 100km —
 * phải tách thành hai khoảng ([-180, max] và [min, 180]); nếu chỉ kẹp một khoảng
 * thì một nửa vùng tìm kiếm sẽ bị bỏ sót một cách âm thầm.
 */
export const longitudeRanges = (box: BoundingBox): LongitudeRange[] => {
  if (box.minLongitude <= -180 && box.maxLongitude >= 180) return [{ min: -180, max: 180 }];
  if (box.maxLongitude > 180) {
    return [
      { min: -180, max: box.maxLongitude - 360 },
      { min: box.minLongitude, max: 180 },
    ];
  }
  if (box.minLongitude < -180) {
    return [
      { min: -180, max: box.maxLongitude },
      { min: box.minLongitude + 360, max: 180 },
    ];
  }
  return [{ min: box.minLongitude, max: box.maxLongitude }];
};

