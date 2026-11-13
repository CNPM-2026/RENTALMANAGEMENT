import prisma from '../config/db';
import { io } from '../socket/socket.instance';
import { AppError } from '../utils/AppError';
import type { MessageType } from '@prisma/client';
import { chatAccessService } from './chatAccess.service';
import { mintChatAttachmentUrl } from './chatAttachment.service';
import { notificationService } from './notification.service';

/**
 * CHAT (Batch 5).
 *
 * SỬA LỖI REALTIME GỐC — "tin nhắn hiện hai lần / badge nhảy sai":
 * server cũ phát `receive_message` cho CẢ phòng `conversation_<id>` VÀ phòng
 * `user_<id>` của từng người nhận. Người đang mở hội thoại nằm trong cả hai
 * phòng nên nhận hai bản của cùng một tin; `ChatProvider` cộng `unreadCount` hai
 * lần và preview có thể nhảy. Từ Batch 5:
 *   - `receive_message` chỉ phát tới phòng RIÊNG `user_<id>` của từng thành viên,
 *     mỗi thành viên đúng MỘT lần (payload riêng khi có tệp đính kèm, vì URL tệp
 *     gắn với người xem);
 *   - phòng `conversation_<id>` chỉ còn dùng cho `typing`/presence;
 *   - client dedupe theo `message.id` (idempotent khi reconnect hoặc nhiều tab).
 *
 * Bất biến khác:
 * - Mọi đọc/ghi đều kiểm tra tư cách thành viên từ DB
 *   (`chatAccessService.assertMember`); không tin `conversationId`/`senderId` từ client.
 * - `clientMessageId` unique theo hội thoại => retry/double-click không tạo tin thứ hai.
 * - Tệp đính kèm là asset PRIVATE; payload chỉ chứa URL có token do server cấp.
 */

const CHAT_IMAGE_FOLDER = 'rental-management/chat';
const MAX_MESSAGE_LENGTH = 5000;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  messageType: true,
  content: true,
  isRead: true,
  createdAt: true,
  attachmentRef: true,
  attachmentMime: true,
  attachmentBytes: true,
  attachmentName: true,
  sender: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

type MessageRow = {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: MessageType;
  content: string;
  isRead: boolean;
  createdAt: Date;
  attachmentRef: string | null;
  attachmentMime: string | null;
  attachmentBytes: number | null;
  attachmentName: string | null;
  sender?: { id: string; fullName: string; avatarUrl: string | null };
};

/**
 * Payload cho MỘT người xem: `attachmentRef` (public_id Cloudinary) không bao
 * giờ rời server; thay vào đó là đường dẫn có token gắn với chính người xem.
 */
export const toMessagePayload = (message: MessageRow, viewerId: string) => {
  const { attachmentRef: _ref, ...rest } = message;
  return {
    ...rest,
    attachment: message.attachmentMime
      ? {
          url: mintChatAttachmentUrl(message.id, viewerId),
          mimeType: message.attachmentMime,
          byteSize: message.attachmentBytes ?? 0,
          name: message.attachmentName ?? 'tep-dinh-kem',
        }
      : null,
  };
};

/**
 * Phát tin nhắn mới: ĐÚNG MỘT lần cho mỗi thành viên, vào phòng riêng của họ.
 * Export để socket dùng lại (một nguồn phát duy nhất).
 */
export const emitNewMessage = async (message: MessageRow, memberIds: string[]) => {
  if (!io) return;
  const unique = Array.from(new Set(memberIds));
  for (const memberId of unique) {
    io.to(`user_${memberId}`).emit('receive_message', toMessagePayload(message, memberId));
  }
};

const memberListOf = async (conversationId: string) => {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return members.map((member) => member.userId);
};

/** Từ khoá bị cấm (bảng `content_filter_keywords`) — kiểm tra trước khi ghi. */
export const findBannedChatKeyword = async (content: string) => {
  const normalizedContent = content.trim().toLocaleLowerCase('vi-VN');
  if (!normalizedContent) return undefined;
  const keywords = await prisma.contentFilterKeyword.findMany({ select: { keyword: true } });
  return keywords.find(({ keyword }) => normalizedContent.includes(keyword));
};

