import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportService } from '../../src/services/report.service';

/**
 * BÁO CÁO / TRANH CHẤP (Batch 4) — Prisma mock toàn bộ.
 *
 * Bất biến: RESOLVED/REJECTED bắt buộc có `resolution`; trạng thái cuối không mở
 * lại; xử lý là CAS trên trạng thái hiện tại (hai admin chỉ một người thắng);
 * không tự khoá tài khoản bị báo cáo; bằng chứng trả về chỉ là URL có token.
 */
const mocks = vi.hoisted(() => ({
  reportFindUnique: vi.fn(),
  reportUpdateMany: vi.fn(),
  reportFindUniqueOrThrow: vi.fn(),
  taskFindUnique: vi.fn(),
  reportCreate: vi.fn(),
  notifyUsers: vi.fn(),
  audit: vi.fn(),
  mint: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    report: {
      findUnique: mocks.reportFindUnique,
      updateMany: mocks.reportUpdateMany,
      findUniqueOrThrow: mocks.reportFindUniqueOrThrow,
      create: mocks.reportCreate,
    },
    maintenanceTask: { findUnique: mocks.taskFindUnique },
  },
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { notifyUsers: mocks.notifyUsers },
}));

vi.mock('../../src/services/audit.service', () => ({
  auditService: { record: mocks.audit },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: { uploadPrivateImage: vi.fn(), deleteImage: vi.fn() },
}));

vi.mock('../../src/services/reportAttachment.service', () => ({
  mintReportAttachmentUrl: mocks.mint,
}));

const REPORT_ID = 'report-1';
const ADMIN_ID = 'admin-1';
const REPORTER_ID = 'tenant-1';

const reportRow = (overrides: Record<string, unknown> = {}) => ({
  id: REPORT_ID,
  status: 'PENDING',
  reporterId: REPORTER_ID,
  category: 'FRAUD',
  ...overrides,
});

const expectAppError = async (promise: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promise).rejects.toMatchObject({ statusCode, code });
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.reportFindUnique.mockResolvedValue(reportRow());
  mocks.reportUpdateMany.mockResolvedValue({ count: 1 });
  mocks.reportFindUniqueOrThrow.mockResolvedValue(
    reportRow({ status: 'RESOLVED', resolution: 'Đã xử lý', attachments: [{ id: 'att-1' }] }),
  );
  mocks.notifyUsers.mockResolvedValue([]);
  mocks.audit.mockResolvedValue({ id: 'audit-1' });
  mocks.mint.mockReturnValue('signed:att-1:admin');
});


