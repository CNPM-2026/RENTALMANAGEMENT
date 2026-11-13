import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';

const activeRoommatePostWhere = () => ({
  status: 'APPROVED' as const,
  postType: 'FIND_ROOMMATE' as const,
  OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
});

const findActiveRoommatePost = (authorId: string) =>
  prisma.post.findFirst({
    where: { authorId, ...activeRoommatePostWhere() },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, roomId: true },
  });

/**
 * Gửi / xử lý lời mời ở ghép.
 *
 * Khi chấp nhận:
 *  - Tin ở ghép được gắn với phòng của NGƯỜI ĐỒNG Ý (chủ tin) → lấy hợp đồng ACTIVE
 *    của họ làm nguồn sự thật.
 *  - Số người hiện tại lấy từ khai báo còn hiệu lực (PENDING/VERIFIED), đồng thời
 *    không nhỏ hơn số hợp đồng ACTIVE của phòng.
 *  - Nếu +1 vượt `rooms.maxOccupants`, lời mời bị TỰ ĐỘNG TỪ CHỐI; cả người gửi,
 *    người nhận và chủ trọ đều nhận thông báo nêu rõ sức chứa.
 *  - Nếu còn chỗ, một khai báo số người PENDING được tạo để chủ trọ xác minh.
 */
