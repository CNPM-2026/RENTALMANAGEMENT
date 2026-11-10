import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_PASSWORD } from '../utils/email';
import { authService } from './auth.service';

/**
 * Test hành vi phân giải tài khoản Google. Không chạm DB: `prisma` và Google
 * client được thay bằng mock để kiểm tra đúng chính sách retry/claim, không phải
 * để kiểm tra SQL.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { updateMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    refreshToken: { updateMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    userFindMany: vi.fn(),
    userCreate: vi.fn(),
    userUpdate: vi.fn(),
    refreshTokenCreate: vi.fn(),
    getToken: vi.fn(),
    verifyIdToken: vi.fn(),
  };
});

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    generateAuthUrl() {
      return 'https://accounts.google.test/auth';
    }
    getToken(code: string) {
      return mocks.getToken(code);
    }
    verifyIdToken(options: unknown) {
      return mocks.verifyIdToken(options);
    }
  },
}));

vi.mock('../config/env', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost/auth/google/callback',
  },
}));

vi.mock('../utils/jwt', () => ({
  signGoogleOAuthState: () => 'signed-state',
  verifyGoogleOAuthState: () => ({ ok: true }),
  signShortToken: () => 'access-token',
}));

vi.mock('./mail.service', () => ({
  mailService: { sendEmailVerification: vi.fn(), sendPasswordReset: vi.fn() },
}));

vi.mock('../config/db', () => ({
  default: {
    user: { findMany: mocks.userFindMany, create: mocks.userCreate, update: mocks.userUpdate },
    refreshToken: { create: mocks.refreshTokenCreate, updateMany: mocks.tx.refreshToken.updateMany },
    auditLog: { create: mocks.tx.auditLog.create },
    $transaction: mocks.transaction,
  },
}));

const p2002 = (target: unknown, modelName: unknown = 'User') =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6.19.3',
    meta: { modelName, target },
  });

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ01234',
  fullName: 'Tên cũ',
  phone: null,
  avatarUrl: null,
  role: 'TENANT',
  isActive: true,
  isEmailVerified: true,
};

const primeGoogle = (email = 'User@Example.com') => {
  mocks.getToken.mockResolvedValue({ tokens: { id_token: 'id-token' } });
  mocks.verifyIdToken.mockResolvedValue({
    getPayload: () => ({
      sub: 'google-sub-1',
      email,
      email_verified: true,
      name: 'Google User',
      picture: 'https://pic.test/avatar.png',
    }),
  });
  mocks.refreshTokenCreate.mockResolvedValue({});
};

describe('google account resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(mocks.tx) : Promise.all(arg as Promise<unknown>[]),
    );
    // Mọi test thành công đều đi qua `issueSession` (khóa users -> tạo refresh token).
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'user-1' }]);
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue(baseUser);
    mocks.tx.refreshToken.create.mockResolvedValue({});
    primeGoogle();
  });

  it('normalises the Google email and looks the account up case-insensitively', async () => {
    mocks.userFindMany.mockResolvedValue([baseUser]);
    mocks.userUpdate.mockResolvedValue(baseUser);

    await authService.loginWithGoogle('code-1', 'state-1');

    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(mocks.getToken).toHaveBeenCalledWith('code-1');
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { email: { equals: 'user@example.com', mode: 'insensitive' } },
      take: 2,
    });
  });

  it('creates a Google-only account with the no-password sentinel', async () => {
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'user-new', ...data }));

    const result = await authService.loginWithGoogle('code-1', 'state-1');
    const created = mocks.userCreate.mock.calls[0][0].data;

    expect(created.passwordHash).toBe(NO_PASSWORD);
    expect(created.isEmailVerified).toBe(true);
    expect(created.email).toBe('user@example.com');
    expect(created).not.toHaveProperty('isActive');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('retries exactly once on the users-email conflict without re-exchanging the code', async () => {
    mocks.userFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([baseUser]);
    mocks.userCreate.mockRejectedValue(p2002(['email']));
    mocks.userUpdate.mockResolvedValue(baseUser);

    const result = await authService.loginWithGoogle('code-1', 'state-1');

    expect(mocks.userCreate).toHaveBeenCalledTimes(1);
    expect(mocks.userFindMany).toHaveBeenCalledTimes(2);
    // Authorization code chỉ dùng được một lần: tuyệt đối không đổi lại khi retry DB.
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
    expect(mocks.verifyIdToken).toHaveBeenCalledTimes(1);
    expect(result.token).toBe('access-token');
  });

  it('accepts the constraint-name form of the same conflict', async () => {
    mocks.userFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([baseUser]);
    mocks.userCreate.mockRejectedValue(p2002('users_email_key'));
    mocks.userUpdate.mockResolvedValue(baseUser);

    await expect(authService.loginWithGoogle('code-1', 'state-1')).resolves.toBeTruthy();
    expect(mocks.userCreate).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the conflict is not the users email constraint', async () => {
    const conflict = p2002(['token_hash'], 'RefreshToken');
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCreate.mockRejectedValue(conflict);

    await expect(authService.loginWithGoogle('code-1', 'state-1')).rejects.toBe(conflict);
    expect(mocks.userCreate).toHaveBeenCalledTimes(1);
    expect(mocks.userFindMany).toHaveBeenCalledTimes(1);
  });

  it('stops after the bounded retry and surfaces the original error', async () => {
    const conflict = p2002(['email']);
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userCreate.mockRejectedValue(conflict);

    await expect(authService.loginWithGoogle('code-1', 'state-1')).rejects.toBe(conflict);
    expect(mocks.userCreate).toHaveBeenCalledTimes(2);
    expect(mocks.userFindMany).toHaveBeenCalledTimes(2);
    expect(mocks.getToken).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the email matches more than one row', async () => {
    mocks.userFindMany.mockResolvedValue([{ ...baseUser, id: 'user-a' }, { ...baseUser, id: 'user-b' }]);

    const error = await authService.loginWithGoogle('code-1', 'state-1').catch((thrown: unknown) => thrown);

    expect(error).toMatchObject({ name: 'AmbiguousEmailError', statusCode: 400 });
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.refreshTokenCreate).not.toHaveBeenCalled();
  });

  it('never signs in a banned account and never reactivates it', async () => {
    mocks.userFindMany.mockResolvedValue([{ ...baseUser, isActive: false, isEmailVerified: false }]);

    await expect(authService.loginWithGoogle('code-1', 'state-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Tài khoản đã bị khóa',
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.tx.user.updateMany).not.toHaveBeenCalled();
    expect(mocks.refreshTokenCreate).not.toHaveBeenCalled();
    expect(mocks.tx.refreshToken.create).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('claims an unverified account, revoking tokens and auditing in one transaction', async () => {
    const unverified = { ...baseUser, isEmailVerified: false };
    mocks.userFindMany.mockResolvedValue([unverified]);
    mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    mocks.tx.auditLog.create.mockResolvedValue({});
    mocks.tx.user.findUniqueOrThrow.mockResolvedValue({ ...unverified, isEmailVerified: true });

    const result = await authService.loginWithGoogle('code-1', 'state-1');
    const claim = mocks.tx.user.updateMany.mock.calls[0][0];

    expect(claim.where).toEqual({ id: 'user-1', isEmailVerified: false, isActive: true });
    expect(claim.data).toMatchObject({
      isEmailVerified: true,
      fullName: 'Google User',
      avatarUrl: 'https://pic.test/avatar.png',
    });
    // Không ghi đè mật khẩu hợp lệ đã có và không đụng tới trạng thái khóa.
    expect(claim.data).not.toHaveProperty('passwordHash');
    expect(claim.data).not.toHaveProperty('isActive');

    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        action: 'GOOGLE_ACCOUNT_CLAIMED',
        entityType: 'USER',
        entityId: 'user-1',
      }),
    });
    // 2 transaction: một cho claim, một cho issueSession (khóa users -> tạo RT).
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.tx.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('does not audit or revoke when another request already verified the account', async () => {
    mocks.userFindMany.mockResolvedValue([{ ...baseUser, isEmailVerified: false }]);
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.user.findUnique.mockResolvedValue({ ...baseUser, isEmailVerified: true });

    const result = await authService.loginWithGoogle('code-1', 'state-1');

    expect(result.user.id).toBe('user-1');
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('fails closed when the account is banned while being claimed', async () => {
    mocks.userFindMany.mockResolvedValue([{ ...baseUser, isEmailVerified: false }]);
    mocks.tx.user.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false });

    await expect(authService.loginWithGoogle('code-1', 'state-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Tài khoản đã bị khóa',
    });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.refreshTokenCreate).not.toHaveBeenCalled();
  });

  it('surfaces a revocation failure without writing the audit event', async () => {
    mocks.userFindMany.mockResolvedValue([{ ...baseUser, isEmailVerified: false }]);
    mocks.tx.user.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.refreshToken.updateMany.mockRejectedValue(new Error('refresh token store down'));

    await expect(authService.loginWithGoogle('code-1', 'state-1')).rejects.toThrow('refresh token store down');
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
    expect(mocks.refreshTokenCreate).not.toHaveBeenCalled();
  });

  it('keeps verified accounts untouched apart from profile fields', async () => {
    mocks.userFindMany.mockResolvedValue([baseUser]);
    mocks.userUpdate.mockResolvedValue({ ...baseUser, fullName: 'Google User' });

    await authService.loginWithGoogle('code-1', 'state-1');

    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { fullName: 'Google User', avatarUrl: 'https://pic.test/avatar.png' },
    });
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });
});
