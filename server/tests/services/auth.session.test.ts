import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PASSWORD } from '../../src/utils/email';
import { hashToken } from '../../src/utils/tokens';
import { authService } from '../../src/services/auth.service';

/**
 * Test ranh giới transaction của luồng cấp phiên / rotation. Không chạm DB: kiểm
 * tra thứ tự gọi (khóa `users` trước khi ghi `refresh_tokens`), chứ không kiểm
 * tra SQL thật — việc đó thuộc về test tích hợp ở batch sau.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    refreshToken: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    userFindMany: vi.fn(),
    refreshTokenUpdateMany: vi.fn(),
    signShortToken: vi.fn(),
  };
});

vi.mock('../../src/config/env', () => ({ env: {} }));

vi.mock('../../src/utils/jwt', () => ({
  signGoogleOAuthState: () => 'signed-state',
  verifyGoogleOAuthState: () => ({ ok: true }),
  signShortToken: mocks.signShortToken,
}));

vi.mock('../../src/services/mail.service', () => ({
  mailService: { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() },
}));

vi.mock('../../src/config/db', () => ({
  default: {
    user: { findMany: mocks.userFindMany },
    refreshToken: { updateMany: mocks.refreshTokenUpdateMany },
    $transaction: mocks.transaction,
  },
}));

const PASSWORD = 'Correct#Pass1';
let passwordHash = '';

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  fullName: 'Người dùng',
  phone: null,
  avatarUrl: null,
  role: 'TENANT',
  isActive: true,
  isEmailVerified: true,
};

const dbUser = (overrides: Record<string, unknown> = {}) => ({ ...baseUser, passwordHash, ...overrides });

/** Nội dung SQL của một lệnh `$queryRaw` dạng tagged template. */
const sqlOf = (call: unknown[]) => String((call[0] as string[]).join('?'));

const futureDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000);
const storedToken = 'old-refresh-token';
const storedRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'rt-1',
  userId: 'user-1',
  tokenHash: hashToken(storedToken),
  revokedAt: null,
  expiresAt: futureDate(),
  ...overrides,
});

const deadlock = () =>
  new Prisma.PrismaClientKnownRequestError('deadlock detected', {
    code: 'P2034',
    clientVersion: '6.19.3',
  });

