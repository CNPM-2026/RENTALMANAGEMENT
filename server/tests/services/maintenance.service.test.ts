import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenanceService } from '../../src/services/maintenance.service';

/**
 * 🆕 Batch 2.1 (M4 + M2) — TIẾP NHẬN SỰ CỐ.
 *
 * Batch 2 đọc trạng thái rồi `update` vô điều kiện: hai PATCH song song ghi đè
 * nhau và một lần "Đã xem xét" có thể xoá lý do từ chối vừa đặt. Các test dưới
 * đây khoá lại:
 * - bảng chuyển trạng thái tường minh (không mở lại sự cố đã từ chối một cách
 *   âm thầm, không quay về PENDING);
 * - ghi có điều kiện (`updateMany` + compare-and-set) và 409 khi thua;
 * - `triageStatus`/`triageNote`/`triageUpdatedAt` đổi trong một câu UPDATE;
 * - payload sự cố chỉ chứa đường dẫn ảnh có token (M2).
 */
const mocks = vi.hoisted(() => ({
  issueFindFirst: vi.fn(),
  issueCreate: vi.fn(),
  issueUpdate: vi.fn(),
  issueUpdateMany: vi.fn(),
  issueFindUniqueOrThrow: vi.fn(),
  roomFindFirst: vi.fn(),
  auditRecord: vi.fn(),
  uploadPrivateImage: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    maintenanceRequest: {
      findFirst: mocks.issueFindFirst,
      create: mocks.issueCreate,
      update: mocks.issueUpdate,
      updateMany: mocks.issueUpdateMany,
      findUniqueOrThrow: mocks.issueFindUniqueOrThrow,
      findMany: vi.fn(),
    },
    room: { findFirst: mocks.roomFindFirst },
  },
}));

vi.mock('../../src/services/audit.service', () => ({ auditService: { record: mocks.auditRecord } }));

vi.mock('../../src/config/env', () => ({
  env: { JWT_SECRET: 'test-secret-for-evidence-tokens-32-chars-min' },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    uploadPrivateImage: mocks.uploadPrivateImage,
    deleteImage: mocks.deleteImage,
    isPrivateRef: (ref: string) => Boolean(ref) && !ref.includes('://'),
  },
}));

const ISSUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LANDLORD_ID = 'landlord-1';
const PRIVATE_REF = 'rental-management/maintenance-requests/abc123';

const issueRow = (value: Record<string, unknown> = {}) => ({
  id: ISSUE_ID,
  status: 'PENDING',
  triageStatus: 'PENDING',
  triageNote: null,
  ...value,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.issueFindFirst.mockResolvedValue(issueRow());
  mocks.issueUpdateMany.mockResolvedValue({ count: 1 });
  mocks.issueFindUniqueOrThrow.mockResolvedValue({
    id: ISSUE_ID,
    triageStatus: 'REVIEWED',
    triageNote: null,
    images: [{ id: 'img-1' }],
  });
  mocks.auditRecord.mockResolvedValue({ id: 'audit-1' });
  mocks.uploadPrivateImage.mockResolvedValue(PRIVATE_REF);
  mocks.deleteImage.mockResolvedValue(undefined);
});

describe('maintenanceService.triage — chuyển trạng thái hợp lệ', () => {
  it('PENDING -> REVIEWED: ghi có điều kiện, xoá lý do cũ, ghi audit', async () => {
    const result = await maintenanceService.triage(LANDLORD_ID, ISSUE_ID, { triageStatus: 'REVIEWED' });

    expect(mocks.issueUpdateMany).toHaveBeenCalledWith({
      // Compare-and-set: chỉ ghi khi trạng thái VẪN như đã đọc (và vòng đời không đổi).
      where: { id: ISSUE_ID, landlordId: LANDLORD_ID, triageStatus: 'PENDING', status: 'PENDING' },
      data: {
        triageStatus: 'REVIEWED',
        triageNote: null,
        triageUpdatedAt: expect.any(Date),
      },
    });
    expect(mocks.issueUpdate).not.toHaveBeenCalled();
    expect(mocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRIAGE_MAINTENANCE_REQUEST',
        entityId: ISSUE_ID,
        metadata: expect.objectContaining({ from: 'PENDING', to: 'REVIEWED' }),
      }),
    );
    expect(result.images).toEqual([
      { id: 'img-1', imageUrl: expect.stringMatching(/^\/api\/v1\/maintenance-images\/issue\/img-1\?token=/) },
    ]);
  });

  it('REVIEWED -> REJECTED lưu lý do bắt buộc', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'REVIEWED' }));

    await maintenanceService.triage(LANDLORD_ID, ISSUE_ID, {
      triageStatus: 'REJECTED',
      triageNote: 'Không thuộc phạm vi bảo trì của nhà trọ',
    });

    expect(mocks.issueUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ISSUE_ID, landlordId: LANDLORD_ID, triageStatus: 'REVIEWED', status: 'PENDING' },
        data: expect.objectContaining({
          triageStatus: 'REJECTED',
          triageNote: 'Không thuộc phạm vi bảo trì của nhà trọ',
        }),
      }),
    );
  });

  it('bấm lại cùng một trạng thái chỉ cập nhật lý do (không phải "mở lại")', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'REVIEWED' }));

    await maintenanceService.triage(LANDLORD_ID, ISSUE_ID, { triageStatus: 'REVIEWED' });

    expect(mocks.issueUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ triageStatus: 'REVIEWED' }) }),
    );
  });
});