export const chatService = {
  /** Mở (hoặc lấy lại) hội thoại 1-1 — có kiểm tra quan hệ theo `chatAccessService`. */
  getOrCreateConversation: async (myId: string, targetUserId: string) => {
    const scope = await chatAccessService.resolveScope(myId, targetUserId);

    const include = {
      members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
    } as const;

    const existing = await prisma.conversation.findFirst({
      where: {
        taskId: scope.taskId,
        AND: [
          { members: { some: { userId: myId } } },
          { members: { some: { userId: targetUserId } } },
          { members: { every: { userId: { in: [myId, targetUserId] } } } },
        ],
      },
      include,
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;

    return await prisma.conversation.create({
      data: {
        taskId: scope.taskId,
        members: { create: [{ userId: myId }, { userId: targetUserId }] },
      },
      include,
    });
  },

  /** Danh sách hội thoại kèm tin nhắn cuối + số chưa đọc (badge/preview). */
  getMyConversations: async (userId: string) => {
    const conversations = await prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        messages: { take: 1, orderBy: { createdAt: 'desc' }, select: messageSelect },
        _count: {
          select: { messages: { where: { isRead: false, senderId: { not: userId } } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation) => {
      const lastMessage = conversation.messages[0];
      const { _count, messages, ...rest } = conversation;
      const payload = lastMessage ? toMessagePayload(lastMessage, userId) : null;
      return {
        ...rest,
        unreadCount: _count.messages,
        lastMessage: payload,
        messages: payload ? [payload] : [],
      };
    });
  },

  /** Lịch sử tin nhắn (mới nhất trước) + tự đánh dấu đã đọc. */
  getMessages: async (userId: string, conversationId: string, page: number = 1, limit: number = 20) => {
    await chatAccessService.assertMember(userId, conversationId);

    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 50) : 20;

    const unread = await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    if (unread.count > 0 && io) {
      io.to(`user_${userId}`).emit('conversation_read', { conversationId, unreadCount: 0 });
    }

    const rows = await prisma.message.findMany({
      where: { conversationId },
      select: messageSelect,
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return rows.map((row) => toMessagePayload(row, userId));
  },

  /** Đánh dấu đã đọc (dùng khi thu nhỏ/mở lại cửa sổ chat). */
  markAsRead: async (userId: string, conversationId: string) => {
    await chatAccessService.assertMember(userId, conversationId);
    const result = await prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, isRead: false },
      data: { isRead: true },
    });
    if (io) io.to(`user_${userId}`).emit('conversation_read', { conversationId, unreadCount: 0 });
    return result;
  },


  /**
   * Gửi tin nhắn (đường HTTP — dùng được cho cả tệp đính kèm).
   * Socket gọi cùng hàm này để chỉ có MỘT luồng ghi/phát.
   */
  sendMessage: async (
    userId: string,
    conversationId: string,
    input: {
      content?: string;
      messageType?: MessageType;
      clientMessageId?: string;
      attachment?: { fileRef: string; mimeType: string; byteSize: number; name: string } | null;
    },
  ) => {
    await chatAccessService.assertMember(userId, conversationId);

    const attachment = input.attachment ?? null;
    const content = (input.content ?? '').trim();
    if (!attachment && content.length === 0) {
      throw new AppError('Nội dung tin nhắn không hợp lệ', 400, 'MESSAGE_EMPTY');
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new AppError('Nội dung tin nhắn không hợp lệ', 400, 'MESSAGE_TOO_LONG');
    }

    if (content.length > 0) {
      const matchedKeyword = await findBannedChatKeyword(content);
      if (matchedKeyword) {
        throw new AppError(
          `Tin nhắn chứa từ khóa bị cấm "${matchedKeyword.keyword}". Vui lòng chỉnh sửa nội dung trước khi gửi.`,
          400,
          'MESSAGE_BANNED_KEYWORD',
        );
      }
    }

    if (input.clientMessageId) {
      const existing = await prisma.message.findUnique({
        where: {
          conversationId_clientMessageId: {
            conversationId,
            clientMessageId: input.clientMessageId,
          },
        },
        select: messageSelect,
      });
      // Retry sau khi mất mạng: trả lại đúng tin đã ghi, KHÔNG phát lại sự kiện.
      if (existing) return toMessagePayload(existing, userId);
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.length ? content : (attachment?.name ?? ''),
        messageType: attachment ? 'IMAGE' : (input.messageType ?? 'TEXT'),
        clientMessageId: input.clientMessageId ?? null,
        attachmentRef: attachment?.fileRef ?? null,
        attachmentMime: attachment?.mimeType ?? null,
        attachmentBytes: attachment?.byteSize ?? null,
        attachmentName: attachment?.name ?? null,
      },
      select: messageSelect,
    });

    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    const memberIds = await memberListOf(conversationId);
    await emitNewMessage(message, memberIds);

    const recipients = memberIds.filter((id) => id !== userId);
    await Promise.all(
      recipients.map((recipientId) =>
        notificationService
          .createNotification(
            recipientId,
            'Tin nhắn mới',
            message.attachmentMime ? 'Bạn có một tệp đính kèm mới trong hội thoại.' : 'Bạn có tin nhắn mới.',
            'MESSAGE',
            conversationId,
            `message:${message.id}:${recipientId}`,
          )
          .catch(() => undefined),
      ),
    );

    return toMessagePayload(message, userId);
  },
};
