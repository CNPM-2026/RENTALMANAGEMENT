import crypto from 'crypto';
import prisma from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { storageService } from './storage.service';

/**
 * BẰNG CHỨNG CỦA YÊU CẦU CHẤM DỨT HỢP ĐỒNG.
 *
 * Dùng cùng mô hình với bằng chứng báo cáo / bảo trì: ảnh được upload ở chế độ
 * Cloudinary `authenticated`, DB chỉ lưu `public_id`. Client nhận URL có token
 * HMAC ngắn hạn; khi tải, server đọc lại quyền từ DB. Token KHÔNG phải quyền
 * truy cập — người xem phải là một bên của hợp đồng hoặc ADMIN đang hoạt động.
 */
export const CONTRACT_TERMINATION_ATTACHMENT_PATH = '/api/v1/contract-termination-attachments';
const TOKEN_TTL_SECONDS = 10 * 60;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['res.cloudinary.com']);

type Viewer = { id: string; role: string };

const sign = (payload: string) =>
  crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');

export const mintContractTerminationAttachmentUrl = (attachmentId: string, viewer: Viewer): string => {
  const claims = {
    a: attachmentId,
    u: viewer.id,
    r: viewer.role,
    e: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${CONTRACT_TERMINATION_ATTACHMENT_PATH}/${attachmentId}?token=${payload}.${sign(payload)}`;
};

const verifyToken = (attachmentId: string, token?: string): Viewer | null => {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      a: string;
      u: string;
      r: string;
      e: number;
    };
    if (claims.a !== attachmentId) return null;
    if (!claims.e || claims.e < Math.floor(Date.now() / 1000)) return null;
    return { id: claims.u, role: claims.r };
  } catch {
    return null;
  }
};

const readBytes = async (ref: string): Promise<{ buffer: Buffer; contentType: string }> => {
  if (!ref) throw new AppError('Không tìm thấy tệp', 404, 'ATTACHMENT_NOT_FOUND');

  let url: string;
  if (storageService.isPrivateRef(ref)) {
    url = storageService.getPrivateImageUrl(ref, TOKEN_TTL_SECONDS);
  } else {
    let parsed: URL;
    try {
      parsed = new URL(ref);
    } catch {
      throw new AppError('Không tìm thấy tệp', 404, 'ATTACHMENT_NOT_FOUND');
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
      throw new AppError('Không tìm thấy tệp', 404, 'ATTACHMENT_NOT_FOUND');
    }
    url = ref;
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  } catch {
    throw new AppError('Không tải được tệp', 502, 'ATTACHMENT_FETCH_FAILED');
  }
  if (!response.ok) throw new AppError('Không tải được tệp', 502, 'ATTACHMENT_FETCH_FAILED');

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
    throw new AppError('Tệp không hợp lệ', 502, 'ATTACHMENT_INVALID_ASSET');
  }
  return { buffer, contentType: response.headers.get('content-type') ?? 'application/octet-stream' };
};

export const loadContractTerminationAttachment = async (
  attachmentId: string,
  token: string | undefined,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const viewer = verifyToken(attachmentId, token);
  if (!viewer) {
    throw new AppError('Đường dẫn tệp không hợp lệ hoặc đã hết hạn', 403, 'ATTACHMENT_TOKEN_INVALID');
  }

  const attachment = await prisma.contractTerminationAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      fileRef: true,
      request: {
        select: {
          requestedById: true,
          contract: {
            select: {
              tenantId: true,
              room: { select: { property: { select: { landlordId: true } } } },
            },
          },
        },
      },
    },
  });
  if (!attachment) throw new AppError('Không tìm thấy tệp', 404, 'ATTACHMENT_NOT_FOUND');

  const viewerRow = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { role: true, isActive: true },
  });
  const contract = attachment.request.contract;
  const allowed =
    Boolean(viewerRow?.isActive) &&
    (viewerRow?.role === 'ADMIN' ||
      attachment.request.requestedById === viewer.id ||
      contract.tenantId === viewer.id ||
      contract.room.property.landlordId === viewer.id);
  if (!allowed) throw new AppError('Bạn không có quyền xem tệp này', 403, 'ATTACHMENT_FORBIDDEN');

  return readBytes(attachment.fileRef);
};
