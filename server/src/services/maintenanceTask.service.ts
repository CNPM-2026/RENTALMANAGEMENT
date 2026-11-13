import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import type { MaintenanceTaskStatus, Prisma } from '@prisma/client';
import { storageService } from './storage.service';
import { decorateEvidenceImages, EvidenceViewer } from './maintenanceEvidence.service';
import { notificationService } from './notification.service';
import { kycStateOf } from './kycGate.service';
import { boundingBox, haversineDistanceKm, longitudeRanges, roundDistanceKm, toCoordinates } from '../utils/geo';
import type {
  MaintenanceTaskBrowseQuery,
  MaintenanceTaskFromIssueInput,
  MaintenanceTaskUpdateInput,
} from '../validations/maintenanceTask.validation';

/**
 * MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2) — phần "công việc".
 *
 * Ranh giới bảo mật:
 * - Quyền sở hữu được kiểm tra bằng `property.landlord_id` (nguồn sự thật duy
 *   nhất), không tin `propertyId` do client gửi: một chủ trọ không thể đăng việc
 *   lên cơ sở của người khác, và `roomId` phải thuộc đúng cơ sở đó.
 * - Mọi truy vấn theo id đều lọc thêm chủ sở hữu hoặc trả 404 (không lộ sự tồn
 *   tại của bản ghi — chống IDOR/dò id).
 * - Payload danh sách KHÔNG chứa toạ độ chính xác; toạ độ chỉ dùng server-side
 *   để tính khoảng cách (và chỉ trả về ở chi tiết công việc mà người xem đã có
 *   quyền đọc).
 */

const MAX_DISTANCE_CANDIDATES = 500;
const IMAGE_FOLDER = 'rental-management/maintenance-tasks';

/**
 * 🆕 Batch 3 — trạng thái "công việc còn đang chạy" của một sự cố.
 *
 * Đây là nguồn sự thật duy nhất cho hai chỗ phải khớp nhau:
 * 1. `createFromIssue` (chặn đăng trùng công việc cho cùng một sự cố);
 * 2. predicate của partial unique index `maintenance_tasks_one_active_per_issue`
 *    ở DB (`prisma/sql/batch-3-staff-completion-lifecycle.sql`).
 *
 * `COMPLETED`/`CANCELLED` KHÔNG nằm trong danh sách: sự cố đã xong/huỷ thì được
 * phép mở công việc mới (ví dụ hỏng lại sau khi đã sửa xong).
 */
export const ACTIVE_TASK_STATUSES: MaintenanceTaskStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
];

/**
 * 🆕 Batch 3 — thứ tự hiển thị của trạng thái, tính ở APPLICATION.
 *
 * Không dùng `ORDER BY status` ở SQL: PostgreSQL luôn thêm nhãn enum mới vào
 * CUỐI kiểu, nên thứ tự vật lý (OPEN, ASSIGNED, CANCELLED, IN_PROGRESS, …)
 * không phải thứ tự nghiệp vụ (CANCELLED sẽ chen giữa các việc đang chạy).
 * Danh sách công việc của một chủ trọ không phân trang, nên sắp xếp trong bộ
 * nhớ là an toàn và không phụ thuộc thứ tự enum của DB.
 */
export const TASK_STATUS_ORDER: Record<MaintenanceTaskStatus, number> = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  SUBMITTED: 3,
  COMPLETED: 4,
  CANCELLED: 5,
};

/**
 * 🆕 Batch 2.1 (M2) — ảnh do marketplace tải lên là asset RIÊNG TƯ
 * (Cloudinary `type: authenticated`), nên giá trị lưu trong
 * `maintenance_task_images.image_url` là `public_id`, không phải URL công khai.
 * Client chỉ nhận đường dẫn có token do `maintenanceEvidence.service` cấp.
 */
const taskImagesInput = async (files: Express.Multer.File[]) => {
  if (!files.length) return [];
  const assets: string[] = [];
  try {
    for (const file of files) {
      assets.push(await storageService.uploadPrivateImage(file, IMAGE_FOLDER));
    }
    return assets;
  } catch (error) {
    // Upload là tác vụ ngoài DB: dọn ảnh đã lên để không để lại rác Cloudinary
    // khi một file giữa chừng thất bại.
    await Promise.all(
      assets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
    );
    throw error;
  }
};

/**
 * 🆕 Batch 2 (điều chỉnh luồng) — chỉ asset do CHÍNH marketplace tải lên mới
 * được phép xoá. Công việc tạo từ sự cố có tham chiếu tới ảnh của sự cố (thư
 * mục `maintenance-requests`); nếu xoá theo URL thì một lần sửa công việc sẽ
 * xoá mất bằng chứng mà khách thuê đã gửi.
 *
 * 🆕 Batch 2.1: so khớp cả `public_id` (dữ liệu mới, không có scheme) lẫn URL
 * Cloudinary cũ — nên chỉ cần kiểm tra tiền tố thư mục, không cần scheme.
 */
const isTaskOwnedAsset = (ref: string) => ref.includes(`${IMAGE_FOLDER}/`);

/** Xoá đúng loại asset: `authenticated` cho dữ liệu mới, `upload` cho dữ liệu cũ. */
const deleteTaskAsset = (ref: string) =>
  storageService.deleteImage(ref, storageService.isPrivateRef(ref) ? 'authenticated' : 'upload');

