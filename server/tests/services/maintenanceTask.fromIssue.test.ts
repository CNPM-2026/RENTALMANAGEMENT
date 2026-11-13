import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_TASK_STATUSES, maintenanceTaskService } from '../../src/services/maintenanceTask.service';
import type { MaintenanceTaskFromIssueInput } from '../../src/validations/maintenanceTask.validation';

/**
 * 🆕 Batch 2 (điều chỉnh luồng) — chuyển SỰ CỐ của khách thuê thành công việc
 * cần thợ. Prisma được mock toàn bộ; trọng tâm là các bất biến không được phép
 * vỡ khi refactor:
 * - quyền sở hữu kiểm tra ở CẢ sự cố và cơ sở (hai nguồn phải khớp);
 * - nơi làm việc suy ra từ sự cố, client không thể gửi cơ sở/địa chỉ khác;
 * - không đăng trùng: đã có công việc OPEN/ASSIGNED thì 409, kể cả khi thua
 *   cuộc đua Serializable (P2034);
 * - ảnh của sự cố được tham chiếu sang, nhưng chỉ ảnh do request này upload mới
 *   bị dọn khi thất bại;
 * - 🆕 Batch 2.1 (L3): chỉ sự cố `PENDING`/`REVIEWED` (và vòng đời còn hiệu lực)
 *   mới được chuyển thành công việc;
 * - 🆕 Batch 2.1 (M2): ảnh mới là asset riêng tư (`uploadPrivateImage`), payload
 *   trả về không chứa `public_id` mà chỉ có đường dẫn có token.
 */
const mocks = vi.hoisted(() => {
  const tx = {
    maintenanceTask: { findFirst: vi.fn(), create: vi.fn() },
    maintenanceRequest: { update: vi.fn() },
  };
  return {
    tx,
    transaction: vi.fn(),
    issueFindFirst: vi.fn(),
    uploadPrivateImage: vi.fn(),
    deleteImage: vi.fn(),
  };
});

vi.mock('../../src/config/db', () => ({
  default: {
    $transaction: mocks.transaction,
    maintenanceRequest: { findFirst: mocks.issueFindFirst },
  },
}));

vi.mock('../../src/services/storage.service', () => ({
  storageService: {
    uploadPrivateImage: mocks.uploadPrivateImage,
    deleteImage: mocks.deleteImage,
    // `public_id` không có scheme -> asset riêng tư; URL cũ -> asset công khai.
    isPrivateRef: (ref: string) => Boolean(ref) && !ref.includes('://'),
  },
}));

const LANDLORD_ID = 'landlord-1';
const ISSUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
// Ảnh cũ (trước Batch 2.1) vẫn là URL công khai trong DB.
const ISSUE_IMAGE = 'https://cdn.example.com/rental-management/maintenance-requests/ro-ri.jpg';
// Ảnh mới (Batch 2.1): `public_id` của asset Cloudinary `type: authenticated`.
const UPLOADED_ASSET = 'rental-management/maintenance-tasks/moi';

const issueRow = (value: Record<string, unknown> = {}) => ({
  id: ISSUE_ID,
  roomId: ROOM_ID,
  title: 'Rò rỉ nước dưới chậu rửa',
  description: 'Nước rỉ ra sàn bếp từ tối qua, đã thấm sang chân tủ.',
  category: 'PLUMBING',
  priority: 'HIGH',
  status: 'PENDING',
  triageStatus: 'PENDING',
  images: [{ imageUrl: ISSUE_IMAGE }],
  room: {
    roomNumber: 'P101',
    property: {
      id: PROPERTY_ID,
      landlordId: LANDLORD_ID,
      name: 'Nhà trọ Hoa Sen',
      address: '12 Nguyễn Trãi',
      ward: 'Thanh Xuân Trung',
      district: 'Thanh Xuân',
      province: 'Hà Nội',
      latitude: 21.0012,
      longitude: 105.8012,
    },
  },
  ...value,
});

const input = (value: Record<string, unknown> = {}) => value as MaintenanceTaskFromIssueInput;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(mocks.tx),
  );
  mocks.issueFindFirst.mockResolvedValue(issueRow());
  mocks.uploadPrivateImage.mockResolvedValue(UPLOADED_ASSET);
  // `deleteImage` phải trả Promise: service dùng `.catch()` để dọn ảnh đã upload.
  mocks.deleteImage.mockResolvedValue(undefined);
  mocks.tx.maintenanceTask.findFirst.mockResolvedValue(null);
  mocks.tx.maintenanceTask.create.mockResolvedValue({ id: 'task-1', status: 'OPEN' });
  mocks.tx.maintenanceRequest.update.mockResolvedValue({ id: ISSUE_ID });
});

