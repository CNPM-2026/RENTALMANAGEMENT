import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import crypto from 'crypto';

/**
 * H-05/Batch 2B2: access token mang thêm hai claim.
 *
 *  - `av` = `users.authVersion` tại thời điểm phát. LUÔN đọc từ row `users` đã
 *    khóa (hoặc vừa đọc lại sau khi khóa) trong transaction cấp phiên, không bao
 *    giờ lấy từ client. `authenticate` so lại với DB ở mỗi request, nên mọi
 *    mutation làm tăng `authVersion` (đặt/đặt lại mật khẩu, Google claim, khóa
 *    hoặc mở khóa tài khoản) vô hiệu hóa mọi access token đã phát trước đó.
 *  - `typ` = loại token. `JWT_SECRET` dùng chung với `signGoogleOAuthState`, nên
 *    phải phân loại tường minh: JWT khác cùng khóa (OAuth state) không được nhận
 *    như access token.
 *
 * Thuật toán được GHIM ở cả hai chiều. `jwt.verify` mặc định chấp nhận mọi thuật
 * toán HMAC mà khóa bí mật hỗ trợ; ghim `HS256` giữ đúng bề mặt chấp nhận hiện
 * tại (mọi token đang lưu hành đều do `jwt.sign` mặc định sinh ra bằng HS256).
 */
const ACCESS_TOKEN_ALGORITHM: jwt.Algorithm = 'HS256';
const ACCESS_TOKEN_TYPE = 'access';

/** Phần claim do nơi gọi cung cấp — `av` phải lấy từ DB, không từ request. */
export type AccessTokenClaims = { id: string; role: string; av: number };

/** Payload đầy đủ của một access token đã phát. */
export type AccessTokenPayload = AccessTokenClaims & { typ: typeof ACCESS_TOKEN_TYPE };

const issueAccessToken = (claims: AccessTokenClaims, expiresIn: jwt.SignOptions['expiresIn']) =>
  jwt.sign(
    { ...claims, typ: ACCESS_TOKEN_TYPE },
    env.JWT_SECRET,
    { algorithm: ACCESS_TOKEN_ALGORITHM, expiresIn },
  );

export const signToken = (claims: AccessTokenClaims) =>
  issueAccessToken(claims, env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']);

export const signShortToken = (claims: AccessTokenClaims) => issueAccessToken(claims, '15m');

/**
 * Xác thực access token: chữ ký (đã ghim thuật toán) + hạn + hình dạng claim.
 *
 * Mọi vi phạm đều ném `JsonWebTokenError` để giữ nguyên error contract hiện có
 * của middleware (401 "Token không hợp lệ"). Nhờ vậy token cũ thiếu `av`, token
 * sai `typ` và token sai chữ ký đều không dùng được thay vì được chấp nhận im
 * lặng, và response không phân biệt các trường hợp với nhau.
 */
export const verifyToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: [ACCESS_TOKEN_ALGORITHM] });
  if (typeof decoded !== 'object' || decoded === null) throw new jwt.JsonWebTokenError('Token không hợp lệ');

  const { id, role, av, typ } = decoded as Partial<AccessTokenPayload>;

  if (typ !== ACCESS_TOKEN_TYPE) throw new jwt.JsonWebTokenError('Token không hợp lệ');
  if (typeof id !== 'string' || id.length === 0) throw new jwt.JsonWebTokenError('Token không hợp lệ');
  if (typeof role !== 'string' || role.length === 0) throw new jwt.JsonWebTokenError('Token không hợp lệ');
  // Fail closed: thiếu `av` (access token phát trước Batch 2B2) hoặc `av` không
  // phải số nguyên hữu hạn >= 0.
  if (typeof av !== 'number' || !Number.isSafeInteger(av) || av < 0) throw new jwt.JsonWebTokenError('Token không hợp lệ');

  return { id, role, av, typ };
};

export const signGoogleOAuthState = () => jwt.sign(
  { purpose: 'google-oauth', nonce: crypto.randomBytes(16).toString('hex') },
  env.JWT_SECRET,
  { expiresIn: '10m' },
);

export const verifyGoogleOAuthState = (state: string) => {
  const payload = jwt.verify(state, env.JWT_SECRET) as { purpose?: string };
  if (payload.purpose !== 'google-oauth') throw new Error('Invalid OAuth state');
};