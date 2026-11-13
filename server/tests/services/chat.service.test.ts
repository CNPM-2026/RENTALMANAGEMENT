import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatService } from '../../src/services/chat.service';

/**
 * CHAT (Batch 5) — Prisma + socket mock toàn bộ.
 *
 * Trọng tâm là lỗi realtime gốc "tin nhắn hiện hai lần": server chỉ được phát
 * `receive_message` vào phòng RIÊNG `user_<id>` của từng thành viên, mỗi người
 * đúng MỘT lần — không phát vào `conversation_<id>` nữa.
 * Kèm theo: retry `clientMessageId` idempotent (không tạo tin thứ hai, không phát
 * lại), tệp đính kèm là asset private (payload chỉ có URL có token theo người xem).
 */
const mocks = vi.hoisted(() => ({
  assertMember: vi.fn(),
  to: vi.fn(),
  emit: vi.fn(),
  mint: vi.fn(),
  messageFindUnique: vi.fn(),
  messageCreate: vi.fn(),
  conversationUpdate: vi.fn(),
  memberFindMany: vi.fn(),
  keywordFindMany: vi.fn(),
  createNotification: vi.fn(),
}));

vi.mock('../../src/config/db', () => ({
  default: {
    message: { findUnique: mocks.messageFindUnique, create: mocks.messageCreate },
    conversation: { update: mocks.conversationUpdate },
    conversationMember: { findMany: mocks.memberFindMany },
    contentFilterKeyword: { findMany: mocks.keywordFindMany },
  },
}));

vi.mock('../../src/socket/socket.instance', () => ({
  io: { to: mocks.to },
}));

vi.mock('../../src/services/chatAccess.service', () => ({
  chatAccessService: { assertMember: mocks.assertMember },
}));

vi.mock('../../src/services/chatAttachment.service', () => ({
  mintChatAttachmentUrl: mocks.mint,
}));

vi.mock('../../src/services/notification.service', () => ({
  notificationService: { createNotification: mocks.createNotification },
}));

const CONVERSATION_ID = 'conv-1';
const LANDLORD_ID = 'landlord-1';
const STAFF_ID = 'staff-1';

const messageRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'message-1',
  conversationId: CONVERSATION_ID,
  senderId: LANDLORD_ID,
  messageType: 'TEXT',
  content: 'Chào bạn',
  isRead: false,
  createdAt: new Date('2026-11-12T10:00:00.000Z'),
  attachmentRef: null,
  attachmentMime: null,
  attachmentBytes: null,
  attachmentName: null,
  sender: { id: LANDLORD_ID, fullName: 'Chủ trọ A', avatarUrl: null },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.to.mockReturnValue({ emit: mocks.emit });
  mocks.assertMember.mockResolvedValue(undefined);
  mocks.messageFindUnique.mockResolvedValue(null);
  mocks.messageCreate.mockResolvedValue(messageRow());
  mocks.conversationUpdate.mockResolvedValue({ id: CONVERSATION_ID });
  mocks.memberFindMany.mockResolvedValue([{ userId: LANDLORD_ID }, { userId: STAFF_ID }]);
  mocks.keywordFindMany.mockResolvedValue([]);
  mocks.mint.mockImplementation((messageId: string, viewerId: string) => `signed:${messageId}:${viewerId}`);
  mocks.createNotification.mockResolvedValue({ id: 'notification-1' });
});


describe('chatService.sendMessage — phát realtime', () => {
  it('mỗi thành viên nhận ĐÚNG MỘT event vào phòng riêng, không phát vào phòng hội thoại', async () => {
    mocks.memberFindMany.mockResolvedValue([
      { userId: LANDLORD_ID },
      { userId: STAFF_ID },
      { userId: LANDLORD_ID }, // dữ liệu trùng -> vẫn chỉ một lần
    ]);

    await chatService.sendMessage(LANDLORD_ID, CONVERSATION_ID, { content: 'Chào bạn' });

    expect(mocks.to).toHaveBeenCalledTimes(2);
    const rooms = mocks.to.mock.calls.map((call) => call[0]);
    expect(rooms).toEqual([`user_${LANDLORD_ID}`, `user_${STAFF_ID}`]);
    expect(rooms.some((room) => room.startsWith('conversation_'))).toBe(false);
    expect(mocks.emit).toHaveBeenCalledTimes(2);
    expect(mocks.emit.mock.calls.every((call) => call[0] === 'receive_message')).toBe(true);
  });

  it('không gửi thông báo cho chính người gửi', async () => {
    await chatService.sendMessage(LANDLORD_ID, CONVERSATION_ID, { content: 'Chào bạn' });

    expect(mocks.createNotification).toHaveBeenCalledTimes(1);
    expect(mocks.createNotification).toHaveBeenCalledWith(
      STAFF_ID,
      'Tin nhắn mới',
      'Bạn có tin nhắn mới.',
      'MESSAGE',
      CONVERSATION_ID,
      'message:message-1:staff-1',
    );
  });
});

