import crypto from 'crypto';
import prisma from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { storageService } from './storage.service';

/**
 * TỆP ĐÍNH KÈM CỦA TIN NHẮN (Batch 5).
 *
 * - Upload PRIVATE (`type: authenticated`); DB chỉ lưu `public_id`.
 * - Client nhận `/api/v1/chat-attachments/<messageId>?token=...`.
 * - Khi tải, server ĐỌC LẠI tư cách thành viên hội thoại của người xem: token hết
 *   hạn hoặc người xem bị xoá khỏi hội thoại đều bị từ chối.
 * - Không có URL công khai nào được trả cho client, nên không thể chèn ảnh lạ
 *   bằng cách gửi `content` là một URL.
 */

export const CHAT_ATTACHMENT_PATH = '/api/v1/chat-attachments';
const TOKEN_TTL_SECONDS = 10 * 60;
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_HOSTS = new Set(['res.cloudinary.com']);

const sign = (payload: string) => crypto.createHmac('sha256', env.JWT_SECRET).update(payload).digest('base64url');

export const mintChatAttachmentUrl = (messageId: string, viewerId: string): string => {
  const claims = { m: messageId, u: viewerId, e: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return `${CHAT_ATTACHMENT_PATH}/${messageId}?token=${payload}.${sign(payload)}`;
};

const verifyToken = (messageId: string, token?: string): { viewerId: string } | null => {
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
      m: string;
      u: string;
      e: number;
    };
    if (claims.m !== messageId) return null;
    if (!claims.e || claims.e < Math.floor(Date.now() / 1000)) return null;
    return { viewerId: claims.u };
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

export const loadChatAttachment = async (
  messageId: string,
  token: string | undefined,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const claims = verifyToken(messageId, token);
  if (!claims) {
    throw new AppError('Đường dẫn tệp không hợp lệ hoặc đã hết hạn', 403, 'ATTACHMENT_TOKEN_INVALID');
  }

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { attachmentRef: true, conversationId: true },
  });
  if (!message?.attachmentRef) throw new AppError('Không tìm thấy tệp', 404, 'ATTACHMENT_NOT_FOUND');

  const [membership, viewer] = await Promise.all([
    prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: message.conversationId, userId: claims.viewerId } },
      select: { userId: true },
    }),
    prisma.user.findUnique({ where: { id: claims.viewerId }, select: { isActive: true } }),
  ]);
  if (!membership || !viewer?.isActive) {
    throw new AppError('Bạn không có quyền xem tệp này', 403, 'ATTACHMENT_FORBIDDEN');
  }

  return readBytes(message.attachmentRef);
};
