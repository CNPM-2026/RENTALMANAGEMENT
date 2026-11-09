import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';

export const roommateInvitationService = {
  create: async (senderId: string, data: { recipientId: string; postId?: string; message?: string }) => {
    if (senderId === data.recipientId) throw new AppError('Không thể tự gửi lời mời cho chính mình', 400);
    const recipient = await prisma.user.findFirst({ where: { id: data.recipientId, isActive: true, role: 'TENANT' }, select: { id: true } });
    if (!recipient) throw new AppError('Người nhận không hợp lệ', 404);
    const existing = await prisma.roommateInvitation.findUnique({
      where: { senderId_recipientId: { senderId, recipientId: data.recipientId } },
    });
    if (existing && existing.status !== 'PENDING') {
      throw new AppError('Lời mời trước đó đã được xử lý, không thể ghi đè lịch sử', 409);
    }
    const invitation = existing
      ? await prisma.roommateInvitation.update({
          where: { id: existing.id },
          data: { message: data.message, postId: data.postId },
        })
      : await prisma.roommateInvitation.create({
          data: { senderId, recipientId: data.recipientId, postId: data.postId, message: data.message },
        });
    if (!existing) {
      await notificationService.createNotification(
        data.recipientId,
        'Lời mời kết nối mới',
        'Bạn nhận được lời mời tìm bạn ở ghép.',
        'SYSTEM',
        invitation.id
      );
    }
    return invitation;
  },
  getMine: (userId: string, type: 'received' | 'sent') => prisma.roommateInvitation.findMany({
    where: type === 'received' ? { recipientId: userId } : { senderId: userId },
    include: {
      sender: { select: { id: true, fullName: true, avatarUrl: true, profile: true } },
      recipient: { select: { id: true, fullName: true, avatarUrl: true, profile: true } },
      post: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  }),
  updateStatus: async (userId: string, id: string, status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED') => {
    const invitation = await prisma.roommateInvitation.findUnique({ where: { id } });
    if (!invitation) throw new AppError('Không tìm thấy lời mời', 404);
    const owns = status === 'CANCELLED' ? invitation.senderId === userId : invitation.recipientId === userId;
    if (!owns) throw new AppError('Bạn không có quyền xử lý lời mời này', 403);
    if (invitation.status !== 'PENDING') throw new AppError('Lời mời đã được xử lý', 400);
    const updated = await prisma.roommateInvitation.update({ where: { id }, data: { status } });
    if (status !== 'CANCELLED') {
      await notificationService.createNotification(
        invitation.senderId,
        'Cập nhật lời mời kết nối',
        `Lời mời kết nối của bạn đã được ${status === 'ACCEPTED' ? 'chấp nhận' : 'từ chối'}.`,
        'SYSTEM',
        invitation.id
      );
    }
    return updated;
  },
};
