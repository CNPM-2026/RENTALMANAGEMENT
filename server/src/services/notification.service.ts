import prisma from '../config/db';
import { io } from '../socket/socket.instance';
import { NotificationType } from '@prisma/client';
import { AppError } from '../utils/AppError';

export const notificationService = {
  // Hàm lõi: Lưu DB và bắn Socket
  createNotification: async (
    userId: string, 
    title: string, 
    content: string, 
    type: NotificationType, 
    referenceId?: string
  ) => {
    // 1. Lưu vào Database
    const noti = await prisma.notification.create({
      data: { userId, title, content, type, referenceId }
    });

    // 2. Bắn Real-time tới đúng user đó (nếu họ đang online)
    if (io) {
      // Gửi tới room 'user_<id>' mà ae mình đã setup lúc kết nối socket
      io.to(`user_${userId}`).emit('new_notification', noti);
    }

    return noti;
  },

  // Lấy danh sách thông báo
  getMyNotifications: async (userId: string) => {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // Lấy 20 cái mới nhất thôi
    });
  },

  // Đánh dấu đã đọc
  markAsRead: async (userId: string, notificationId: string) => {
    const noti = await prisma.notification.findUnique({ where: { id: notificationId } });
    if (!noti || noti.userId !== userId) {
      throw new AppError('Không tìm thấy thông báo', 404);
    }

    return await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });
  },

  // Đánh dấu tất cả đã đọc
  markAllAsRead: async (userId: string) => {
    return await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }
};