describe('reportService.resolveReport — kết luận & CAS', () => {
  it('RESOLVED thiếu kết luận -> 400 DISPUTE_RESOLUTION_REQUIRED, không ghi', async () => {
    await expectAppError(
      reportService.resolveReport(ADMIN_ID, REPORT_ID, { status: 'RESOLVED', resolution: null }),
      400,
      'DISPUTE_RESOLUTION_REQUIRED',
    );
    expect(mocks.reportUpdateMany).not.toHaveBeenCalled();
  });

  it('validation: kết luận chỉ có khoảng trắng bị coi như KHÔNG nhập', async () => {
    const { reportStatusSchema } = await import('../../src/validations/resource.validation');

    expect(reportStatusSchema.safeParse({ status: 'RESOLVED', resolution: '   ' }).success).toBe(false);
    expect(reportStatusSchema.safeParse({ status: 'UNDER_REVIEW', resolution: '   ' }).success).toBe(true);
  });

  it('báo cáo đã ở trạng thái cuối -> 409 DISPUTE_ALREADY_RESOLVED (không mở lại)', async () => {
    mocks.reportFindUnique.mockResolvedValue(reportRow({ status: 'REJECTED' }));

    await expectAppError(
      reportService.resolveReport(ADMIN_ID, REPORT_ID, { status: 'UNDER_REVIEW' }),
      409,
      'DISPUTE_ALREADY_RESOLVED',
    );
    expect(mocks.reportUpdateMany).not.toHaveBeenCalled();
  });

  it('admin khác vừa xử lý (CAS count = 0) -> 409 DISPUTE_STATE_CONFLICT, không báo', async () => {
    mocks.reportUpdateMany.mockResolvedValue({ count: 0 });

    await expectAppError(
      reportService.resolveReport(ADMIN_ID, REPORT_ID, { status: 'RESOLVED', resolution: 'Xử lý xong' }),
      409,
      'DISPUTE_STATE_CONFLICT',
    );
    expect(mocks.notifyUsers).not.toHaveBeenCalled();
  });

  it('RESOLVED: CAS theo trạng thái cũ, ghi người xử lý + thời điểm, báo người gửi, ghi audit', async () => {
    const payload = await reportService.resolveReport(ADMIN_ID, REPORT_ID, {
      status: 'RESOLVED',
      resolution: 'Đã xử lý',
    });

    expect(mocks.reportUpdateMany).toHaveBeenCalledWith({
      where: { id: REPORT_ID, status: 'PENDING' },
      data: {
        status: 'RESOLVED',
        resolution: 'Đã xử lý',
        resolvedById: ADMIN_ID,
        resolvedAt: expect.any(Date),
      },
    });
    expect(mocks.notifyUsers).toHaveBeenCalledWith(
      [REPORTER_ID],
      expect.objectContaining({ type: 'DISPUTE', referenceId: REPORT_ID }),
      expect.any(Function),
    );
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: ADMIN_ID,
        action: 'DISPUTE_RESOLVED',
        entityId: REPORT_ID,
        metadata: { from: 'PENDING', to: 'RESOLVED', category: 'FRAUD' },
      }),
    );
    expect(payload.attachments).toEqual([{ id: 'att-1', url: 'signed:att-1:admin' }]);
  });

  it('UNDER_REVIEW: tiếp nhận xem xét nhưng KHÔNG ghi resolvedById/resolvedAt', async () => {
    mocks.reportFindUniqueOrThrow.mockResolvedValue(reportRow({ status: 'UNDER_REVIEW', attachments: [] }));

    await reportService.resolveReport(ADMIN_ID, REPORT_ID, { status: 'UNDER_REVIEW' });

    const data = mocks.reportUpdateMany.mock.calls[0][0].data;
    expect(data).toEqual({ status: 'UNDER_REVIEW', resolution: null });
    expect(data).not.toHaveProperty('resolvedById');
  });

  it('không đụng users.is_active — xử lý báo cáo không tự khoá tài khoản', async () => {
    await reportService.resolveReport(ADMIN_ID, REPORT_ID, { status: 'RESOLVED', resolution: 'Xong' });

    // Prisma client chỉ mock đúng các model dùng cho tranh chấp; nếu service gọi
    // `user.update` sẽ ném TypeError thay vì âm thầm khoá tài khoản.
    expect(mocks.reportUpdateMany).toHaveBeenCalledTimes(1);
  });
});

describe('reportService.createReport — quyền báo cáo công việc', () => {
  it('người ngoài công việc -> 403 DISPUTE_FORBIDDEN, không tạo báo cáo', async () => {
    mocks.taskFindUnique.mockResolvedValue({
      id: 'task-1',
      title: 'Sửa điện',
      landlordId: 'landlord-1',
      assignedStaffId: 'staff-1',
      sourceIssue: { tenantId: 'tenant-9' },
    });

    await expectAppError(
      reportService.createReport(REPORTER_ID, 'TENANT', {
        targetType: 'TASK',
        targetId: 'task-1',
        category: 'FRAUD',
        reason: 'Không đúng mô tả ban đầu',
      }),
      403,
      'DISPUTE_FORBIDDEN',
    );
    expect(mocks.reportCreate).not.toHaveBeenCalled();
  });
});
