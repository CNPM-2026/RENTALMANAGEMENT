import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { authService } from '../../src/services/auth.service';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  auditRecord: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({ env: {} }));

vi.mock('../../src/config/db', () => ({
  default: {
    user: {
      findUnique: mocks.userFindUnique,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: {
    record: mocks.auditRecord,
  },
}));

describe('authService.changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auditRecord.mockResolvedValue(undefined);
  });

  it('fails if user does not exist or has no passwordHash', async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(
      authService.changePassword('user-1', 'oldPass123', 'newPass456')
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Tài khoản không tồn tại hoặc đã bị khóa',
    });
  });

  it('fails if current password does not match passwordHash', async () => {
    const hashedOld = await bcrypt.hash('correctOldPassword', 10);
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: hashedOld,
    });

    await expect(
      authService.changePassword('user-1', 'wrongOldPassword', 'newPass456')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_CURRENT_PASSWORD',
      message: 'Mật khẩu hiện tại không chính xác',
    });
  });

  it('fails if new password is identical to current password', async () => {
    const hashedOld = await bcrypt.hash('samePassword123', 10);
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: hashedOld,
    });

    await expect(
      authService.changePassword('user-1', 'samePassword123', 'samePassword123')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'PASSWORD_UNCHANGED',
      message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại',
    });
  });

  it('successfully updates password and increments authVersion when current password matches', async () => {
    const hashedOld = await bcrypt.hash('validOldPassword', 10);
    mocks.userFindUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: hashedOld,
    });
    mocks.userUpdate.mockResolvedValue({ id: 'user-1' });

    const result = await authService.changePassword('user-1', 'validOldPassword', 'brandNewPassword999');

    expect(result).toEqual({ message: 'Đổi mật khẩu thành công' });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        authVersion: { increment: 1 },
      }),
    });
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'CHANGE_PASSWORD',
        entityType: 'USER',
        entityId: 'user-1',
      })
    );
  });
});
