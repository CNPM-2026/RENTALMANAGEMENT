import { Prisma } from '@prisma/client';

/**
 * Tên index unique của `users.email` do PostgreSQL/Prisma sinh ra (`<bảng>_<cột>_key`).
 * Query engine có thể trả `meta.target` dạng mảng tên cột (`['email']`) hoặc dạng
 * tên constraint (`'users_email_key'`), nên phải chấp nhận cả hai hình dạng.
 */
const USER_EMAIL_CONSTRAINT = 'users_email_key';
const USER_EMAIL_FIELD = 'email';
const USER_MODEL_NAME = 'User';

const readTargets = (target: unknown): string[] => {
  if (typeof target === 'string') return [target];
  if (Array.isArray(target)) return target.filter((item): item is string => typeof item === 'string');
  return [];
};

/**
 * Chỉ trả về true với đúng xung đột unique `users.email` (Prisma P2002).
 *
 * Dùng để quyết định có retry/ánh xạ lỗi hay không, nên phải fail closed: mọi
 * P2002 khác (ví dụ `refresh_tokens.token_hash_key`), P2002 thiếu `meta.target`,
 * hoặc lỗi không phải Prisma đều trả về false để lỗi gốc được ném nguyên trạng.
 */
export const isUserEmailUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;

  const meta = (error.meta ?? {}) as { modelName?: unknown; target?: unknown };
  // `meta.modelName` không phải lúc nào cũng có; chỉ dùng khi nó thực sự là chuỗi.
  if (typeof meta.modelName === 'string' && meta.modelName !== USER_MODEL_NAME) return false;

  return readTargets(meta.target).some((target) => {
    const identifier = target.toLowerCase();
    return identifier === USER_EMAIL_FIELD || identifier === USER_EMAIL_CONSTRAINT;
  });
};
