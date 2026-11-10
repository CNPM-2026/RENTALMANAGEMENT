import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminService } from './admin.service';

/**
 * Test ranh giới transaction của `updateUserStatus`: khóa `users` -> đổi trạng
 * thái -> thu hồi refresh token, và audit phải ghi SAU khi transaction commit.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    user: { update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  };
  return { tx, transaction: vi.fn(), userFindUnique: vi.fn(), auditRecord: vi.fn() };
});

vi.mock('../config/db', () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock('./audit.service', () => ({ auditService: { record: mocks.auditRecord } }));
vi.mock('./notification.service', () => ({ notificationService: { createNotification: vi.fn() } }));
vi.mock('./storage.service', () => ({ storageService: { deleteImage: vi.fn(), getPrivateImageUrl: vi.fn() } }));

const sqlOf = (call: unknown[]) => String((call[0] as string[]).join('?'));

const deadlock = () =>
  new Prisma.PrismaClientKnownRequestError('deadlock detected', {
    code: 'P2034',
    clientVersion: '6.19.3',
  });

describe('admin updateUserStatus', () => {
  /** Số lần audit đã được gọi tại thời điểm transaction kết thúc (kỳ vọng 0). */
  let auditCallsAtCommit = -1;

  beforeEach(() => {
    vi.resetAllMocks();
    auditCallsAtCommit = -1;
    mocks.transaction.mockImplementation(async (arg: unknown) => {
      const result = await (arg as (tx: unknown) => unknown)(mocks.tx);
      auditCallsAtCommit = mocks.auditRecord.mock.calls.length;
      return result;
    });
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'user-2' }]);
    mocks.tx.user.update.mockResolvedValue({ id: 'user-2', email: 'u2@example.com', isActive: false });
    mocks.tx.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    mocks.auditRecord.mockResolvedValue({});
  });

  it('deactivates the user and revokes live tokens in one transaction', async () => {
    const result = await adminService.updateUserStatus('admin-1', 'user-2', false);

    expect(result).toMatchObject({ id: 'user-2', isActive: false });

    const lockSql = sqlOf(mocks.tx.$queryRaw.mock.calls[0]);
    expect(lockSql).toMatch(/FROM\s+users/i);
    expect(lockSql).toMatch(/FOR\s+UPDATE/i);
    expect(mocks.tx.$queryRaw.mock.calls[0][1]).toBe('user-2');

    expect(mocks.tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { isActive: false },
      select: { id: true, email: true, fullName: true, role: true, isActive: true },
    });
    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-2', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });

    // Thứ tự khóa toàn cục: users (khóa -> update) rồi mới refresh_tokens.
    expect(mocks.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.user.update.mock.invocationCallOrder[0],
    );
    expect(mocks.tx.user.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.refreshToken.updateMany.mock.invocationCallOrder[0],
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    // Audit chỉ ghi sau khi transaction đã commit.
    expect(auditCallsAtCommit).toBe(0);
    expect(mocks.auditRecord).toHaveBeenCalledWith({
      userId: 'admin-1',
      action: 'DEACTIVATE_USER',
      entityType: 'User',
      entityId: 'user-2',
    });
  });

  it('does not revoke refresh tokens when reactivating an account', async () => {
    mocks.tx.user.update.mockResolvedValue({ id: 'user-2', email: 'u2@example.com', isActive: true });

    await adminService.updateUserStatus('admin-1', 'user-2', true);

    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-2' }, data: { isActive: true } }),
    );
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACTIVATE_USER', entityId: 'user-2' }),
    );
  });

  it('fails closed with 404 when the user does not exist', async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);

    await expect(adminService.updateUserStatus('admin-1', 'ghost', false)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Không tìm thấy người dùng',
    });
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    expect(mocks.tx.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(mocks.auditRecord).not.toHaveBeenCalled();
  });

  it('refuses to let an admin lock their own account before any transaction', async () => {
    await expect(adminService.updateUserStatus('admin-1', 'admin-1', false)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.auditRecord).not.toHaveBeenCalled();
  });

  it('never reports success or audits when the token revocation deadlocks', async () => {
    const failure = deadlock();
    mocks.tx.refreshToken.updateMany.mockRejectedValue(failure);

    await expect(adminService.updateUserStatus('admin-1', 'user-2', false)).rejects.toBe(failure);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.auditRecord).not.toHaveBeenCalled();
  });

  it('keeps the deactivation committed when the audit write fails', async () => {
    mocks.auditRecord.mockRejectedValue(new Error('audit store down'));

    await expect(adminService.updateUserStatus('admin-1', 'user-2', false)).rejects.toThrow('audit store down');
    expect(mocks.tx.user.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