/**
 * 🆕 Batch 2.1 (M2) — payload công việc: bỏ `imageUrl` thật, chỉ trả đường dẫn
 * có token ngắn hạn cấp riêng cho người đang đọc.
 *
 * 🆕 Batch 3 — TÁCH ảnh theo `kind`:
 * - `images`: ảnh HIỆN TRẠNG (chủ trọ tải lúc đăng việc; `kind = TASK`).
 * - `completionImages`: bằng chứng NGHIỆM THU (thợ tải khi hoàn thành;
 *   `kind = COMPLETION`).
 * Hai danh sách tách nhau để một lần "yêu cầu làm lại" + nộp lại không bao giờ
 * trộn lẫn ảnh trước/sau, và UI không phải đoán ý nghĩa của từng ảnh. Bản ghi
 * cũ không có `kind` được coi là ảnh hiện trạng (mặc định của cột).
 *
 * Export để lớp đơn ứng tuyển (`accept`) cấp token cho chủ trọ vừa giao việc.
 */
export const toTaskPayload = <
  T extends { images?: ReadonlyArray<{ id: string; kind?: string | null }> | null },
>(
  viewer: EvidenceViewer,
  task: T,
) => {
  const { images, ...rest } = task;
  const rows = Array.isArray(images) ? images : [];
  return {
    ...rest,
    images: decorateEvidenceImages(
      'task',
      rows.filter((image) => image.kind !== 'COMPLETION'),
      viewer,
    ),
    completionImages: decorateEvidenceImages(
      'task',
      rows.filter((image) => image.kind === 'COMPLETION'),
      viewer,
    ),
  };
};


/**
 * Địa chỉ NƠI LÀM VIỆC suy ra từ cơ sở của sự cố (không nhận từ client) để
 * không thể đăng việc ở địa chỉ khác nơi khách thuê báo sự cố.
 */
const workplaceAddress = (
  property: { name: string; address: string; ward: string; district: string; province: string },
  roomNumber?: string | null,
) =>
  [
    roomNumber ? `Phòng ${roomNumber}` : null,
    property.name,
    property.address,
    property.ward,
    property.district,
    property.province,
  ]
    .filter(Boolean)
    .join(', ');


/**
 * Dự án công việc cho danh sách (không có toạ độ, không có đơn ứng tuyển).
 *
 * 🆕 Batch 2.1 (M2): KHÔNG có `images` (và càng không có `imageUrl`). Danh sách
 * marketplace và danh sách đơn của thợ không phải là nơi cấp quyền xem bằng
 * chứng; endpoint nào cần ảnh thì tự chọn `images: { select: { id: true } }`
 * rồi đi qua `toTaskPayload` để nhận đường dẫn có token.
 */
export const taskSummarySelect = {
  id: true,
  landlordId: true,
  propertyId: true,
  roomId: true,
  title: true,
  description: true,
  category: true,
  address: true,
  budgetMin: true,
  budgetMax: true,
  urgency: true,
  preferredStartAt: true,
  preferredEndAt: true,
  additionalInstructions: true,
  status: true,
  assignedStaffId: true,
  assignedApplicationId: true,
  assignedAt: true,
  // 🆕 Batch 3 — trạng thái thương lượng giá. Trả cho CẢ HAI bên tham gia (chủ
  // trọ và thợ được giao) vì cả hai đều là chủ thể của thoả thuận.
  agreedAmount: true,
  agreedAt: true,
  negotiationVersion: true,
  // 🆕 Batch 3 — dấu vết thực thi & nghiệm thu. Nằm trong projection DÙNG CHUNG
  // nên mọi payload (danh sách chủ trọ, danh sách việc của thợ, chi tiết) đều
  // nhất quán; công việc còn `OPEN` chỉ đơn giản là có các cột này = null.
  startedAt: true,
  completionSubmittedAt: true,
  completionNote: true,
  completionReviewedAt: true,
  completionReviewNote: true,
  completionAttempts: true,
  // Sự cố gốc (nếu có) — cho phép UI chỉ rõ "việc này từ báo cáo của khách thuê".
  sourceIssueId: true,
  createdAt: true,
  updatedAt: true,
  property: { select: { id: true, name: true, address: true, province: true, district: true, ward: true } },
  room: { select: { id: true, roomNumber: true } },
  skills: { select: { category: true } },
} as const;

/**
 * Chi tiết công việc: thêm toạ độ nơi làm việc (đã qua kiểm tra quyền đọc) và
 * ID ảnh — ID không phải là quyền truy cập, đường dẫn thật do `toTaskPayload`
 * cấp kèm token.
 */
export const taskDetailSelect = {
  ...taskSummarySelect,
  latitude: true,
  longitude: true,
  // 🆕 Batch 3: cần `kind` để `toTaskPayload` tách ảnh hiện trạng khỏi ảnh
  // bằng chứng nghiệm thu.
  images: { select: { id: true, kind: true } },
} as const;

