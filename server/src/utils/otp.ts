import crypto from 'crypto';
import { env } from '../config/env';
import { AppError } from './AppError';

/**
 * H-05: mã OTP (email verification / login step-up) được lưu dưới dạng
 * HMAC-SHA256 có khóa (pepper) thay cho SHA-256 không khóa.
 *
 * Nguyên liệu HMAC: `v<version>:<purpose>:<code>` — nhờ đó
 *  - mã phát cho purpose này không bao giờ khớp với purpose khác,
 *  - đổi cấu trúc/pepper (kèm tăng version) làm mọi row cũ không còn khớp.
 *
 * Khóa (`OTP_PEPPER`) là secret riêng: KHÔNG dùng JWT_SECRET, DB_URL hay bất kỳ
 * secret nào khác làm fallback. Thiếu/sai pepper -> luồng OTP fail closed (503),
 * không bao giờ rơi về thuật toán không khóa.
 *
 * Giá trị `OTP_PURPOSE` phải trùng với enum `OtpPurpose` trong `schema.prisma`.
 */
export const OTP_PURPOSE = {
  SIGNUP_VERIFY: 'SIGNUP_VERIFY',
  LOGIN_STEP_UP: 'LOGIN_STEP_UP',
} as const;

export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];

/** Thời gian sống của mã OTP gửi qua email (10 phút). */
export const OTP_TTL_MS = 10 * 60 * 1000;

/**
 * Số lượt thử tối đa của MỖI row. Giá trị được chụp vào cột `max_attempts` lúc
 * phát hành, nên thay đổi hằng số này chỉ áp dụng cho challenge phát sau đó.
 */
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Phiên bản cấu trúc HMAC, lưu kèm từng row (`hmac_version`) để verifier chỉ
 * chấp nhận đúng phiên bản đang cấu hình.
 *
 * Xoay pepper: đặt `OTP_PEPPER` mới và tăng `OTP_PEPPER_VERSION`. Mọi challenge
 * đang sống (tối đa 10 phút) trở nên không thể tiêu thụ — người dùng chỉ cần
 * gửi lại mã. Không cần backfill: row cũ giữ version cũ nên bị từ chối.
 */
export const OTP_HMAC_VERSION = env.OTP_PEPPER_VERSION ?? 1;

const MIN_PEPPER_LENGTH = 32;

let configErrorLogged = false;

/**
 * Lỗi cấu hình -> 503 fail closed. Message trả về client là trung tính (không cho
 * biết server thiếu cấu hình gì); chẩn đoán chỉ ghi MỘT lần ở server log và chỉ
 * nêu TÊN biến, không bao giờ ghi giá trị pepper.
 */
const otpConfigError = () => {
  if (!configErrorLogged) {
    configErrorLogged = true;
    console.error(
      '[H-05/OTP] OTP_PEPPER thiếu hoặc không hợp lệ (cần >= 32 ký tự và phải khác JWT_SECRET/DB_URL). '
      + 'Luồng OTP tạm thời bị vô hiệu hóa (fail closed).',
    );
  }
  return new AppError(
    'Không thể xử lý yêu cầu xác minh email lúc này, vui lòng thử lại sau',
    503,
    'OTP_SERVICE_UNAVAILABLE',
  );
};

let cachedPepper: string | null = null;

/**
 * Pepper được đọc một lần rồi giữ trong RAM. Sai cấu hình -> ném 503 (fail closed)
 * thay vì băm bằng khóa rỗng. Không log giá trị pepper ở bất kỳ đâu.
 */
const getPepper = (): string => {
  if (cachedPepper) return cachedPepper;

  const pepper = (env.OTP_PEPPER ?? '').trim();
  if (pepper.length < MIN_PEPPER_LENGTH) throw otpConfigError();
  // Chặn tái sử dụng secret khác (lỗi cấu hình phổ biến nhất khi copy `.env`).
  if (pepper === env.JWT_SECRET || pepper === env.DB_URL) throw otpConfigError();

  cachedPepper = pepper;
  return cachedPepper;
};

/** HMAC-SHA256 của mã OTP theo purpose + version hiện hành (dạng hex). */
export const hashOtp = (code: string, purpose: OtpPurpose): string =>
  crypto
    .createHmac('sha256', getPepper())
    .update(`v${OTP_HMAC_VERSION}:${purpose}:${code}`)
    .digest('hex');

/**
 * So khớp HMAC đã tính trước với `code_hash` đã lưu bằng `timingSafeEqual`.
 * Trả false (không ném) với mọi dữ liệu không phải hex 32 byte, nhờ vậy row cũ
 * (SHA-256 không khóa) hoặc dữ liệu rác không bao giờ được chấp nhận.
 */
export const otpHashMatches = (presentedHash: string, storedHash: string): boolean => {
  if (typeof presentedHash !== 'string' || presentedHash.length !== 64) return false;
  if (typeof storedHash !== 'string' || storedHash.length !== 64) return false;

  const expected = Buffer.from(presentedHash, 'hex');
  const actual = Buffer.from(storedHash, 'hex');
  if (expected.length !== 32 || actual.length !== 32) return false;

  return crypto.timingSafeEqual(actual, expected);
};