describe('maintenanceTaskService.createFromIssue — quyền sở hữu', () => {
  it('404 khi sự cố không tồn tại hoặc không thuộc chủ trọ (truy vấn kèm landlordId)', async () => {
    mocks.issueFindFirst.mockResolvedValue(null);

    await expect(
      maintenanceTaskService.createFromIssue('landlord-2', ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mocks.issueFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ISSUE_ID, landlordId: 'landlord-2' } }),
    );
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });

  it('404 khi chủ sở hữu cơ sở khác chủ sở hữu sự cố (dữ liệu lệch nhau)', async () => {
    mocks.issueFindFirst.mockResolvedValue(
      issueRow({ room: { roomNumber: 'P101', property: { id: PROPERTY_ID, landlordId: 'landlord-9' } } }),
    );

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });
});

describe('maintenanceTaskService.createFromIssue — trạng thái sự cố', () => {
  it('409 khi sự cố đã bị từ chối', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'REJECTED' }));

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_REJECTED' });
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });

  it('409 khi sự cố đã bị huỷ', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ status: 'CANCELLED' }));

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_CANCELLED' });
  });

  // 🆕 Batch 2.1 (L3)
  it('409 khi sự cố đang chờ khách thuê bổ sung thông tin (NEEDS_INFO)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'NEEDS_INFO' }));

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_NEEDS_INFO' });
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });

  it('409 khi sự cố đã được xử lý xong (COMPLETED)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ status: 'COMPLETED' }));

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_ALREADY_COMPLETED' });
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
  });
});

describe('maintenanceTaskService.createFromIssue — chống đăng trùng', () => {
  it('409 ISSUE_ALREADY_HAS_TASK khi sự cố đã có công việc đang hoạt động', async () => {
    mocks.tx.maintenanceTask.findFirst.mockResolvedValue({ id: 'task-existing' });

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_ALREADY_HAS_TASK' });

    expect(mocks.tx.maintenanceTask.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceIssueId: ISSUE_ID, status: { in: ACTIVE_TASK_STATUSES } },
      }),
    );
    // 🆕 Batch 3: "đang hoạt động" phải phủ cả lúc thợ đang làm/chờ nghiệm thu,
    // nếu không thì vừa bấm "Bắt đầu" là chủ trọ tạo được công việc thứ hai.
    expect(ACTIVE_TASK_STATUSES).toEqual(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED']);
    expect(mocks.tx.maintenanceTask.create).not.toHaveBeenCalled();
    expect(mocks.tx.maintenanceRequest.update).not.toHaveBeenCalled();
  });

  it('thua cuộc đua Serializable (P2034) được dịch thành 409 và chỉ dọn ảnh vừa upload', async () => {
    mocks.tx.maintenanceTask.create.mockRejectedValue({ code: 'P2034' });

    await expect(
      maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), [
        { originalname: 'moi.jpg' } as Express.Multer.File,
      ]),
    ).rejects.toMatchObject({ statusCode: 409, code: 'ISSUE_ALREADY_HAS_TASK' });

    expect(mocks.deleteImage).toHaveBeenCalledWith(UPLOADED_ASSET, 'authenticated');
    // Ảnh của sự cố là bằng chứng dùng chung: không được xoá vì lỗi của công việc.
    expect(mocks.deleteImage).not.toHaveBeenCalledWith(ISSUE_IMAGE, 'upload');
  });

  /**
   * 🆕 Batch 2.2 (M3) + Batch 3 — lịch sử CANCELLED/COMPLETED KHÔNG được chặn
   * việc đăng lại.
   *
   * Ràng buộc ở DB là partial unique index
   *   `UNIQUE (source_issue_id) WHERE status IN ('OPEN','ASSIGNED','IN_PROGRESS','SUBMITTED')`
   * nên hàng CANCELLED/COMPLETED không bao giờ chen vào. Test này giữ cho truy
   * vấn tầng ứng dụng và predicate của index luôn nói cùng một ngôn ngữ: nếu ai
   * đó thêm CANCELLED/COMPLETED vào truy vấn chống trùng (hoặc bỏ lọc trạng
   * thái), lịch sử sẽ khoá luôn khả năng đăng lại và test đỏ ngay.
   */
  it('cho phép đăng lại sau khi công việc trước đã CANCELLED (lịch sử không chặn)', async () => {
    mocks.tx.maintenanceTask.findFirst.mockResolvedValue(null);

    await maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []);

    expect(mocks.tx.maintenanceTask.findFirst).toHaveBeenCalledTimes(1);
    const query = mocks.tx.maintenanceTask.findFirst.mock.calls[0][0] as {
      where: { sourceIssueId: string; status: { in: string[] } };
    };
    expect(query.where.sourceIssueId).toBe(ISSUE_ID);
    expect(query.where.status.in).toEqual(ACTIVE_TASK_STATUSES);
    expect(query.where.status.in).not.toContain('CANCELLED');
    expect(query.where.status.in).not.toContain('COMPLETED');
    expect(mocks.tx.maintenanceTask.create).toHaveBeenCalledTimes(1);
  });
});