describe('chatService.sendMessage — idempotent theo clientMessageId', () => {
  it('retry cùng clientMessageId trả lại tin cũ, KHÔNG tạo mới và KHÔNG phát lại', async () => {
    mocks.messageFindUnique.mockResolvedValue(messageRow());

    const payload = await chatService.sendMessage(LANDLORD_ID, CONVERSATION_ID, {
      content: 'Chào bạn',
      clientMessageId: 'client-1',
    });

    expect(payload.id).toBe('message-1');
    expect(mocks.messageCreate).not.toHaveBeenCalled();
    expect(mocks.emit).not.toHaveBeenCalled();
    expect(mocks.createNotification).not.toHaveBeenCalled();
  });
});

describe('chatService.sendMessage — tệp đính kèm private', () => {
  it('chỉ có tệp: lưu tên tệp làm nội dung, messageType=IMAGE, payload có URL ký theo người xem', async () => {
    mocks.messageCreate.mockResolvedValue(
      messageRow({
        messageType: 'IMAGE',
        content: 'hoa-don.jpg',
        attachmentRef: 'rental-management/chat/abc',
        attachmentMime: 'image/jpeg',
        attachmentBytes: 2048,
        attachmentName: 'hoa-don.jpg',
      }),
    );

    const payload = await chatService.sendMessage(STAFF_ID, CONVERSATION_ID, {
      attachment: {
        fileRef: 'rental-management/chat/abc',
        mimeType: 'image/jpeg',
        byteSize: 2048,
        name: 'hoa-don.jpg',
      },
    });

    expect(mocks.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: CONVERSATION_ID,
        senderId: STAFF_ID,
        content: 'hoa-don.jpg',
        messageType: 'IMAGE',
        attachmentRef: 'rental-management/chat/abc',
      }),
      select: expect.any(Object),
    });
    // `attachmentRef` (public_id Cloudinary) không bao giờ rời server.
    expect(payload).not.toHaveProperty('attachmentRef');
    expect(payload.attachment).toMatchObject({
      url: `signed:message-1:${STAFF_ID}`,
      mimeType: 'image/jpeg',
      byteSize: 2048,
      name: 'hoa-don.jpg',
    });
    // Mỗi người xem có token riêng.
    const emittedPayloads = mocks.emit.mock.calls.map((call) => call[1]);
    expect(emittedPayloads.map((p) => p.attachment.url)).toEqual([
      `signed:message-1:${LANDLORD_ID}`,
      `signed:message-1:${STAFF_ID}`,
    ]);
  });
});

describe('chatService.sendMessage — kiểm tra nội dung', () => {
  it('tin rỗng (không có tệp) -> 400 MESSAGE_EMPTY, không ghi', async () => {
    await expect(
      chatService.sendMessage(LANDLORD_ID, CONVERSATION_ID, { content: '   ' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MESSAGE_EMPTY' });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it('từ khoá bị cấm -> 400 MESSAGE_BANNED_KEYWORD, không ghi', async () => {
    mocks.keywordFindMany.mockResolvedValue([{ keyword: 'lừa đảo' }]);

    await expect(
      chatService.sendMessage(LANDLORD_ID, CONVERSATION_ID, { content: 'Đây là lừa đảo' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'MESSAGE_BANNED_KEYWORD' });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });

  it('người không thuộc hội thoại bị chặn bởi assertMember trước khi ghi', async () => {
    mocks.assertMember.mockRejectedValue(new Error('forbidden'));

    await expect(
      chatService.sendMessage('stranger', CONVERSATION_ID, { content: 'x' }),
    ).rejects.toThrow('forbidden');
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
});
