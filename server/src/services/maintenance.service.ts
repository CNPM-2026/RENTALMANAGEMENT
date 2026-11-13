import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { storageService } from './storage.service';
import { auditService } from './audit.service';
import { decorateEvidenceImages, EvidenceViewer } from './maintenanceEvidence.service';
import { notificationService } from './notification.service';
import type { MaintenanceTriageStatus, Prisma } from '@prisma/client';

/**
 * PHIẾU SỰ CỐ DO KHÁCH THUÊ BÁO CÁO — `/api/v1/maintenance`.
 *
 * 🆕 Batch 2 (điều chỉnh luồng): đây là ĐIỂM BẮT ĐẦU của quy trình, không phải
 * marketplace. Khách thuê báo sự cố → chủ trọ tiếp nhận (`triageStatus`) →
 * chủ trọ tạo công việc cần thợ (`maintenanceTaskService.createFromIssue`) →
 * thợ ứng tuyển → chủ trọ giao việc.
 *
 * Ranh giới bảo mật:
 * - Khách thuê chỉ tạo được sự cố cho phòng mình CÓ hợp đồng đang hoạt động;
 *   `landlordId` do server suy ra từ cơ sở, không nhận từ client.
 * - Mọi truy vấn theo id đều lọc thêm chủ sở hữu và trả 404 khi không khớp
 *   (không lộ sự tồn tại của bản ghi — chống IDOR).
 * - Ảnh sự cố do server upload, URL không bao giờ nhận từ client.
 * - 🆕 Batch 2.1 (M2): ảnh hiện trạng là BẰNG CHỨNG RIÊNG TƯ — upload bằng
 *   Cloudinary `type: authenticated`, payload chỉ chứa đường dẫn có token ngắn
 *   hạn (`maintenanceEvidence.service`), KHÔNG chứa URL công khai.
 */
const IMAGE_FOLDER = 'rental-management/maintenance-requests';

/** Ảnh sự cố: upload xong mới ghi DB; lỗi giữa chừng thì dọn asset đã lên. */
const issueImagesInput = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  const assets: string[] = [];
  try {
    for (const file of files) {
      // 🆕 Batch 2.1 (M2): asset riêng tư -> trả `public_id`, không phải URL công khai.
      assets.push(await storageService.uploadPrivateImage(file, IMAGE_FOLDER));
    }
    return assets;
  } catch (error) {
    await Promise.all(
      assets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
    );
    throw error;
  }
};

/**
 * Dự án dùng chung cho danh sách và chi tiết. `room.property` cho chủ trọ biết
 * sự cố thuộc cơ sở nào; `tasks` là công việc marketplace đã tạo TỪ sự cố này
 * (chỉ đọc, để cả hai phía thấy mối liên hệ mà không phải ghép ở client).
 */
