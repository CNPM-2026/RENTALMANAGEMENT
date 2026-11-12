import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STAFF_KYC_REQUIRED,
  assertKycApproved,
  isKycApproved,
  kycStateOf,
  loadKycState,
} from './kycGate.service';

/**
 * Cổng KYC là điều kiện duy nhất quyết định thợ có được nhận/thực hiện công việc.
 * Test khoá hai tính chất quan trọng:
 *  1. FAIL CLOSED — chỉ `APPROVED` mới được coi là đã xác minh.
 *  2. Lỗi có mã máy đọc được (`STAFF_KYC_REQUIRED`) + HTTP 403 để client phân
 *     biệt "thiếu KYC" với các 403 khác (sai role, tài khoản bị khoá).
 */
const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('../config/db', () => ({
  default: { kycSubmission: { findUnique: mocks.findUnique } },
}));

describe('kycGate.isKycApproved (fail closed)', () => {
  it('chỉ APPROVED là đã xác minh', () => {
    expect(isKycApproved('APPROVED')).toBe(true);
  });

  it.each(['NONE', 'PENDING', 'REJECTED', null, undefined] as const)(
    'coi %s là CHƯA xác minh',
    (state) => {
      expect(isKycApproved(state)).toBe(false);
    },
  );
});

describe('kycGate.assertKycApproved', () => {
  it('ném 403 + mã STAFF_KYC_REQUIRED khi chưa duyệt, nêu rõ hành động bị chặn', () => {
    let caught: unknown;
    try {
      assertKycApproved('PENDING', 'nhận việc');
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      statusCode: 403,
      code: STAFF_KYC_REQUIRED,
      message: expect.stringContaining('nhận việc'),
    });
  });

  it('không ném gì khi đã duyệt', () => {
    expect(() => assertKycApproved('APPROVED', 'nhận việc')).not.toThrow();
  });
});

describe('kycGate.kycStateOf', () => {
  it('không có hồ sơ -> NONE (không phải null/undefined)', () => {
    expect(kycStateOf(null)).toBe('NONE');
    expect(kycStateOf(undefined)).toBe('NONE');
  });

  it('lấy đúng status từ quan hệ đã include', () => {
    expect(kycStateOf({ status: 'REJECTED' })).toBe('REJECTED');
  });
});

describe('kycGate.loadKycState', () => {
  beforeEach(() => vi.resetAllMocks());

  it('đọc đúng user và trả NONE khi chưa nộp', async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(loadKycState('user-1')).resolves.toBe('NONE');
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { status: true },
    });
  });

  it('trả nguyên trạng thái đã lưu', async () => {
    mocks.findUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(loadKycState('user-1')).resolves.toBe('APPROVED');
  });
});
