import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const chatService = {
  // Tạo hoặc lấy cuộc trò chuyện 1-1 giữa 2 người
  getOrCreateConversation: async (myId: string, targetUserId: string) => {
    if (myId === targetUserId) throw new AppError('Không thể tự nhắn tin với chính mình', 400);
    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, isActive: true } });
    if (!target?.isActive) throw new AppError('Người dùng không tồn tại hoặc đã bị khóa', 404);

    // Tìm xem đã có cuộc trò chuyện nào chứa đúng 2 người này chưa
    const existingConv = await prisma.conversation.findFirst({
      where: {
        AND: [
          { members: { some: { userId: myId } } },
          { members: { some: { userId: targetUserId } } },
          { members: { every: { userId: { in: [myId, targetUserId] } } } }
        ]
      },
      include: { members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } }
    });

    if (existingConv) return existingConv;

    // Nếu chưa có thì tạo mới
    return await prisma.conversation.create({
      data: {
        members: {
          create: [{ userId: myId }, { userId: targetUserId }]
        }
      },
      include: { members: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } }
    });
  },

  // Lấy danh sách các cuộc trò chuyện của tôi (Kèm tin nhắn cuối cùng)
  getMyConversations: async (userId: string) => {
    return await prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { 
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } 
        },
        messages: {
          take: 1, // Chỉ lấy tin nhắn mới nhất
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { fullName: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  },

  // Lấy lịch sử tin nhắn của 1 cuộc trò chuyện (Phân trang)
  getMessages: async (userId: string, conversationId: string, page: number = 1, limit: number = 20) => {
    // Check xem user có nằm trong cuộc trò chuyện này không
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } }
    });
    if (!member) throw new AppError('Bạn không có quyền xem cuộc trò chuyện này', 403);

    const skip = (page - 1) * limit;

    return await prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' }, // Lấy mới nhất trước
      skip,
      take: limit
    });
  }
};