describe('session issuance and rotation', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    passwordHash = await bcrypt.hash(PASSWORD, 4);
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mocks.tx) : Promise.all(arg as Promise<unknown>[]),
    );
    mocks.signShortToken.mockReturnValue('access-token');
    mocks.tx.$queryRaw.mockResolvedValue([{ id: baseUser.id }]);
    mocks.tx.refreshToken.create.mockResolvedValue({});
  });

  it('persists the refresh token only after locking the user row', async () => {
    mocks.userFindMany.mockResolvedValue([dbUser()]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(dbUser());

    const result = await authService.login('User@Example.com', PASSWORD);

    expect(result.token).toBe('access-token');
    expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { email: { equals: 'user@example.com', mode: 'insensitive' } },
      take: 2,
    });

    // Khóa row users là lệnh ĐẦU TIÊN của transaction cấp phiên.
    const lockSql = sqlOf(mocks.tx.$queryRaw.mock.calls[0]);
    expect(lockSql).toMatch(/FROM\s+users/i);
    expect(lockSql).toMatch(/FOR\s+UPDATE/i);
    expect(mocks.tx.$queryRaw.mock.calls[0][1]).toBe('user-1');

    // Thứ tự: users (khóa -> đọc lại) rồi mới refresh_tokens (ghi).
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.user.findUniqueOrThrow.mock.invocationCallOrder[0],
    );
    expect(mocks.tx.user.findUniqueOrThrow.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.refreshToken.create.mock.invocationCallOrder[0],
    );
    // Ký access token trong transaction: lỗi ký không để lại RT mồ côi.
    expect(mocks.signShortToken.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.refreshToken.create.mock.invocationCallOrder[0],
    );

    const created = mocks.tx.refreshToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    };
    expect(created.data.userId).toBe('user-1');
    expect(created.data.tokenHash).toBe(hashToken(result.refreshToken));
    // Phiên đăng nhập tối đa 2 giờ (yêu cầu nghiệp vụ) — không còn 30 ngày.
    const ttl = created.data.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(2 * 60 * 60 * 1000 - 5_000);
    expect(ttl).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
  });

  it('refuses a session for an account deactivated between the lookup and the lock', async () => {
    mocks.userFindMany.mockResolvedValue([dbUser()]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(dbUser({ isActive: false }));

    await expect(authService.login(baseUser.email, PASSWORD)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Tài khoản đã bị khóa',
    });
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
    expect(mocks.signShortToken).not.toHaveBeenCalled();
  });

  it('refuses a session when the password was replaced while credentials were verified', async () => {
    mocks.userFindMany.mockResolvedValue([dbUser()]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(dbUser({ passwordHash: await bcrypt.hash('Other#Pass2', 4) }));

    await expect(authService.login(baseUser.email, PASSWORD)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Email hoặc mật khẩu không đúng',
    });
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses a session when the account became unverified before the lock', async () => {
    mocks.userFindMany.mockResolvedValue([dbUser()]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(dbUser({ isEmailVerified: false }));

    await expect(authService.login(baseUser.email, PASSWORD)).rejects.toMatchObject({
      statusCode: 403,
      message: 'Vui lòng xác minh email trước khi đăng nhập',
    });
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('never issues a password session for a Google-only account', async () => {
    mocks.userFindMany.mockResolvedValue([dbUser({ passwordHash: NO_PASSWORD })]);

    await expect(authService.login(baseUser.email, PASSWORD)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('locks the user before claiming the old refresh token during rotation', async () => {
    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow());
    mocks.tx.user.findUnique.mockResolvedValue(dbUser());
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await authService.refresh(storedToken);

    // Bước đọc đầu tiên không khóa, chỉ để biết chủ sở hữu token.
    expect(mocks.tx.refreshToken.findUnique).toHaveBeenCalledWith({ where: { tokenHash: hashToken(storedToken) } });
    const lockSql = sqlOf(mocks.tx.$queryRaw.mock.calls[0]);
    expect(lockSql).toMatch(/FROM\s+users/i);
    expect(lockSql).toMatch(/FOR\s+UPDATE/i);

    // users (khóa) trước, rồi mới claim token cũ và ghi token mới.
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.refreshToken.updateMany.mock.invocationCallOrder[0],
    );
    expect(mocks.tx.refreshToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.refreshToken.create.mock.invocationCallOrder[0],
    );

    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    const created = mocks.tx.refreshToken.create.mock.calls[0][0] as {
      data: { userId: string; tokenHash: string };
    };
    expect(created.data.userId).toBe('user-1');
    expect(created.data.tokenHash).toBe(hashToken(result.refreshToken));
    expect(result.refreshToken).not.toBe(storedToken);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('rotation keeps the absolute session deadline instead of extending it', async () => {
    // Phiên còn 30 phút: token mới phải hết hạn đúng mốc đó, KHÔNG cộng thêm 2 giờ.
    const sessionEnd = new Date(Date.now() + 30 * 60 * 1000);
    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow({ expiresAt: sessionEnd }));
    mocks.tx.user.findUnique.mockResolvedValue(dbUser());
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await authService.refresh(storedToken);

    const created = mocks.tx.refreshToken.create.mock.calls[0][0] as {
      data: { expiresAt: Date };
    };
    expect(created.data.expiresAt.getTime()).toBe(sessionEnd.getTime());
  });

  it('does not issue a replacement token when the claim loses the race', async () => {
    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow());
    mocks.tx.user.findUnique.mockResolvedValue(dbUser());
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    await expect(authService.refresh(storedToken)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token đã được sử dụng',
    });
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
    expect(mocks.signShortToken).not.toHaveBeenCalled();
  });

  it('refuses rotation for a deactivated user before touching the token', async () => {
    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow());
    mocks.tx.user.findUnique.mockResolvedValue(dbUser({ isActive: false }));

    await expect(authService.refresh(storedToken)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Refresh token không hợp lệ hoặc đã hết hạn',
    });
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
  });

  it('refuses unknown or expired tokens without locking the user row', async () => {
    mocks.tx.refreshToken.findUnique.mockResolvedValue(null);

    await expect(authService.refresh(storedToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();

    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow({ expiresAt: new Date(Date.now() - 1000) }));
    await expect(authService.refresh(storedToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('never turns a deadlock during rotation into a session or a silent retry', async () => {
    const failure = deadlock();
    mocks.tx.refreshToken.findUnique.mockResolvedValue(storedRow());
    mocks.tx.user.findUnique.mockResolvedValue(dbUser());
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.refreshToken.create.mockRejectedValue(failure);

    await expect(authService.refresh(storedToken)).rejects.toBe(failure);
    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('never turns a deadlock during login into a session or a silent retry', async () => {
    const failure = deadlock();
    mocks.userFindMany.mockResolvedValue([dbUser()]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(dbUser());
    mocks.tx.refreshToken.create.mockRejectedValue(failure);

    await expect(authService.login(baseUser.email, PASSWORD)).rejects.toBe(failure);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('revokes only the refresh token row on logout and never locks users', async () => {
    mocks.refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

    await authService.logout('some-refresh-token');

    expect(mocks.refreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('some-refresh-token'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });
});

