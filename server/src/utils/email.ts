import { AppError } from './AppError';

/**
 * Giá trị sentinel lưu trong `users.passwordHash` cho tài khoản chỉ đăng nhập
 * bằng Google. Cố tình không phải bcrypt hash nên `bcrypt.compare` không bao giờ
 * khớp và `hasUsablePassword` trả về false.
 */
export const NO_PASSWORD = '!';

/**
 * Bcrypt hash hợp lệ (60 ký tự) chỉ dùng để "đốt" đúng lượng CPU như một lần
 * kiểm tra mật khẩu thật khi tài khoản không tồn tại hoặc không có mật khẩu
 * dùng được. Nhờ vậy `POST /auth/login` không lộ trạng thái tài khoản qua timing.
 */
export const DUMMY_PASSWORD_HASH = '$2a$10$cfPQCXRe5gnfAsIabWt4NOaRG26QM9bTFnrvOEy56i7QMxbmgKNrq';

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Dạng chuẩn dùng khi lưu và khi tra cứu: bỏ khoảng trắng + chữ thường. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Chỉ trả về true với bcrypt hash thật. Chặn đường đăng nhập bằng mật khẩu đối
 * với tài khoản tạo qua Google (sentinel) hoặc dữ liệu cũ không dùng được.
 */
export const hasUsablePassword = (passwordHash?: string | null): boolean =>
  typeof passwordHash === 'string' && BCRYPT_HASH_PATTERN.test(passwordHash);

/**
 * Ném ra khi nhiều hơn một row khớp cùng một email đã chuẩn hóa. Vì
 * `users.email` là unique index phân biệt hoa/thường, bản ghi trùng khác casing
 * có thể tồn tại; mọi luồng xác thực phải fail closed thay vì chọn đại một row.
 */
export class AmbiguousEmailError extends AppError {
  constructor() {
    super('Email này đã được sử dụng', 400);
    this.name = 'AmbiguousEmailError';
  }
}