/**
 * Đơn ứng tuyển kèm hồ sơ thợ — chỉ dùng cho CHỦ TRỌ của công việc và admin.
 * Không chứa toạ độ của thợ: khoảng cách của thợ là thông tin riêng (Batch 1 đã
 * cố tình giấu `latitude`/`longitude` khỏi mọi payload công khai).
 */
export const applicantSelect = {
  id: true,
  taskId: true,
  staffId: true,
  message: true,
  proposedAmount: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  staff: {
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      phone: true,
      kycSubmission: { select: { status: true } },
      staffProfile: {
        select: {
          description: true,
          serviceAddress: true,
          priceMin: true,
          priceMax: true,
          isAvailable: true,
          skills: { select: { category: true } },
        },
      },
    },
  },
} as const;

/** Đơn của CHÍNH thợ đang xem: không lặp lại dữ liệu người khác. */
export const ownApplicationSelect = {
  id: true,
  taskId: true,
  staffId: true,
  message: true,
  proposedAmount: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * 🆕 Batch 2.1 (L3) — SỰ CỐ ĐƯỢC PHÉP CHUYỂN THÀNH CÔNG VIỆC.
 *
 * Trước Batch 2.1 chỉ chặn REJECTED/CANCELLED, nên một sự cố `NEEDS_INFO` (khách
 * thuê chưa bổ sung thông tin) hoặc `COMPLETED` vẫn tạo được việc cho thợ — thợ
 * đến nơi mà không có thông tin/không còn gì để sửa.
 *
 * Quy tắc (bám theo chính bảng `TRIAGE_TRANSITIONS` của `maintenance.service`):
 * - `PENDING` (chưa tiếp nhận) → ĐƯỢC phép: việc chủ trọ tạo công việc từ báo
 *   cáo chính là hành động "đã xem xét", và nó được ghi nhận trong cùng
 *   transaction (`PENDING → REVIEWED`). Đây là đường đi bình thường của UI.
 * - `REVIEWED` → ĐƯỢC phép.
 * - `NEEDS_INFO` → KHÔNG: đang chờ khách thuê bổ sung; chủ trọ phải tiếp nhận
 *   lại (`NEEDS_INFO → REVIEWED` qua `PATCH /maintenance/:id/triage`) trước.
 * - `REJECTED` → KHÔNG (bất biến của Batch 2 được giữ nguyên).
 */
const CAN_CONVERT_TRIAGE_STATES = new Set(['PENDING', 'REVIEWED']);

/**
 * 🆕 Batch 2.1 (L3) — vòng đời còn hiệu lực. `COMPLETED` (đã xử lý xong) và
 * `CANCELLED` (đã huỷ) không được sinh ra công việc mới.
 */
const CONVERTIBLE_LIFECYCLE_STATES = new Set(['PENDING', 'IN_PROGRESS']);

const DEFAULT_PAGE_SIZE = 20;

const normalizePagination = (page?: number, limit?: number) => {
  const safePage = Number.isInteger(page) && (page as number) > 0 ? (page as number) : 1;
  const safeLimit = Number.isInteger(limit) && (limit as number) > 0 ? Math.min(limit as number, 50) : DEFAULT_PAGE_SIZE;
  return { page: safePage, limit: safeLimit };
};


/** Thứ tự xác định — không bao giờ phụ thuộc thứ tự ngẫu nhiên của DB. */
const orderByFor = (sort?: string): Prisma.MaintenanceTaskOrderByWithRelationInput[] =>
  sort === 'urgency'
    ? [{ urgency: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]
    : [{ createdAt: 'desc' }, { id: 'asc' }];

/**
 * Điều kiện khoảng cách ở TẦNG SQL (bounding box) — nhờ vậy không phải nạp cả
 * bảng vào bộ nhớ. Khoảng cách chính xác vẫn tính bằng Haversine sau đó, và
 * bản ghi thiếu toạ độ bị loại (`not: null`): không thể chứng minh nó nằm trong
 * bán kính nên không được đưa vào kết quả "gần đây".
 */
const geoWhere = (
  center: { latitude: number; longitude: number },
  radiusKm: number,
): Prisma.MaintenanceTaskWhereInput[] => {
  const box = boundingBox(center, radiusKm);
  if (!box) return [];
  return [
    { latitude: { not: null, gte: box.minLatitude, lte: box.maxLatitude } },
    {
      OR: longitudeRanges(box).map((range) => ({
        longitude: { not: null, gte: range.min, lte: range.max },
      })),
    },
  ];
};

/** Bỏ toạ độ khỏi payload và gắn khoảng cách đã tính (không bịa khi thiếu). */
const toBrowseItem = <
  T extends {
    latitude: number | null;
    longitude: number | null;
    applications: Array<{ id: string; status: string }>;
    _count?: { images: number };
  },
>(
  row: T,
  distanceKm: number | null,
) => {
  const { latitude: _latitude, longitude: _longitude, applications, _count, ...rest } = row;
  return {
    ...rest,
    // Chỉ số lượng ảnh, không có URL: xem `browseOpen` (M2).
    imageCount: _count?.images ?? 0,
    distanceKm: roundDistanceKm(distanceKm),
    myApplication: applications[0] ?? null,
  };
};

export const maintenanceTaskService = {
  /**
   * 🆕 Batch 2 (điều chỉnh luồng, Variant B) — ĐƯỜNG DUY NHẤT tạo công việc:
   * chủ trọ chuyển MỘT SỰ CỐ của khách thuê thành công việc cần thợ.
   *
   * Không còn hàm tạo tự do (`POST /maintenance-tasks` đã bị gỡ) vì mọi công việc
   * phải có `sourceIssueId`: đó là bất biến dữ liệu, không phải quy ước UI.
   *
   * Bất biến:
   * - Quyền: sự cố phải thuộc chủ trọ VÀ cơ sở của phòng phải thuộc chính chủ trọ
   *   đó (hai nguồn phải khớp; lệch thì 404, không đoán).
   * - Nơi làm việc (cơ sở/phòng/địa chỉ/toạ độ) suy ra từ sự cố, không nhận từ
   *   client — không thể đăng việc ở nơi khác chỗ khách thuê báo.
   * - Không đăng trùng: một sự cố chỉ có tối đa MỘT công việc đang mở/đã giao.
   *   Kiểm tra nằm trong transaction Serializable nên hai request đồng thời cũng
   *   không thể cùng tạo (request thua cuộc nhận 409 `P2034`).
   * - Tiếp nhận sự cố (`triageStatus = REVIEWED`) ghi trong CÙNG transaction.
   * - Ảnh của sự cố được THAM CHIẾU sang (không upload lại) và không thể bị xoá
   *   từ phía công việc — xem `isTaskOwnedAsset`.
   */
  createFromIssue: async (
    landlordId: string,
    issueId: string,
    input: MaintenanceTaskFromIssueInput,
    files: Express.Multer.File[] = [],
  ) => {
    const issue = await prisma.maintenanceRequest.findFirst({
      where: { id: issueId, landlordId },
      select: {
        id: true,
        roomId: true,
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        triageStatus: true,
        images: { select: { imageUrl: true } },
        room: {
          select: {
            roomNumber: true,
            property: {
              select: {
                id: true,
                landlordId: true,
                name: true,
                address: true,
                ward: true,
                district: true,
                province: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    });
    if (!issue || issue.room.property.landlordId !== landlordId) {
      throw new AppError('Không tìm thấy sự cố hoặc bạn không có quyền xử lý', 404);
    }
    if (!CAN_CONVERT_TRIAGE_STATES.has(issue.triageStatus)) {
      throw new AppError(
        issue.triageStatus === 'REJECTED'
          ? 'Sự cố này đã bị từ chối nên không thể tạo công việc'
          : 'Sự cố đang chờ khách thuê bổ sung thông tin; hãy tiếp nhận lại (Đã xem xét) trước khi tạo công việc',
        409,
        issue.triageStatus === 'REJECTED' ? 'ISSUE_REJECTED' : 'ISSUE_NEEDS_INFO',
      );
    }
    if (!CONVERTIBLE_LIFECYCLE_STATES.has(issue.status)) {
      throw new AppError(
        issue.status === 'CANCELLED'
          ? 'Sự cố này đã bị huỷ nên không thể tạo công việc'
          : 'Sự cố đã được xử lý xong nên không thể tạo công việc',
        409,
        issue.status === 'CANCELLED' ? 'ISSUE_CANCELLED' : 'ISSUE_ALREADY_COMPLETED',
      );
    }

    const property = issue.room.property;
    const uploadedAssets = await taskImagesInput(files);
    // Ảnh sự cố được THAM CHIẾU sang công việc (cùng `image_url`), không upload lại.
    const imageRefs = Array.from(
      new Set([...issue.images.map((image) => image.imageUrl), ...uploadedAssets]),
    );

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          const activeTask = await tx.maintenanceTask.findFirst({
            // 🆕 Batch 3: "đang hoạt động" bao gồm cả IN_PROGRESS/SUBMITTED — nếu
            // chỉ chặn OPEN/ASSIGNED thì vừa bấm "Bắt đầu" là chủ trọ lại tạo
            // được công việc thứ hai cho cùng một sự cố.
            where: { sourceIssueId: issue.id, status: { in: ACTIVE_TASK_STATUSES } },
            select: { id: true },
          });
          if (activeTask) {
            throw new AppError(
              'Sự cố này đã có công việc đang mở hoặc đã giao cho thợ',
              409,
              'ISSUE_ALREADY_HAS_TASK',
            );
          }

          const task = await tx.maintenanceTask.create({
            data: {
              landlordId,
              propertyId: property.id,
              roomId: issue.roomId,
              sourceIssueId: issue.id,
              title: input.title ?? issue.title,
              description: input.description ?? issue.description,
              category: input.category ?? issue.category ?? 'GENERAL_MAINTENANCE',
              address: workplaceAddress(property, issue.room.roomNumber),
              latitude: property.latitude,
              longitude: property.longitude,
              budgetMin: input.budgetMin ?? null,
              budgetMax: input.budgetMax ?? null,
              urgency: input.urgency ?? issue.priority,
              preferredStartAt: input.preferredStartAt ?? null,
              preferredEndAt: input.preferredEndAt ?? null,
              additionalInstructions: input.additionalInstructions ?? null,
              skills: input.skills?.length
                ? { create: input.skills.map((category) => ({ category })) }
                : undefined,
              images: imageRefs.length
                ? { create: imageRefs.map((imageUrl) => ({ imageUrl })) }
                : undefined,
            },
            select: taskDetailSelect,
          });

          /**
           * Chỉ ghi nhận "đã xem xét" — KHÔNG đụng `status` (vòng đời xử lý vẫn
           * do luồng bảo trì cũ điều khiển).
           *
           * 🆕 Batch 2.1 (L3): xoá `triageNote` cũ trong CÙNG câu UPDATE. Sau khi
           * chuyển sang `REVIEWED`, giữ lại lý do "cần bổ sung"/"từ chối" là mâu
           * thuẫn với trạng thái mới. Lịch sử lý do cũ nằm ở `audit_logs` của lần
           * triage trước đó. Khi sự cố đã `REVIEWED` thì không ghi lại (tránh đẩy
           * `triageUpdatedAt` vô ích).
           */
          if (issue.triageStatus !== 'REVIEWED') {
            await tx.maintenanceRequest.update({
              where: { id: issue.id },
              data: { triageStatus: 'REVIEWED', triageNote: null, triageUpdatedAt: new Date() },
            });
          }
          return task;
        },
        { isolationLevel: 'Serializable' },
      );
      // 🆕 Batch 2.1 (M2): trả đường dẫn ảnh có token cho chủ trọ vừa tạo việc.
      return toTaskPayload({ id: landlordId, role: 'LANDLORD' }, created);
    } catch (error) {
      // Chỉ dọn ảnh do chính request này upload; ảnh sự cố là bằng chứng dùng chung.
      await Promise.all(
        uploadedAssets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
      );
      if ((error as { code?: string }).code === 'P2034') {
        throw new AppError(
          'Sự cố này vừa được tạo công việc ở một yêu cầu khác',
          409,
          'ISSUE_ALREADY_HAS_TASK',
        );
      }
      throw error;
    }
  },



  /**
   * Sửa công việc của chính mình. Chỉ khi còn `OPEN` — công việc đã giao cho thợ
   * không được đổi nội dung sau khi thợ đã nhận (Batch 3 mới có đàm phán/thay đổi).
   * `propertyId` là BẤT BIẾN: đổi cơ sở sẽ làm sai lệch phạm vi quyền sở hữu.
   *
   * 🆕 Batch 2.1 (M1) — TRÁNH GHI SAU KHI ĐÃ GIAO VIỆC. Batch 2 đọc `status` rồi
   * `update` vô điều kiện: một lệnh nhận việc commit xen giữa hai bước là nội
   * dung công việc bị sửa SAU khi thợ đã nhận. Nay bước đầu tiên trong
   * transaction là `updateMany({ id, landlordId, status: 'OPEN' })`:
   * - nó GIÀNH khoá hàng `maintenance_tasks` cho tới hết transaction, nên lệnh
   *   `accept`/`cancel` (cũng `UPDATE ... WHERE status = 'OPEN'`) phải chờ;
   * - nếu `accept` đã commit trước, câu UPDATE này khớp 0 hàng → 409
   *   `TASK_NOT_OPEN` và KHÔNG có thay đổi nào (kỹ năng, ảnh, nội dung) được ghi.
   * Nhờ vậy cuộc đua sửa/giao việc có đúng MỘT bên thắng.
   */
  update: async (
    landlordId: string,
    taskId: string,
    input: MaintenanceTaskUpdateInput,
    files: Express.Multer.File[] = [],
  ) => {
    const existing = await prisma.maintenanceTask.findFirst({
      where: { id: taskId, landlordId },
      select: {
        id: true,
        status: true,
        propertyId: true,
        // 🆕 Batch 3: cần `kind` để KHÔNG BAO GIỜ xoá ảnh bằng chứng nghiệm thu
        // khi chủ trọ sửa ảnh hiện trạng của công việc còn OPEN.
        images: { select: { imageUrl: true, kind: true } },
      },
    });
    if (!existing) throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404);
    if (existing.status !== 'OPEN') {
      throw new AppError('Chỉ có thể chỉnh sửa công việc đang mở', 409, 'TASK_NOT_OPEN');
    }
    if (input.propertyId !== undefined && input.propertyId !== existing.propertyId) {
      throw new AppError('Không thể chuyển công việc sang cơ sở khác', 400, 'TASK_PROPERTY_IMMUTABLE');
    }

    let roomId: string | null | undefined;
    if (input.roomId !== undefined) {
      if (input.roomId) {
        const room = await prisma.room.findFirst({
          where: { id: input.roomId, propertyId: existing.propertyId },
          select: { id: true },
        });
        if (!room) throw new AppError('Phòng không thuộc cơ sở của công việc', 400);
      }
      roomId = input.roomId ?? null;
    }

    const newImageAssets = await taskImagesInput(files);
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        // (M1) Chốt quyền sửa bằng một câu UPDATE có điều kiện — nguồn sự thật
        // duy nhất về việc công việc còn OPEN, không dùng kết quả đọc phía trên.
        // `data.status = 'OPEN'` là ghi lại đúng giá trị: mục đích là GIÀNH khoá
        // hàng và kiểm tra lại điều kiện, không phải đổi trạng thái.
        const claimed = await tx.maintenanceTask.updateMany({
          where: { id: taskId, landlordId, status: 'OPEN' },
          data: { status: 'OPEN' },
        });
        if (claimed.count !== 1) {
          throw new AppError(
            'Công việc vừa được giao cho thợ hoặc vừa bị huỷ, nên không thể chỉnh sửa',
            409,
            'TASK_NOT_OPEN',
          );
        }

        if (input.skills !== undefined) {
          await tx.maintenanceTaskSkill.deleteMany({ where: { taskId } });
          if (input.skills.length) {
            await tx.maintenanceTaskSkill.createMany({
              data: input.skills.map((category) => ({ taskId, category })),
            });
          }
        }

        return tx.maintenanceTask.update({
          where: { id: taskId },
          data: {
            ...(roomId !== undefined ? { roomId } : {}),
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.category !== undefined ? { category: input.category } : {}),
            ...(input.address !== undefined ? { address: input.address } : {}),
            ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
            ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
            ...(input.budgetMin !== undefined ? { budgetMin: input.budgetMin } : {}),
            ...(input.budgetMax !== undefined ? { budgetMax: input.budgetMax } : {}),
            ...(input.urgency !== undefined ? { urgency: input.urgency } : {}),
            ...(input.preferredStartAt !== undefined ? { preferredStartAt: input.preferredStartAt } : {}),
            ...(input.preferredEndAt !== undefined ? { preferredEndAt: input.preferredEndAt } : {}),
            ...(input.additionalInstructions !== undefined
              ? { additionalInstructions: input.additionalInstructions }
              : {}),
            ...(newImageAssets.length
              ? {
                  images: {
                    // 🆕 Batch 3: chỉ thay ảnh HIỆN TRẠNG. `deleteMany: {}` trần sẽ
                    // xoá cả bằng chứng nghiệm thu của thợ (và bỏ rơi asset trên
                    // Cloudinary) nếu công việc từng được làm lại.
                    deleteMany: { kind: 'TASK' },
                    create: newImageAssets.map((imageUrl) => ({ imageUrl, kind: 'TASK' as const })),
                  },
                }
              : {}),
          },
          select: taskDetailSelect,
        });
      });
    } catch (error) {
      await Promise.all(
        newImageAssets.map((asset) => storageService.deleteImage(asset, 'authenticated').catch(() => undefined)),
      );
      throw error;
    }

    // Chỉ dọn ảnh cũ SAU KHI DB đã ghi thành công: xoá trước mà transaction
    // rollback sẽ làm mất ảnh của công việc đang hiển thị.
    if (newImageAssets.length) {
      await Promise.all(
        existing.images
          // Ảnh tham chiếu từ sự cố KHÔNG thuộc marketplace: bỏ qua, nếu không
          // một lần sửa công việc sẽ xoá mất bằng chứng của khách thuê.
          // 🆕 Batch 3: ảnh nghiệm thu (`COMPLETION`) cũng bị bỏ qua — đó là
          // bằng chứng của thợ, không phải ảnh hiện trạng chủ trọ vừa thay.
          .filter((image) => image.kind !== 'COMPLETION' && isTaskOwnedAsset(image.imageUrl))
          .map((image) => deleteTaskAsset(image.imageUrl).catch(() => undefined)),
      );
    }
    return toTaskPayload({ id: landlordId, role: 'LANDLORD' }, updated);
  },

  /**
   * Huỷ công việc đang mở. Điều kiện được chốt bằng một câu UPDATE có điều kiện
   * (`status = OPEN`) nên nếu chủ trọ vừa giao việc ở tab khác, lệnh huỷ thất bại
   * với 409 thay vì huỷ một công việc đã có thợ.
   */
  cancel: async (landlordId: string, taskId: string) => {
    const task = await prisma.maintenanceTask.findFirst({
      where: { id: taskId },
      select: { id: true, landlordId: true, status: true, title: true },
    });
    if (!task || task.landlordId !== landlordId) {
      throw new AppError('Không tìm thấy công việc hoặc bạn không có quyền', 404);
    }
    if (task.status !== 'OPEN') {
      throw new AppError(
        task.status === 'ASSIGNED'
          ? 'Công việc đã giao cho thợ nên không thể huỷ'
          : 'Công việc đã bị huỷ trước đó',
        409,
        task.status === 'ASSIGNED' ? 'TASK_ALREADY_ASSIGNED' : 'TASK_NOT_OPEN',
      );
    }

    const rejectedStaffIds = await prisma.$transaction(async (tx) => {
      const claimed = await tx.maintenanceTask.updateMany({
        where: { id: taskId, landlordId, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      });
      if (claimed.count !== 1) {
        throw new AppError('Công việc vừa thay đổi trạng thái, vui lòng tải lại', 409, 'TASK_STATE_CONFLICT');
      }

      const pending = await tx.maintenanceTaskApplication.findMany({
        where: { taskId, status: 'PENDING' },
        select: { staffId: true },
      });
      if (pending.length) {
        await tx.maintenanceTaskApplication.updateMany({
          where: { taskId, status: 'PENDING' },
          data: { status: 'REJECTED', reviewedAt: new Date() },
        });
      }
      return pending.map((application) => application.staffId);
    });

    // Thông báo chỉ phát SAU khi transaction commit: không bao giờ báo cho thợ
    // một việc đã bị rollback.
    await Promise.all(
      rejectedStaffIds.map((staffId) =>
        notificationService
          .createNotification(
            staffId,
            'Công việc đã bị huỷ',
            `Chủ trọ đã huỷ công việc "${task.title}" nên đơn ứng tuyển của bạn không còn hiệu lực.`,
            'TASK',
            taskId,
          )
          .catch(() => undefined),
      ),
    );

    return prisma.maintenanceTask
      .findUniqueOrThrow({ where: { id: taskId }, select: taskDetailSelect })
      .then((task) => toTaskPayload({ id: landlordId, role: 'LANDLORD' }, task));
  },

  /** Danh sách công việc của chính chủ trọ (kèm số đơn ứng tuyển + ảnh có token). */
  getMine: async (
    landlordId: string,
    query: { status?: MaintenanceTaskStatus } = {},
  ) => {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { landlordId, ...(query.status ? { status: query.status } : {}) },
      select: {
        ...taskSummarySelect,
        // Chỉ chủ trọ sở hữu mới đọc danh sách này (đã lọc `landlordId`), nên
        // việc cấp token ảnh ở đây không mở rộng quyền cho ai khác.
        images: { select: { id: true, kind: true } },
        _count: { select: { applications: true } },
      },
      // Không `orderBy: status` — xem `TASK_STATUS_ORDER`.
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    const viewer: EvidenceViewer = { id: landlordId, role: 'LANDLORD' };
    return tasks
      .slice()
      .sort(
        (a, b) =>
          TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status] ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((task) => toTaskPayload(viewer, task));
  },

  /**
   * Chi tiết công việc cho MỌI role đã đăng nhập, với phạm vi khác nhau:
   * - chủ trọ sở hữu / admin: thấy toàn bộ đơn ứng tuyển + liên hệ thợ được giao;
   * - thợ được giao: thấy việc của mình, số điện thoại liên hệ của chính mình;
   * - thợ từng ứng tuyển: chỉ thấy đơn của mình (không thấy người cùng ứng tuyển);
   * - người ngoài: chỉ thấy công việc còn `OPEN` (như một tin niêm yết công khai
   *   trong hệ thống), mọi trạng thái khác trả 404 để không lộ dữ liệu.
   */
  getById: async (viewer: { id: string; role: string }, taskId: string) => {
    const base = await prisma.maintenanceTask.findUnique({
      where: { id: taskId },
      select: { id: true, landlordId: true, status: true, assignedStaffId: true },
    });
    if (!base) throw new AppError('Không tìm thấy công việc', 404);

    const isAdmin = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';
    const isOwner = base.landlordId === viewer.id;
    const isAssignee = base.assignedStaffId === viewer.id;
    const myApplication =
      isOwner || isAdmin
        ? null
        : await prisma.maintenanceTaskApplication.findUnique({
            where: { taskId_staffId: { taskId, staffId: viewer.id } },
            select: ownApplicationSelect,
          });

    if (!isOwner && !isAdmin && !isAssignee && !myApplication && base.status !== 'OPEN') {
      throw new AppError('Không tìm thấy công việc', 404);
    }

    const task = await prisma.maintenanceTask.findUniqueOrThrow({
      where: { id: taskId },
      select: {
        ...taskDetailSelect,
        assignedStaff: { select: { id: true, fullName: true, avatarUrl: true, phone: true } },
      },
    });

    const applications =
      isOwner || isAdmin
        ? await prisma.maintenanceTaskApplication.findMany({
            where: { taskId },
            select: applicantSelect,
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
          })
        : [];

    const canSeeStaffContact = isOwner || isAdmin || isAssignee;
    /**
     * 🆕 Batch 2.1 (M2): chỉ cấp token ảnh cho người có quan hệ thật sự với
     * công việc. Với công việc còn `OPEN`, thợ đã đăng nhập cũng cần xem hiện
     * trạng để quyết định ứng tuyển — nhưng KYC vẫn được kiểm tra lại ở route
     * tải ảnh (`canViewTaskEvidence`). Người không có quyền nhận `images: []`
     * thay vì một token vô dụng.
     */
    const viewerIsStaff = viewer.role === 'STAFF';
    const canReceiveImageTokens =
      isOwner || isAdmin || isAssignee || (viewerIsStaff && (Boolean(myApplication) || base.status === 'OPEN'));
    const payload = toTaskPayload(
      { id: viewer.id, role: viewer.role },
      canReceiveImageTokens ? task : { ...task, images: [] },
    );
    return {
      ...payload,
      isOwner,
      myApplication,
      /**
       * 🆕 Batch 3 — cờ GỢI Ý cho UI (không phải phân quyền): mỗi thao tác vẫn
       * được kiểm tra lại ở server bằng updateMany có điều kiện + KYC trong
       * cùng transaction. Nhờ vậy ẩn/hiện nút không phải là hàng rào bảo mật.
       */
      isAssignee,
      canStartWork: isAssignee && task.status === 'ASSIGNED',
      canSubmitCompletion: isAssignee && task.status === 'IN_PROGRESS',
      canReviewCompletion: isOwner && task.status === 'SUBMITTED',
      applications: applications.map(({ staff: { kycSubmission, ...staff }, ...application }) => ({
        ...application,
        staff,
        kycStatus: kycStateOf(kycSubmission),
      })),
      // Số điện thoại của thợ chỉ dành cho người có quyền liên hệ thật sự.
      assignedStaff:
        task.assignedStaff && !canSeeStaffContact ? { ...task.assignedStaff, phone: null } : task.assignedStaff,
    };
  },

  /**
   * Danh sách công việc cho THỢ: chỉ công việc còn `OPEN`.
   *
   * Tìm theo khoảng cách:
   * 1. Lọc bounding box ở SQL (`latitude`/`longitude` nằm trong hộp) — không nạp
   *    cả bảng `maintenance_tasks` vào bộ nhớ.
   * 2. Tính Haversine chính xác cho tập đã thu hẹp, lọc theo `radiusKm`, sắp xếp
   *    theo khoảng cách thật rồi mới phân trang.
   * 3. Công việc thiếu toạ độ KHÔNG được gán khoảng cách: chúng bị loại khỏi
   *    chế độ tìm theo khoảng cách (không thể chứng minh nằm trong bán kính) và
   *    nhận `distanceKm: null` ở chế độ thường.
   */
  browseOpen: async (staffId: string, query: MaintenanceTaskBrowseQuery) => {
    const { page, limit } = normalizePagination(query.page, query.limit);
    const center = toCoordinates(query.latitude, query.longitude);
    const sort = query.sort ?? (center ? 'nearest' : 'newest');

    const where: Prisma.MaintenanceTaskWhereInput = {
      status: 'OPEN',
      ...(query.category ? { category: query.category } : {}),
      ...(query.skill ? { skills: { some: { category: query.skill } } } : {}),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
              { address: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    if (center && query.radiusKm != null) {
      const clauses = geoWhere(center, query.radiusKm);
      if (clauses.length) where.AND = clauses;
    }

    const select = {
      ...taskSummarySelect,
      latitude: true,
      longitude: true,
      // 🆕 Batch 2.1 (M2): marketplace KHÔNG nhận đường dẫn ảnh. Thợ chỉ thấy SỐ
      // LƯỢNG ảnh hiện trạng; muốn xem thì mở chi tiết (route chi tiết cấp token
      // sau khi kiểm tra quyền + KYC).
      _count: { select: { images: true } },
      // Trạng thái đơn của CHÍNH thợ đang xem — để UI hiện "Đã ứng tuyển".
      applications: { where: { staffId }, select: { id: true, status: true } },
    } as const;

    if (!center) {
      const [total, rows] = await prisma.$transaction([
        prisma.maintenanceTask.count({ where }),
        prisma.maintenanceTask.findMany({
          where,
          select,
          orderBy: orderByFor(sort),
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      return {
        items: rows.map((row) => toBrowseItem(row, null)),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          // Minh bạch với UI: bao nhiêu việc không có toạ độ nên không thể xếp
          // theo khoảng cách. Không âm thầm coi thiếu toạ độ là (0,0).
          withoutCoordinates: rows.filter((row) => toCoordinates(row.latitude, row.longitude) == null).length,
        },
      };
    }

    // Có toạ độ: chỉ lấy tập ứng viên đã thu hẹp bởi bounding box. `take` chặn
    // trần bộ nhớ; đây là giới hạn có chủ đích và được báo lại trong `meta`.
    const candidates = await prisma.maintenanceTask.findMany({
      where,
      select,
      orderBy: orderByFor(sort === 'urgency' ? 'urgency' : 'newest'),
      take: MAX_DISTANCE_CANDIDATES,
    });

    const ranked = candidates
      .map((row) => ({ row, distanceKm: haversineDistanceKm(center, toCoordinates(row.latitude, row.longitude)) }));

    // Việc thiếu toạ độ KHÔNG bị coi là cách 0 km: chúng bị loại khỏi danh sách
    // xếp theo khoảng cách (không thể so sánh) và được đếm riêng trong `meta` để
    // UI giải thích vì sao tổng số thấp hơn số việc đang mở.
    const withoutCoordinates = ranked.filter((item) => item.distanceKm == null).length;

    const pageRows = ranked
      .filter((item): item is { row: (typeof candidates)[number]; distanceKm: number } => item.distanceKm != null)
      .filter((item) => query.radiusKm == null || item.distanceKm <= query.radiusKm)
      .sort(
        (a, b) =>
          a.distanceKm - b.distanceKm ||
          a.row.createdAt.getTime() - b.row.createdAt.getTime() ||
          a.row.id.localeCompare(b.row.id),
      )
      .slice((page - 1) * limit, page * limit);

    const visible = ranked
      .filter((item): item is { row: (typeof candidates)[number]; distanceKm: number } => item.distanceKm != null)
      .filter((item) => query.radiusKm == null || item.distanceKm <= query.radiusKm);

    return {
      items: pageRows.map((item) => toBrowseItem(item.row, item.distanceKm)),
      meta: {
        page,
        limit,
        total: visible.length,
        totalPages: Math.ceil(visible.length / limit),
        distanceCapped: candidates.length === MAX_DISTANCE_CANDIDATES,
        withoutCoordinates,
      },
    };
  },
};