export const issueSelect = {
  id: true,
  tenantId: true,
  landlordId: true,
  roomId: true,
  title: true,
  description: true,
  priority: true,
  category: true,
  status: true,
  triageStatus: true,
  triageNote: true,
  triageUpdatedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  room: {
    select: {
      id: true,
      roomNumber: true,
      property: { select: { id: true, name: true, address: true, ward: true, district: true, province: true } },
    },
  },
  tenant: { select: { id: true, fullName: true, avatarUrl: true } },
  /**
   * 🆕 Batch 2.1 (M2): chỉ chọn `id` — KHÔNG chọn `imageUrl`, để không có đường
   * nào trả thẳng asset (public_id/URL) ra ngoài. Đường dẫn ảnh có token do
   * `toIssuePayload` cấp.
   */
  images: { select: { id: true } },
  tasks: {
    select: { id: true, title: true, status: true, assignedStaffId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  },
} as const satisfies Prisma.MaintenanceRequestSelect;

/**
 * 🆕 Batch 2.1 (M2) — payload của sự cố: thay `imageUrl` thật bằng đường dẫn có
 * token ngắn hạn, cấp riêng cho NGƯỜI ĐANG ĐỌC (`viewer`).
 * Mọi endpoint trả sự cố đều đi qua đây, nên không còn chỗ nào trả URL công khai.
 */
const toIssuePayload = <T extends { images?: ReadonlyArray<{ id: string }> | null }>(
  viewer: EvidenceViewer,
  item: T,
) => {
  const { images, ...rest } = item;
  return { ...rest, images: decorateEvidenceImages('issue', images, viewer) };
};

type TriageStatus = MaintenanceTriageStatus;

/**
 * 🆕 Batch 2.1 (M4) — BẢNG CHUYỂN TRẠNG THÁI TIẾP NHẬN ĐƯỢC PHÉP.
 *
 * Căn cứ (không phải sở thích UI):
 * - `PENDING` = "chủ trọ chưa xem xét" (giá trị mặc định của schema). Chỉ rời
 *   khỏi đây bằng một quyết định: xem xét / yêu cầu bổ sung / từ chối.
 * - `NEEDS_INFO` và `REJECTED` là kết luận ĐANG CÓ HIỆU LỰC, kèm lý do bắt buộc
 *   (xem `maintenanceTriageSchema`). Người báo cáo đã bổ sung thông tin hoặc chủ
 *   trọ đổi quyết định thì được chuyển tiếp sang `REVIEWED`/`REJECTED`.
 * - `REVIEWED` là "đã xem xét" — chỉ được đổi khi có kết luận mới
 *   (`NEEDS_INFO`/`REJECTED`).
 * - KHÔNG có đường quay lại `PENDING`: "chưa xem xét" không thể là kết quả của
 *   một hành động đã xảy ra, và cho phép nó sẽ xoá dấu vết đã tiếp nhận.
 * - Từ `REJECTED` được đổi quyết định (`REVIEWED`/`NEEDS_INFO`): cả hai đích đều
 *   KHÔNG lặng lẽ mở lại — `NEEDS_INFO` bắt buộc có lý do mới (validation), còn
 *   `REVIEWED` xoá lý do từ chối cũ và được ghi vào `audit_logs`. `PENDING` vẫn
 *   là đích bất khả (không ai "chưa xem xét" sau khi đã từ chối).
 */
const TRIAGE_TRANSITIONS: Record<TriageStatus, readonly TriageStatus[]> = {
  PENDING: ['REVIEWED', 'NEEDS_INFO', 'REJECTED'],
  NEEDS_INFO: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['NEEDS_INFO', 'REJECTED'],
  REJECTED: ['REVIEWED', 'NEEDS_INFO'],
};

/**
 * Vòng đời xử lý ĐÃ KẾT THÚC: không nhận thêm thay đổi tiếp nhận, vì lý do
 * (`triageNote`) sẽ không còn ý nghĩa với một sự cố đã xong hoặc đã huỷ.
 */
const TERMINAL_LIFECYCLE_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

export const maintenanceService = {
  create: async (
    tenantId: string,
    data: {
      roomId: string;
      title: string;
      description: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
      category?: Prisma.MaintenanceRequestCreateInput['category'];
    },
    files: Express.Multer.File[] = [],
  ) => {
    // Hợp đồng đang hoạt động là bằng chứng DUY NHẤT cho quan hệ thuê — sự cố
    // của phòng không thuê sẽ bị chặn ở đây chứ không chỉ ở UI.
    const room = await prisma.room.findFirst({
      where: { id: data.roomId, contracts: { some: { tenantId, status: 'ACTIVE' } } },
      include: { property: { select: { landlordId: true } } },
    });
    if (!room) throw new AppError('Bạn không có hợp đồng thuê đang hoạt động ở phòng này', 403);

    const imageAssets = await issueImagesInput(files);
    try {
      const created = await prisma.maintenanceRequest.create({
        data: {
          tenantId,
          landlordId: room.property.landlordId,
          roomId: data.roomId,
          title: data.title,
          description: data.description,
          priority: data.priority ?? 'MEDIUM',
          category: data.category ?? null,
          images: imageAssets.length ? { create: imageAssets.map((imageUrl) => ({ imageUrl })) } : undefined,
        },
        select: issueSelect,
      });
      // Chủ trọ phải biết ngay có sự cố mới để tiếp nhận; lỗi thông báo không
      // được làm hỏng việc ghi phiếu sự cố đã commit.
      await notificationService
        .createNotification(
          room.property.landlordId,
          'Sự cố mới từ khách thuê',
          `${created.room?.roomNumber ? `Phòng ${created.room.roomNumber}: ` : ''}${created.title}`,
          'SYSTEM',
          created.id,
          `maintenance-issue:${created.id}:created`,
        )
        .catch(() => undefined);
      return toIssuePayload({ id: tenantId, role: 'TENANT' }, created);
    } catch (error) {
      await Promise.all(
        imageAssets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
      );
      throw error;
    }
  },

  /**
   * Danh sách sự cố trong phạm vi của người đọc. `userId` là CHỦ THỂ PHẠM VI
   * (với nhân viên chủ trọ: `landlordId` của họ) nên token ảnh cũng cấp theo
   * đúng phạm vi đó.
   */
  getMine: async (userId: string, role: string) => {
    const items = await prisma.maintenanceRequest.findMany({
      where: role === 'LANDLORD' ? { landlordId: userId } : { tenantId: userId },
      select: issueSelect,
      orderBy: { updatedAt: 'desc' },
    });
    const viewer: EvidenceViewer = { id: userId, role };
    return items.map((item) => toIssuePayload(viewer, item));
  },

  /** Chi tiết: chỉ người báo cáo hoặc chủ trọ của cơ sở (404 nếu không khớp). */
  getById: async (userId: string, role: string, id: string) => {
    const item = await prisma.maintenanceRequest.findFirst({
      where: { id, ...(role === 'LANDLORD' ? { landlordId: userId } : { tenantId: userId }) },
      select: issueSelect,
    });
    if (!item) throw new AppError('Không tìm thấy phiếu báo cáo hoặc bạn không có quyền', 404);
    return toIssuePayload({ id: userId, role }, item);
  },

  /**
   * Chủ trọ TIẾP NHẬN sự cố: đã xem xét / cần bổ sung thông tin / từ chối.
   * Không đụng tới `status` (vòng đời xử lý) — hai trục độc lập, xem chú thích
   * `MaintenanceTriageStatus` trong schema.
   *
   * 🆕 Batch 2.1 (M4) — ghi CÓ ĐIỀU KIỆN. Batch 2 đọc rồi `update` vô điều kiện,
   * nên hai PATCH song song có thể ghi đè nhau và một lần "đã xem xét" có thể
   * xoá mất lý do từ chối vừa đặt. Nay:
   * 1. `updateMany` chỉ khớp khi `triageStatus` VẪN là giá trị đã đọc
   *    (compare-and-set) và `status` vòng đời cũng không đổi;
   * 2. `count !== 1` → 409 `TRIAGE_STATE_CONFLICT` và KHÔNG ghi gì;
   * 3. `triageStatus` + `triageNote` + `triageUpdatedAt` đổi trong CÙNG một câu
   *    UPDATE nên không có trạng thái trung gian "đã xem xét nhưng còn lý do cũ".
   * 4. Chuyển trạng thái phải nằm trong `TRIAGE_TRANSITIONS`; sự cố đã
   *    `COMPLETED`/`CANCELLED` bị chặn.
   */
  triage: async (
    landlordId: string,
    id: string,
    input: { triageStatus: MaintenanceTriageStatus; triageNote?: string | null },
  ) => {
    const item = await prisma.maintenanceRequest.findFirst({
      where: { id, landlordId },
      select: { id: true, status: true, triageStatus: true, triageNote: true },
    });
    if (!item) throw new AppError('Không tìm thấy phiếu báo cáo hoặc bạn không có quyền', 404);
    if (TERMINAL_LIFECYCLE_STATUSES.has(item.status)) {
      throw new AppError(
        item.status === 'COMPLETED'
          ? 'Sự cố đã được xử lý xong nên không thể đổi trạng thái tiếp nhận'
          : 'Sự cố đã bị huỷ nên không thể đổi trạng thái tiếp nhận',
        409,
        item.status === 'COMPLETED' ? 'ISSUE_ALREADY_COMPLETED' : 'ISSUE_ALREADY_CANCELLED',
      );
    }
    /**
     * Ghi lại CÙNG trạng thái không phải là "mở lại": UI luôn hiện ba nút tiếp
     * nhận và gửi lại trạng thái hiện tại khi chủ trọ bấm lại. Trường hợp đó chỉ
     * được phép cập nhật lý do, không đụng tới bảng chuyển tiếp.
     */
    const isTransition = item.triageStatus !== input.triageStatus;
    if (isTransition && !TRIAGE_TRANSITIONS[item.triageStatus].includes(input.triageStatus)) {
      throw new AppError(
        `Không thể chuyển trạng thái tiếp nhận từ ${item.triageStatus} sang ${input.triageStatus}`,
        409,
        'TRIAGE_TRANSITION_NOT_ALLOWED',
      );
    }

    /**
     * Lý do (`triageNote`) chỉ có nghĩa khi trạng thái đang là một kết luận
     * (`NEEDS_INFO`/`REJECTED`) — validation đã bắt buộc có lý do cho hai trạng
     * thái đó. Khi chuyển sang `REVIEWED`, lý do cũ bị XOÁ (không giữ lại lý do
     * từ chối đã hết hiệu lực); lịch sử được ghi vào `audit_logs` NGAY SAU khi
     * UPDATE thành công, nên thông tin không mất khỏi hệ thống.
     */
    const nextNote = input.triageNote ?? null;
    const written = await prisma.maintenanceRequest.updateMany({
      where: { id, landlordId, triageStatus: item.triageStatus, status: item.status },
      data: {
        triageStatus: input.triageStatus,
        triageNote: nextNote,
        triageUpdatedAt: new Date(),
      },
    });
    if (written.count !== 1) {
      throw new AppError(
        'Sự cố vừa được cập nhật ở một yêu cầu khác, vui lòng tải lại',
        409,
        'TRIAGE_STATE_CONFLICT',
      );
    }

    // Nhật ký chuyển tiếp: model hiện tại chỉ có MỘT cột `triage_note`, nên đây
    // là nơi duy nhất lưu lại lý do cũ khi trạng thái bị thay thế. Lỗi ghi log
    // không được làm hỏng nghiệp vụ đã commit.
    await auditService
      .record({
        userId: landlordId,
        action: 'TRIAGE_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        entityId: id,
        metadata: {
          from: item.triageStatus,
          to: input.triageStatus,
          previousNote: item.triageNote,
          note: nextNote,
        },
      })
      .catch(() => undefined);

    const updated = await prisma.maintenanceRequest.findUniqueOrThrow({
      where: { id },
      select: issueSelect,
    });
    return toIssuePayload({ id: landlordId, role: 'LANDLORD' }, updated);
  },

  /**
   * Vòng đời xử lý do chủ trọ đặt (PENDING/IN_PROGRESS/COMPLETED/CANCELLED).
   * Giữ nguyên hành vi Batch 1/2 (Batch 3 mới siết vòng đời); chỉ bổ sung việc
   * cấp lại đường dẫn ảnh có token cho người vừa ghi.
   */
  update: async (landlordId: string, id: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') => {
    const item = await prisma.maintenanceRequest.findFirst({ where: { id, landlordId } });
    if (!item) throw new AppError('Không tìm thấy phiếu bảo trì hoặc bạn không có quyền', 404);
    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: { status, resolvedAt: status === 'COMPLETED' ? new Date() : null },
      select: issueSelect,
    });
    return toIssuePayload({ id: landlordId, role: 'LANDLORD' }, updated);
  },
};
