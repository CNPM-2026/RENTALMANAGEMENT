import crypto from 'crypto';
import prisma from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { isKycApproved, loadKycState } from './kycGate.service';
import { storageService } from './storage.service';

/**
 * 🆕 Batch 2.1 (M2) — PHÂN PHỐI ẢNH HIỆN TRẠNG BẢO TRÌ ĐÃ ĐƯỢC CẤP QUYỀN.
 *
 * Vấn đề của Batch 2: `maintenance_request_images.image_url` và
 * `maintenance_task_images.image_url` lưu URL Cloudinary CÔNG KHAI
 * (`type: upload`). Ai có URL — kể cả người không có quan hệ nghiệp vụ, kể cả
 * sau khi URL bị lộ qua log/proxy/lịch sử trình duyệt — đều xem được ảnh hiện
 * trạng trong nhà của khách thuê. "URL khó đoán" không phải là phân quyền.
 *
 * Cách sửa:
 * 1. Upload mới dùng `storageService.uploadPrivateImage` (Cloudinary
 *    `type: authenticated`) → asset riêng tư, không có delivery URL công khai.
 * 2. Không trả URL thật trong bất kỳ payload nào. Payload chỉ trả
 *    `imageUrl = /api/v1/maintenance-images/<kind>/<id>?token=...`.
 * 3. Token = HMAC-SHA256 (khoá `JWT_SECRET`) trên {kind, imageId, người xem,
 *    role, hạn}. Nó KHÔNG phải là quyền truy cập: khi tải ảnh, server ĐỌC LẠI
 *    quan hệ nghiệp vụ và kiểm tra lại quyền (`canViewIssueEvidence` /
 *    `canViewTaskEvidence`). Thu hồi KYC, đổi chủ sở hữu, huỷ đơn → token còn
 *    hạn vẫn bị từ chối.
 * 4. Bytes được server tải từ Cloudinary (URL có chữ ký + `expires_at`) rồi
 *    stream về client: chữ ký Cloudinary không bao giờ tới trình duyệt.
 *
 * Bất biến:
 * - Không log URL/token (morgan bỏ qua route này ở `app.ts`).
 * - Sai chữ ký / hết hạn / sai (kind,id) → 403, không tiết lộ gì thêm.
 * - Không có quyền với bản ghi → 403 sau khi đã xác thực token; ảnh không tồn
 *   tại → 404 (chống IDOR: id ảnh không đoán được và vẫn phải có token hợp lệ).
 */

export type EvidenceKind = 'issue' | 'task';

/** Người xem được nhúng vào token: id = CHỦ THỂ PHẠM VI đã dùng khi đọc dữ liệu. */
export interface EvidenceViewer {
  id: string;
  role: string;
}

/** Tiền tố route công khai (xem `maintenanceImage.route.ts`). */
export const EVIDENCE_PATH = '/api/v1/maintenance-images';

/** Token ngắn hạn: 10 phút, đủ cho một lượt xem trang. */
export const EVIDENCE_TOKEN_TTL_SECONDS = 10 * 60;

/** Ảnh bằng chứng không bao giờ lớn hơn hạn mức upload (5MB) + dư địa. */
const MAX_EVIDENCE_BYTES = 8 * 1024 * 1024;

/** Chỉ tải hộ từ host Cloudinary — chặn SSRF qua `imageUrl` bị sửa trong DB. */
const ALLOWED_EVIDENCE_HOSTS = new Set(['res.cloudinary.com']);

interface EvidenceClaims {
  /** kind */
  k: EvidenceKind;
  /** imageId */
  i: string;
  /** người xem (id) */
  u: string;
  /** role của người xem tại thời điểm cấp token */
  r: string;
  /** hạn tuyệt đối (epoch giây) */
  e: number;
}

const signatureOf = (payload: string) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');

/**
 * Cấp đường dẫn ảnh có token cho MỘT ảnh của MỘT người xem.
 * Hàm thuần (không chạm DB) để dùng được trong mọi projection.
 */
