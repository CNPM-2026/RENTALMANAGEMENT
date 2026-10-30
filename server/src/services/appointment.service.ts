import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';
import { AppointmentStatus, PostType } from '@prisma/client';

export const appointmentService = {
  createAppointment: async (tenantId: string, data: any) => {
    const { roomId, postId, appointmentTime, note } = data;

    let landlordId = '';
    let targetRoomId = roomId || null;
    
    // 1. Tự động tìm Chủ trọ dựa vào Phòng hoặc Bài đăng
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        include: { property: true }
      });

      if (!room) throw new AppError('Phòng không tồn tại', 404);
      if (room.status !== 'AVAILABLE') throw new AppError('Phòng hiện không sẵn sàng để xem', 400);
      landlordId = room.property.landlordId;
    } else if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { property: true }
      });

      if (!post) throw new AppError('Bài đăng không tồn tại', 404);
      if (post.status !== 'APPROVED' || (post.expiredAt && post.expiredAt <= new Date())) {
        throw new AppError('Bài đăng chưa được duyệt hoặc đã hết hạn', 400);
      }
      if (post.postType !== PostType.RENT_OUT) {
        throw new AppError('Chỉ bài đăng cho thuê phòng mới cho phép đặt lịch xem', 400);
      }

      // Nếu bài đăng gắn với nhà trọ thì lấy landlord của nhà trọ
      // Nếu bài đăng tìm phòng ở ghép (không có property) thì landlord chính là author
      landlordId = post.property ? post.property.landlordId : post.authorId;
      targetRoomId = post.roomId;
    } else {
      throw new AppError('Vui lòng chọn phòng hoặc bài đăng để đặt lịch', 400);
    }

    // Không cho tự đặt lịch với chính mình
    if (landlordId === tenantId) {
      throw new AppError('Bạn không thể tự đặt lịch xem phòng của chính mình', 400);
    }

    // 2. Tạo lịch hẹn
    const newAppointment = await prisma.appointment.create({
      data: {
        tenantId,
        landlordId,
        roomId: targetRoomId,
        postId: postId || null,
        appointmentTime: new Date(appointmentTime),
        note,
        status: 'PENDING'
      },
      include: {
        room: true,
        landlord: { select: { fullName: true, phone: true } }
      }
    });

    // 3. Gửi thông báo cho chủ trọ khi có lịch hẹn mới
    await notificationService.createNotification(
      landlordId,
      'Lịch hẹn mới',
      `Bạn có một lịch hẹn xem phòng mới vào lúc ${new Date(appointmentTime).toLocaleString('vi-VN')}`,
      'APPOINTMENT',
      newAppointment.id
    );

    return newAppointment;
  },

  // Lấy lịch hẹn của tôi (Dùng chung cho cả Tenant, Landlord, Agent)
  getMyAppointments: async (userId: string, role: string) => {
    let whereClause: any = {};

    if (role === 'TENANT') {
      whereClause = { tenantId: userId };
    } else if (role === 'LANDLORD') {
      whereClause = { landlordId: userId };
    } else if (role === 'AGENT') {
      whereClause = { agentId: userId };
    }

    return await prisma.appointment.findMany({
      where: whereClause,
      include: {
        tenant: { select: { fullName: true, phone: true } },
        landlord: { select: { fullName: true, phone: true } },
        room: { select: { roomNumber: true } }
      },
      orderBy: { appointmentTime: 'asc' }
    });
  },

  // Đổi trạng thái lịch hẹn (Xác nhận / Hủy)
  updateStatus: async (userId: string, appointmentId: string, status: AppointmentStatus) => {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId }
    });

    if (!appt) throw new AppError('Không tìm thấy lịch hẹn', 404);

    // Chỉ người gửi hoặc người nhận mới có quyền đổi trạng thái
    if (appt.tenantId !== userId && appt.landlordId !== userId) {
      throw new AppError('Bạn không có quyền thay đổi lịch hẹn này', 403);
    }
    if (appt.status === 'PENDING' && status === 'CONFIRMED' && appt.landlordId !== userId) {
      throw new AppError('Chỉ chủ trọ mới được xác nhận lịch hẹn', 403);
    }
    if (appt.status === 'CONFIRMED' && status === 'COMPLETED' && appt.landlordId !== userId) {
      throw new AppError('Chỉ chủ trọ mới được hoàn tất lịch hẹn', 403);
    }
    const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['COMPLETED', 'CANCELLED'],
      CANCELLED: [],
      COMPLETED: [],
    };
    if (!transitions[appt.status].includes(status)) {
      throw new AppError(`Không thể chuyển lịch hẹn từ ${appt.status} sang ${status}`, 400);
    }

    return await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status }
    });
  }
};