describe('maintenanceTaskService.createFromIssue — prefill & liên kết', () => {
  it('lấy nơi làm việc/tiêu đề/mô tả/danh mục/khẩn cấp từ sự cố và ghi nhận đã xem xét', async () => {
    await maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), [
      { originalname: 'moi.jpg' } as Express.Multer.File,
    ]);

    expect(mocks.tx.maintenanceTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          landlordId: LANDLORD_ID,
          propertyId: PROPERTY_ID,
          roomId: ROOM_ID,
          sourceIssueId: ISSUE_ID,
          title: 'Rò rỉ nước dưới chậu rửa',
          category: 'PLUMBING',
          urgency: 'HIGH',
          address: 'Phòng P101, Nhà trọ Hoa Sen, 12 Nguyễn Trãi, Thanh Xuân Trung, Thanh Xuân, Hà Nội',
          latitude: 21.0012,
          longitude: 105.8012,
          // Ảnh sự cố đứng trước, ảnh chủ trọ thêm sau.
          images: { create: [{ imageUrl: ISSUE_IMAGE }, { imageUrl: UPLOADED_ASSET }] },
        }),
      }),
    );
    expect(mocks.tx.maintenanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ISSUE_ID },
        // 🆕 Batch 2.1 (L3): không giữ lại lý do cũ khi chuyển sang REVIEWED.
        data: expect.objectContaining({ triageStatus: 'REVIEWED', triageNote: null }),
      }),
    );
    // Cô lập Serializable là điều kiện để hai request đồng thời không cùng tạo.
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('tôn trọng phần chủ trọ sửa và dedupe ảnh trùng URL', async () => {
    mocks.uploadPrivateImage.mockResolvedValue(ISSUE_IMAGE);

    await maintenanceTaskService.createFromIssue(
      LANDLORD_ID,
      ISSUE_ID,
      input({ title: 'Thay vòi nước bếp', urgency: 'LOW', budgetMin: 200000, skills: ['PLUMBING'] }),
      [{ originalname: 'trung.jpg' } as Express.Multer.File],
    );

    const created = mocks.tx.maintenanceTask.create.mock.calls[0][0];
    expect(created.data.title).toBe('Thay vòi nước bếp');
    expect(created.data.urgency).toBe('LOW');
    expect(created.data.budgetMin).toBe(200000);
    expect(created.data.skills).toEqual({ create: [{ category: 'PLUMBING' }] });
    expect(created.data.images).toEqual({ create: [{ imageUrl: ISSUE_IMAGE }] });
  });
});


describe('maintenanceTaskService.createFromIssue — 🆕 Batch 2.1', () => {
  it('không trả URL/public_id thật: payload chỉ có đường dẫn ảnh kèm token (M2)', async () => {
    mocks.tx.maintenanceTask.create.mockResolvedValue({
      id: 'task-1',
      status: 'OPEN',
      images: [{ id: 'img-1' }],
    });

    const created = await maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []);

    // Không có asset nào bị lộ ra payload.
    expect(JSON.stringify(created)).not.toContain(UPLOADED_ASSET);
    expect(JSON.stringify(created)).not.toContain('res.cloudinary.com');
    expect(created.images).toEqual([
      { id: 'img-1', imageUrl: expect.stringMatching(/^\/api\/v1\/maintenance-images\/task\/img-1\?token=/) },
    ]);
  });

  it('không ghi lại trạng thái tiếp nhận khi sự cố đã REVIEWED (L3)', async () => {
    mocks.issueFindFirst.mockResolvedValue(issueRow({ triageStatus: 'REVIEWED' }));

    await maintenanceTaskService.createFromIssue(LANDLORD_ID, ISSUE_ID, input(), []);

    expect(mocks.tx.maintenanceTask.create).toHaveBeenCalled();
    expect(mocks.tx.maintenanceRequest.update).not.toHaveBeenCalled();
  });
});