export const mintEvidenceUrl = (kind: EvidenceKind, imageId: string, viewer: EvidenceViewer): string => {
  const claims: EvidenceClaims = {
    k: kind,
    i: imageId,
    u: viewer.id,
    r: viewer.role,
    e: Math.floor(Date.now() / 1000) + EVIDENCE_TOKEN_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${EVIDENCE_PATH}/${kind}/${imageId}?token=${payload}.${signatureOf(payload)}`;
};

/**
 * Xác thực token và trả lại danh tính người xem. `null` = không hợp lệ.
 * So sánh chữ ký bằng `timingSafeEqual` (không rò rỉ qua thời gian).
 */
export const verifyEvidenceToken = (
  kind: EvidenceKind,
  imageId: string,
  token: string | undefined | null,
): EvidenceViewer | null => {
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const provided = token.slice(separator + 1);
  if (!payload || !provided) return null;

  const expected = signatureOf(payload);
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  let claims: EvidenceClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as EvidenceClaims;
  } catch {
    return null;
  }
  if (claims?.k !== kind || claims?.i !== imageId) return null;
  if (typeof claims.e !== 'number' || claims.e * 1000 <= Date.now()) return null;
  if (typeof claims.u !== 'string' || !claims.u || typeof claims.r !== 'string' || !claims.r) return null;
  return { id: claims.u, role: claims.r };
};

const isAdmin = (role: string) => role === 'ADMIN' || role === 'SUPER_ADMIN';

/**
 * Ảnh của BÁO CÁO sự cố: chỉ khách thuê đã báo cáo và chủ trọ của cơ sở đó
 * (cùng phạm vi với `maintenanceService.getById`), cộng admin.
 */
export const canViewIssueEvidence = (
  viewer: EvidenceViewer,
  issue: { tenantId: string; landlordId: string },
): boolean => isAdmin(viewer.role) || issue.tenantId === viewer.id || issue.landlordId === viewer.id;

/**
 * Ảnh của CÔNG VIỆC: chủ trọ sở hữu, thợ được giao, thợ đã từng ứng tuyển (đã
 * có quan hệ nghiệp vụ và đã thấy ảnh), admin; và thợ đã KYC duyệt với việc
 * còn `OPEN` — nếu không, marketplace sẽ vô dụng vì thợ không thể xem hiện
 * trạng để quyết định ứng tuyển.
 *
 * KYC được ĐỌC LẠI ở đây (không tin claim `r`/token): admin vừa từ chối KYC thì
 * lượt tải kế tiếp phải hỏng.
 */
export const canViewTaskEvidence = async (
  viewer: EvidenceViewer,
  task: { id: string; landlordId: string; status: string; assignedStaffId: string | null },
): Promise<boolean> => {
  if (isAdmin(viewer.role)) return true;
  if (task.landlordId === viewer.id) return true;
  if (task.assignedStaffId === viewer.id) return true;
  if (viewer.role !== 'STAFF') return false;

  const application = await prisma.maintenanceTaskApplication.findUnique({
    where: { taskId_staffId: { taskId: task.id, staffId: viewer.id } },
    select: { id: true },
  });
  if (application) return true;
  if (task.status !== 'OPEN') return false;
  return isKycApproved(await loadKycState(viewer.id));
};

/**
 * Gắn đường dẫn có token vào danh sách ảnh và BỎ `imageUrl` thật.
 * Chịu được `images` undefined (mock/test, payload cũ) để không làm hỏng API.
 */
export const decorateEvidenceImages = <T extends { id: string }>(
  kind: EvidenceKind,
  images: readonly T[] | null | undefined,
  viewer: EvidenceViewer,
): Array<{ id: string; imageUrl: string }> =>
  (Array.isArray(images) ? images : []).map((image) => ({
    id: image.id,
    imageUrl: mintEvidenceUrl(kind, image.id, viewer),
  }));

type IssueEvidenceRow = { ref: string; issue: { tenantId: string; landlordId: string } };
type TaskEvidenceRow = {
  ref: string;
  task: { id: string; landlordId: string; status: string; assignedStaffId: string | null };
};

/** Đọc `image_url` + quan hệ nghiệp vụ của một ảnh. `null` = không tồn tại. */
const loadEvidenceRow = async (
  kind: EvidenceKind,
  imageId: string,
): Promise<IssueEvidenceRow | TaskEvidenceRow | null> => {
  if (kind === 'issue') {
    const row = await prisma.maintenanceRequestImage.findUnique({
      where: { id: imageId },
      select: { imageUrl: true, request: { select: { tenantId: true, landlordId: true } } },
    });
    return row ? { ref: row.imageUrl, issue: row.request } : null;
  }
  const row = await prisma.maintenanceTaskImage.findUnique({
    where: { id: imageId },
    select: {
      imageUrl: true,
      task: { select: { id: true, landlordId: true, status: true, assignedStaffId: true } },
    },
  });
  return row ? { ref: row.imageUrl, task: row.task } : null;
};

/**
 * Tải bytes của một asset bằng ĐƯỜNG DẪN RIÊNG TƯ (không trả URL cho client).
 *
 * - Dữ liệu mới: `public_id` → URL Cloudinary có chữ ký + `expires_at` ngắn.
 * - Dữ liệu cũ (trước Batch 2.1): URL công khai, nhưng chỉ chấp nhận host
 *   Cloudinary và chỉ tải khi người xem đã qua kiểm tra quyền ở trên.
 *   ⚠️ Asset cũ VẪN công khai tại Cloudinary — xem `docs/BATCH-2.1-REMEDIATION.md`.
 */
const readEvidenceBytes = async (ref: string): Promise<{ buffer: Buffer; contentType: string }> => {
  if (!ref || ref.startsWith('/uploads/')) {
    throw new AppError('Không tìm thấy ảnh', 404, 'EVIDENCE_NOT_FOUND');
  }

  let url: string;
  if (storageService.isPrivateRef(ref)) {
    url = storageService.getPrivateImageUrl(ref, EVIDENCE_TOKEN_TTL_SECONDS);
  } else {
    let parsed: URL;
    try {
      parsed = new URL(ref);
    } catch {
      throw new AppError('Không tìm thấy ảnh', 404, 'EVIDENCE_NOT_FOUND');
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_EVIDENCE_HOSTS.has(parsed.hostname)) {
      throw new AppError('Không tìm thấy ảnh', 404, 'EVIDENCE_NOT_FOUND');
    }
    url = ref;
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new AppError('Không tải được ảnh', 502, 'EVIDENCE_FETCH_FAILED');
  }
  if (!response.ok) throw new AppError('Không tải được ảnh', 502, 'EVIDENCE_FETCH_FAILED');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_EVIDENCE_BYTES) {
    throw new AppError('Ảnh không hợp lệ', 502, 'EVIDENCE_INVALID_ASSET');
  }
  return { buffer, contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
};

/**
 * Điểm vào của route tải ảnh: xác thực token → ĐỌC LẠI quyền → tải bytes.
 * Không bước nào tin vào token để bỏ qua kiểm tra quyền.
 */
export const loadAuthorizedEvidence = async (
  kind: EvidenceKind,
  imageId: string,
  token: string | undefined,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const viewer = verifyEvidenceToken(kind, imageId, token);
  if (!viewer) {
    throw new AppError('Đường dẫn ảnh không hợp lệ hoặc đã hết hạn', 403, 'EVIDENCE_TOKEN_INVALID');
  }

  const row = await loadEvidenceRow(kind, imageId);
  if (!row) throw new AppError('Không tìm thấy ảnh', 404, 'EVIDENCE_NOT_FOUND');

  const allowed =
    kind === 'issue'
      ? canViewIssueEvidence(viewer, (row as IssueEvidenceRow).issue)
      : await canViewTaskEvidence(viewer, (row as TaskEvidenceRow).task);
  if (!allowed) throw new AppError('Bạn không có quyền xem ảnh này', 403, 'EVIDENCE_FORBIDDEN');

  return readEvidenceBytes(row.ref);
};

export const maintenanceEvidenceService = {
  mintEvidenceUrl,
  verifyEvidenceToken,
  canViewIssueEvidence,
  canViewTaskEvidence,
  decorateEvidenceImages,
  loadAuthorizedEvidence,
};