describe('maintenanceService.triage — từ chối chuyển trạng thái sai', () => {
  it('không cho quay lại PENDING (không xoá dấu vết đã tiếp nhận)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'NEEDS_INFO' }));

    await expect(
      maintenanceService.triage(LANDLORD_ID, ISSUE_ID, { triageStatus: 'PENDING' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TRIAGE_TRANSITION_NOT_ALLOWED' });
    expect(mocks.issueUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditRecord).not.toHaveBeenCalled();
  });

  it('chặn tiếp nhận trên sự cố đã xử lý xong (COMPLETED)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ status: 'COMPLETED' }));

    await expect(
      maintenanceService.triage(LANDLORD_ID, ISSUE_ID, { triageStatus: 'REVIEWED' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_ALREADY_COMPLETED' });
    expect(mocks.issueUpdateMany).not.toHaveBeenCalled();
  });

  it('chặn tiếp nhận trên sự cố đã huỷ (CANCELLED)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ status: 'CANCELLED' }));

    await expect(
      maintenanceService.triage(LANDLORD_ID, ISSUE_ID, { triageStatus: 'REVIEWED' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_ALREADY_CANCELLED' });
    expect(mocks.issueUpdateMany).not.toHaveBeenCalled();
  });

  it('chủ trọ khác không thấy sự cố (404, không lộ sự tồn tại)', async () => {
    mocks.issueFindFirst.mockResolvedValue(null);

    await expect(
      maintenanceService.triage('landlord-2', ISSUE_ID, { triageStatus: 'REVIEWED' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.issueFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ISSUE_ID, landlordId: 'landlord-2' } }),
    );
  });

  it('thua cuộc đua PATCH song song: 409 TRIAGE_STATE_CONFLICT và không ghi audit', async () => {
    mocks.issueUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      maintenanceService.triage(LANDLORD_ID, ISSUE_ID, {
        triageStatus: 'REJECTED',
        triageNote: 'Không đúng phạm vi bảo trì',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'TRIAGE_STATE_CONFLICT' });
    expect(mocks.auditRecord).not.toHaveBeenCalled();
    expect(mocks.issueFindUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('maintenanceService — M2 payload ảnh', () => {
  it('create trả đường dẫn có token, không trả public_id/URL Cloudinary', async () => {
    mocks.roomFindFirst.mockResolvedValue({ id: 'room-1', property: { landlordId: LANDLORD_ID } });
    mocks.issueCreate.mockResolvedValue({
      id: ISSUE_ID,
      title: 'Rò rỉ nước',
      images: [{ id: 'img-1' }],
    });

    const created = await maintenanceService.create(
      'tenant-1',
      { roomId: 'room-1', title: 'Rò rỉ nước', description: 'Nước rỉ dưới chậu rửa bếp' },
      [{ originalname: 'anh.jpg' } as Express.Multer.File],
    );

    // Asset riêng tư: upload trả `public_id`, và payload không chứa nó.
    expect(mocks.uploadPrivateImage).toHaveBeenCalledWith(
      expect.anything(),
      'rental-management/maintenance-requests',
    );
    expect(JSON.stringify(created)).not.toContain(PRIVATE_REF);
    expect(created.images[0].imageUrl).toMatch(/^\/api\/v1\/maintenance-images\/issue\/img-1\?token=/);
  });
});
