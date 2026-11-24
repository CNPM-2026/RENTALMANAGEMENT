import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';
import { AppointmentStatus, PostType } from '@prisma/client';

export const appointmentService = {
  createAppointment: async (tenantId: string, data: any) => {
    const { roomId, postId, appointmentTime, note } = data;
    const parsedAppointmentTime = new Date(appointmentTime);
    if (Number.isNaN(parsedAppointmentTime.getTime()) || parsedAppointmentTime.getTime() < Date.now() + 60 * 60 * 1000) {
      throw new AppError('Thời gian xem phòng phải cách thời điểm hiện tại ít nhất 1 tiếng', 400);
    }

    let landlordId = '';
    let targetRoomId = roomId || null;

    if (roomId && postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { roomId: true, propertyId: true },
      });
      if (post && post.roomId && post.roomId !== roomId) {
        throw new AppError('Phòng không khớp với bài đăng đã chọn', 400);
      }
    }
    
    // 1. Tự động tìm Chủ trọ dựa vào Phòng hoặc Bài đăng
    if (roomId) {
      let room = await prisma.room.findUnique({
        where: { id: roomId },
        include: {
          property: true,
          contracts: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
        }
      });

      // Nếu không tìm thấy phòng theo id, có thể client truyền nhầm postId vào roomId
      if (!room) {
        const post = await prisma.post.findUnique({
          where: { id: roomId },
          include: {
            property: true,
            room: {
              include: {
                property: true,
                contracts: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
              },
            },
          }
        });

        if (post) {
          if (post.status !== 'APPROVED' || (post.expiredAt && post.expiredAt <= new Date())) {
            throw new AppError('Bài đăng chưa được duyệt hoặc đã hết hạn', 400);
          }
          if (post.postType !== PostType.RENT_OUT) {
            throw new AppError('Chỉ bài đăng cho thuê phòng mới cho phép đặt lịch xem', 400);
          }
          if (post.room) {
            room = post.room;
            targetRoomId = post.room.id;
          } else {
            targetRoomId = null;
          }
          landlordId = post.property ? post.property.landlordId : post.authorId;
        }
      }

      if (!room && !landlordId) throw new AppError('Phòng không tồn tại', 404);
      if (room) {
        if (room.status !== 'AVAILABLE' || room.contracts.length > 0) {
          throw new AppError('Phòng hiện không sẵn sàng để xem', 400);
        }
        landlordId = room.property.landlordId;
      }
    } else if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          property: true,
          room: {
            select: {
              id: true,
              status: true,
              contracts: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
            },
          },
        }
      });

      if (!post) throw new AppError('Bài đăng không tồn tại', 404);
      if (post.status !== 'APPROVED' || (post.expiredAt && post.expiredAt <= new Date())) {
        throw new AppError('Bài đăng chưa được duyệt hoặc đã hết hạn', 400);
      }
      if (post.postType !== PostType.RENT_OUT) {
        throw new AppError('Chỉ bài đăng cho thuê phòng mới cho phép đặt lịch xem', 400);
      }
      // Bài đăng trỏ tới một phòng cụ thể: phòng đã thuê/bảo trì thì không còn
      // lịch xem nào hợp lệ, kể cả khi tin đăng chưa kịp đóng.
      if (post.roomId && (!post.room || post.room.status !== 'AVAILABLE' || post.room.contracts.length > 0)) {
        throw new AppError('Phòng trong bài đăng đã có người thuê hoặc không sẵn sàng để xem', 400);
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
        appointmentTime: parsedAppointmentTime,
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

  // Lấy lịch hẹn của tôi (Dùng chung cho Tenant và Landlord)
  getMyAppointments: async (userId: string, role: string) => {
    let whereClause: any = {};

    if (role === 'TENANT') {
      whereClause = { tenantId: userId };
    } else if (role === 'LANDLORD') {
      whereClause = { landlordId: userId };
    } else {
      // `/tenant/appointments` là route dùng chung: ADMIN (hoặc STAFF không có
      // membership) mở được trang nhưng không có "lịch hẹn cá nhân" ⇒ trả rỗng
      // thay vì 403. Nhân viên có membership đã được controller đổi role thành
      // LANDLORD và scope theo chủ trọ.
      whereClause = { tenantId: userId };
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
    if (appt.status === 'CONFIRMED' && status === 'COMPLETED' && appt.landlordId !== userId && appt.tenantId !== userId) {
      throw new AppError('Bạn không có quyền hoàn tất lịch hẹn', 403);
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

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status }
    });
    const recipientId = userId === appt.tenantId ? appt.landlordId : appt.tenantId;
    await notificationService.createNotification(
      recipientId,
      'Cập nhật lịch hẹn',
      `Lịch hẹn xem phòng đã được cập nhật: ${status.toLowerCase()}.`,
      'APPOINTMENT',
      appt.id
    );
    return updatedAppointment;
  }
};