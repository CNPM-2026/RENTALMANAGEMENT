import { describe, expect, it } from 'vitest';
import type { NextFunction } from 'express';
import { authorizeStaffOr, type AuthRequest } from '../../src/middlewares/auth.middleware';

/**
 * Tài khoản TENANT có thể đồng thời được chủ trọ cấp quyền nhân viên. Quyền
 * ROLE GỐC (đọc dữ liệu của chính mình) không được biến mất chỉ vì có
 * membership; nếu không, `/tenant/occupancy` và các màn hình `/my` trả 403.
 */
const invoke = (
  user: AuthRequest['user'],
  permission: string,
  roles: string[],
  query: Record<string, unknown> = {},
) => {
  let caught: unknown;
  const next: NextFunction = (error?: unknown) => {
    if (error) caught = error;
  };
  authorizeStaffOr(permission, ...roles)({ user, query } as AuthRequest, {} as never, next);
  return caught as { statusCode?: number } | undefined;
};

describe('authorizeStaffOr — role gốc + membership', () => {
  it('cho TENANT có membership (thiếu đúng quyền) đọc endpoint của chính mình khi có scope=tenant', () => {
    const error = invoke(
      {
        id: 'tenant-1',
        role: 'TENANT',
        landlordId: 'landlord-1',
        staffPermissions: ['MAINTENANCE'],
      } as AuthRequest['user'],
      'PROPERTIES_ROOMS',
      ['TENANT', 'LANDLORD'],
      { scope: 'tenant' },
    );

    expect(error).toBeUndefined();
  });

  it('không cho TENANT có membership mượn scope của chủ trọ trên route landlord-only', () => {
    const error = invoke(
      {
        id: 'tenant-1',
        role: 'TENANT',
        landlordId: 'landlord-1',
        staffPermissions: ['MAINTENANCE'],
      } as AuthRequest['user'],
      'PROPERTIES_ROOMS',
      ['LANDLORD'],
      { scope: 'tenant' },
    );

    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('vẫn chặn khi route không dành cho role gốc và thiếu quyền nhân viên', () => {
    const error = invoke(
      {
        id: 'tenant-1',
        role: 'TENANT',
        landlordId: 'landlord-1',
        staffPermissions: ['MAINTENANCE'],
      } as AuthRequest['user'],
      'PROPERTIES_ROOMS',
      ['LANDLORD'],
    );

    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('cho nhân viên đi qua khi có đúng quyền', () => {
    const error = invoke(
      {
        id: 'tenant-1',
        role: 'TENANT',
        landlordId: 'landlord-1',
        staffPermissions: ['PROPERTIES_ROOMS'],
      } as AuthRequest['user'],
      'PROPERTIES_ROOMS',
      ['LANDLORD'],
    );

    expect(error).toBeUndefined();
  });
});