export const roommateInvitationService = {
  create: async (senderId: string, data: { recipientId: string; postId?: string; message?: string }) => {
    if (senderId === data.recipientId) throw new AppError('Không thể tự gửi lời mời cho chính mình', 400);
    const recipient = await prisma.user.findFirst({
      where: { id: data.recipientId, isActive: true, role: 'TENANT' },
      select: { id: true, fullName: true },
    });
    if (!recipient) throw new AppError('Người nhận không hợp lệ', 404);

    let postId = data.postId ?? null;
    if (postId) {
      const post = await prisma.post.findFirst({
        where: { id: postId, authorId: data.recipientId, ...activeRoommatePostWhere() },
        select: { id: true },
      });
      if (!post) {
        throw new AppError('Bài đăng ở ghép không còn hiệu lực hoặc không thuộc người nhận', 400);
      }
    } else {
      // Client cũ chỉ gửi recipientId. Tự gắn với tin ở ghép đang hiệu lực gần nhất
      // để luồng chấp nhận có đủ dữ liệu phòng/sức chứa.
      postId = (await findActiveRoommatePost(data.recipientId))?.id ?? null;
    }

    const existing = await prisma.roommateInvitation.findUnique({
      where: { senderId_recipientId: { senderId, recipientId: data.recipientId } },
    });
    if (existing && existing.status !== 'PENDING') {
      throw new AppError('Lời mời trước đó đã được xử lý, không thể ghi đè lịch sử', 409);
    }
    const invitation = existing
      ? await prisma.roommateInvitation.update({
          where: { id: existing.id },
          data: { message: data.message, postId: postId ?? existing.postId },
        })
      : await prisma.roommateInvitation.create({
          data: { senderId, recipientId: data.recipientId, postId, message: data.message },
        });
    if (!existing) {
      await notificationService.createNotification(
        data.recipientId,
        'Lời mời kết nối mới',
        'Bạn nhận được lời mời tìm bạn ở ghép.',
        'SYSTEM',
        invitation.id,
        `roommate-invitation:${invitation.id}:received`,
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
    const invitation = await prisma.roommateInvitation.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, fullName: true } },
        recipient: { select: { id: true, fullName: true } },
        post: { select: { id: true, title: true, roomId: true } },
      },
    });
    if (!invitation) throw new AppError('Không tìm thấy lời mời', 404);
    const owns = status === 'CANCELLED' ? invitation.senderId === userId : invitation.recipientId === userId;
    if (!owns) throw new AppError('Bạn không có quyền xử lý lời mời này', 403);
    if (invitation.status !== 'PENDING') throw new AppError('Lời mời đã được xử lý', 400);

    if (status === 'ACCEPTED') {
      return roommateInvitationService.accept(invitation);
    }

    const updated = await prisma.roommateInvitation.update({ where: { id }, data: { status } });
    if (status === 'DECLINED') {
      await notificationService.createNotification(
        invitation.senderId,
        'Lời mời kết nối đã bị từ chối',
        `${invitation.recipient.fullName} đã từ chối lời mời ở ghép của bạn.`,
        'SYSTEM',
        invitation.id,
        `roommate-invitation:${invitation.id}:declined`,
      );
    } else {
      await notificationService.createNotification(
        invitation.recipientId,
        'Lời mời kết nối đã được hủy',
        `${invitation.sender.fullName} đã hủy lời mời ở ghép.`,
        'SYSTEM',
        invitation.id,
        `roommate-invitation:${invitation.id}:cancelled`,
      );
    }
    return updated;
  },

  accept: async (
    invitation: {
      id: string;
      senderId: string;
      recipientId: string;
      postId: string | null;
      sender: { id: string; fullName: string };
      recipient: { id: string; fullName: string };
      post: { id: string; title: string; roomId: string | null } | null;
    },
  ) => {
    const post = invitation.post ?? (await findActiveRoommatePost(invitation.recipientId));
    const hostContract = await prisma.contract.findFirst({
      where: {
        tenantId: invitation.recipientId,
        status: 'ACTIVE',
        ...(post?.roomId ? { roomId: post.roomId } : {}),
      },
      orderBy: { startDate: 'desc' },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            maxOccupants: true,
            property: { select: { id: true, name: true, landlordId: true } },
          },
        },
      },
    });

    if (!hostContract) {
      throw new AppError(
        'Người đăng tin chưa có hợp đồng thuê đang hiệu lực nên chưa thể xác nhận ở ghép.',
        400,
        'ROOMMATE_HOST_HAS_NO_ACTIVE_CONTRACT',
      );
    }

    const room = hostContract.room;
    const [currentDeclaration, activeContractCount] = await Promise.all([
      prisma.roomOccupancyDeclaration.findFirst({
        where: {
          roomId: room.id,
          tenantId: invitation.recipientId,
          status: { in: ['PENDING', 'VERIFIED'] },
          supersededAt: null,
        },
        orderBy: { declaredAt: 'desc' },
        select: { id: true, occupants: true },
      }),
      prisma.contract.count({ where: { roomId: room.id, status: 'ACTIVE' } }),
    ]);

    const occupiedBefore = Math.max(
      currentDeclaration?.occupants ?? 0,
      activeContractCount,
      1,
    );
    const nextOccupants = occupiedBefore + 1;

    if (nextOccupants > room.maxOccupants) {
      const updated = await prisma.$transaction(async (tx) => {
        // `InvitationStatus` không có REJECTED; DECLINED là trạng thái từ chối.
        // Cờ `autoRejected` trong response cho client biết đây là từ chối hệ thống.
        const claimed = await tx.roommateInvitation.updateMany({
          where: { id: invitation.id, status: 'PENDING' },
          data: { status: 'DECLINED' },
        });
        if (claimed.count !== 1) {
          throw new AppError('Lời mời vừa được xử lý bởi request khác', 409, 'INVITATION_ALREADY_DECIDED');
        }
        return tx.roommateInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
      });

      const reason = `Phòng ${room.roomNumber} chỉ cho phép tối đa ${room.maxOccupants} người, hiện dự kiến ${occupiedBefore} người. Không thể thêm ${invitation.sender.fullName} ở ghép.`;
      await notificationService.notifyUsers(
        [invitation.senderId, invitation.recipientId, room.property.landlordId],
        {
          title: 'Yêu cầu ở ghép bị từ chối tự động',
          content: reason,
          type: 'OCCUPANCY',
          referenceId: room.id,
        },
        (recipientId) => `roommate-invitation:${invitation.id}:capacity-rejected:${recipientId}`,
      );

      return {
        ...updated,
        autoRejected: true,
        rejectionReason: reason,
        capacity: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          maxOccupants: room.maxOccupants,
          occupiedBefore,
          requestedOccupants: nextOccupants,
        },
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.roommateInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });
      if (claimed.count !== 1) {
        throw new AppError('Lời mời vừa được xử lý bởi request khác', 409, 'INVITATION_ALREADY_DECIDED');
      }

      let declaration: { id: string; occupants: number } | null = null;
      if (!currentDeclaration || currentDeclaration.occupants !== nextOccupants) {
        const now = new Date();
        await tx.roomOccupancyDeclaration.updateMany({
          where: {
            roomId: room.id,
            tenantId: invitation.recipientId,
            status: { in: ['PENDING', 'VERIFIED'] },
            supersededAt: null,
          },
          data: { status: 'SUPERSEDED', supersededAt: now },
        });
        declaration = await tx.roomOccupancyDeclaration.create({
          data: {
            roomId: room.id,
            tenantId: invitation.recipientId,
            contractId: hostContract.id,
            occupants: nextOccupants,
            status: 'PENDING',
            declaredById: invitation.recipientId,
          },
          select: { id: true, occupants: true },
        });
      }

      return {
        updated: await tx.roommateInvitation.findUniqueOrThrow({ where: { id: invitation.id } }),
        declaration,
      };
    });

    await notificationService.createNotification(
      invitation.senderId,
      'Lời mời ở ghép được chấp nhận',
      `${invitation.recipient.fullName} đã chấp nhận bạn vào ở ghép tại phòng ${room.roomNumber}. Chủ trọ sẽ xác minh số người ở.`,
      'OCCUPANCY',
      result.declaration?.id ?? invitation.id,
      `roommate-invitation:${invitation.id}:accepted`,
    );

    await notificationService.createNotification(
      room.property.landlordId,
      'Có người ở ghép mới cần xác minh',
      `${invitation.recipient.fullName} đã chấp nhận ${invitation.sender.fullName} ở ghép phòng ${room.roomNumber}. Số người dự kiến: ${nextOccupants}/${room.maxOccupants}. Vui lòng xác minh khai báo số người.`,
      'OCCUPANCY',
      result.declaration?.id ?? room.id,
      `roommate-invitation:${invitation.id}:landlord-capacity`,
    );

    return {
      ...result.updated,
      autoRejected: false,
      capacity: {
        roomId: room.id,
        roomNumber: room.roomNumber,
        maxOccupants: room.maxOccupants,
        occupiedBefore,
        requestedOccupants: nextOccupants,
      },
      occupancyDeclarationId: result.declaration?.id ?? null,
    };
  },
};
