import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './AppError';

/**
 * H-05/Batch 2B1: "password-setup grant" — credential hẹp được phát DUY NHẤT sau
 * khi tiêu thụ thành công một OTP `SIGNUP_VERIFY`.
 *
 * Mục đích: người sở hữu hộp thư vừa chứng minh quyền sở hữu email cần một cách
 * an toàn để đặt mật khẩu MỚI (mật khẩu do `register` tạo ra đã bị thu hồi vì
 * chưa từng được chứng minh).
 *
 * Vì sao KHÔNG dùng lại `JWT_SECRET` trực tiếp:
 *  - `signShortToken`/`verifyToken` (`utils/jwt.ts`) ký access token bằng
 *    `JWT_SECRET` và chỉ kiểm tra chữ ký, nên nếu grant dùng chung khóa thì một
 *    grant sẽ lọt qua `authenticate` như một access token (và ngược lại).
 *  - Khóa ở đây được SUY RA (derive) bằng HMAC-SHA256 với một nhãn cố định:
 *    `key = HMAC(JWT_SECRET, "rentalmanagement:password-setup-grant:v1")`.
 *    Nhờ vậy hai không gian token tách biệt về mặt mật mã (domain separation):
 *    token ký bằng `JWT_SECRET` không bao giờ verify được bằng khóa này và
 *    ngược lại. Không cần thêm biến môi trường hay secret mới.
 *
 * Ngoài chữ ký, verifier còn bắt buộc:
 *  - `alg = HS256` (chặn alg confusion),
 *  - `iss` + `aud` riêng của grant,
 *  - `purpose` riêng (không dùng chung giá trị với `google-oauth` hay `OtpPurpose`),
 *  - `sub` = userId (ràng buộc người dùng),
 *  - `av` = `users.authVersion` tại thời điểm phát (ràng buộc phiên bản credential),
 *  - `jti` ngẫu nhiên (định danh một lần phát, không phải bí mật),
 *  - hạn dùng ngắn (10 phút), không có khả năng gia hạn.
 *
 * Grant KHÔNG được lưu ở client (không localStorage/sessionStorage/URL) và
 * KHÔNG cấp phiên đăng nhập: nó chỉ dùng được cho `POST /auth/password/set`.
 */
export const PASSWORD_SETUP_GRANT_TTL = '10m';

/** Nhãn suy ra khóa — đổi nhãn (hoặc thêm hậu tố phiên bản) sẽ vô hiệu hóa mọi grant đang sống. */
const PASSWORD_SETUP_GRANT_KEY_LABEL = 'rentalmanagement:password-setup-grant:v1';

export const PASSWORD_SETUP_GRANT_PURPOSE = 'password-setup';
export const PASSWORD_SETUP_GRANT_ISSUER = 'rentalmanagement-auth';
export const PASSWORD_SETUP_GRANT_AUDIENCE = 'rentalmanagement:password-setup';

let cachedKey: Buffer | null = null;

/** Khóa ký/verify riêng của grant (derive một lần, giữ trong RAM). */
const grantKey = (): Buffer => {
  if (!cachedKey) {
    cachedKey = crypto.createHmac('sha256', env.JWT_SECRET).update(PASSWORD_SETUP_GRANT_KEY_LABEL).digest();
  }
  return cachedKey;
};

/**
 * MỘT lỗi duy nhất cho mọi thất bại của grant (sai chữ ký, sai issuer/audience,
 * hết hạn, sai purpose, thiếu claim, user bị khóa/chưa xác minh, `authVersion` cũ,
 * hoặc đã được dùng). Nhờ vậy response không trở thành oracle trạng thái.
 *
 * 400 (không phải 401/403): client chỉ tự refresh khi gặp 401 và tự chuyển trang
 * khi gặp 403, nên 400 giữ đúng ngữ nghĩa "dữ liệu gửi lên không hợp lệ".
 */
export const passwordSetupGrantInvalidError = () =>
  new AppError(
    'Liên kết đặt mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.',
    400,
    'PASSWORD_SETUP_TOKEN_INVALID',
  );

/** Payload sau khi verify (đã kiểm tra đầy đủ). */
export type PasswordSetupGrantClaims = {
  userId: string;
  authVersion: number;
};

/**
 * Phát grant cho `userId` gắn với `authVersion` hiện tại.
 * Phải được gọi BÊN TRONG transaction đã tăng `authVersion` của lần xác minh, để
 * grant không bao giờ tồn tại nếu transaction rollback.
 */
export const issuePasswordSetupGrant = (userId: string, authVersion: number): string =>
  jwt.sign(
    {
      purpose: PASSWORD_SETUP_GRANT_PURPOSE,
      av: authVersion,
      jti: crypto.randomBytes(16).toString('hex'),
    },
    grantKey(),
    {
      algorithm: 'HS256',
      expiresIn: PASSWORD_SETUP_GRANT_TTL,
      issuer: PASSWORD_SETUP_GRANT_ISSUER,
      audience: PASSWORD_SETUP_GRANT_AUDIENCE,
      subject: userId,
    },
  );

/**
 * Verifier RIÊNG cho grant. Không dùng `verifyToken` dùng chung vì verifier đó
 * không (và không nên) biết tới `purpose`/`iss`/`aud`/`av` của grant.
 * Ném `PASSWORD_SETUP_TOKEN_INVALID` (400) với mọi dữ liệu không hợp lệ.
 */
export const verifyPasswordSetupGrant = (token: string): PasswordSetupGrantClaims => {
  let decoded: jwt.JwtPayload;
  try {
    const verified = jwt.verify(token, grantKey(), {
      algorithms: ['HS256'],
      issuer: PASSWORD_SETUP_GRANT_ISSUER,
      audience: PASSWORD_SETUP_GRANT_AUDIENCE,
    });
    if (typeof verified === 'string') throw passwordSetupGrantInvalidError();
    decoded = verified;
  } catch {
    // jsonwebtoken ném ở mọi trường hợp sai (chữ ký/hạn/iss/aud/alg). Không log
    // token, không phân biệt nguyên nhân ra bên ngoài.
    throw passwordSetupGrantInvalidError();
  }

  if (decoded.purpose !== PASSWORD_SETUP_GRANT_PURPOSE) throw passwordSetupGrantInvalidError();
  if (typeof decoded.sub !== 'string' || decoded.sub.length === 0) throw passwordSetupGrantInvalidError();
  if (typeof decoded.jti !== 'string' || decoded.jti.length < 16) throw passwordSetupGrantInvalidError();

  const authVersion = decoded.av;
  if (typeof authVersion !== 'number' || !Number.isInteger(authVersion) || authVersion < 0) {
    throw passwordSetupGrantInvalidError();
  }

  return { userId: decoded.sub, authVersion };
};
