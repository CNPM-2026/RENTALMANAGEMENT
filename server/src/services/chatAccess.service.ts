import prisma from '../config/db';
import { AppError } from '../utils/AppError';

/**
 * PHÂN QUYỀN HỘI THOẠI (Batch 5).
 *
 * Trước Batch 5, `POST /chats/conversations` cho phép hai tài khoản BẤT KỲ (đang
 * hoạt động) mở hội thoại. Với marketplace thợ, điều đó có nghĩa một thợ có thể
 * nhắn tin cho bất kỳ khách thuê nào trong hệ thống — không cần quan hệ công việc.
 *
 * Bảng quyền (role lấy từ DB, không lấy từ token/body):
 *
 * | Cặp                         | Điều kiện                                    |
 * |-----------------------------|----------------------------------------------|
 * | có ADMIN                    | luôn được (hỗ trợ / xử lý tranh chấp)        |
 * | TENANT ↔ LANDLORD           | được (liên hệ về tin đăng/phòng)             |
 * | STAFF ↔ LANDLORD            | phải có công việc: được giao HOẶC đã ứng tuyển|
 * | STAFF ↔ TENANT              | phải có công việc thợ được giao cho sự cố của khách thuê |
 * | cùng role (tenant/landlord/staff) | được (bạn ở ghép, đối tác)              |
 *
 * Hội thoại STAFF ↔ LANDLORD/TENANT được NEO vào `taskId`; quyền thành viên vẫn
 * được kiểm tra lại ở mọi lần đọc/ghi, nên huỷ công việc không tự động cấp quyền
 * cho hội thoại khác.
 */

type AccountRow = { id: string; role: string; isActive: boolean };

const loadAccounts = async (actorId: string, targetUserId: string): Promise<[AccountRow?, AccountRow?]> => {
  const rows = await prisma.user.findMany({
    where: { id: { in: [actorId, targetUserId] } },
    select: { id: true, role: true, isActive: true },
  });
  return [rows.find((row) => row.id === actorId), rows.find((row) => row.id === targetUserId)];
};

export const chatAccessService = {
  /**
   * Xác định phạm vi hội thoại giữa hai tài khoản.
   * Trả `{ taskId }` (có thể null). Ném 403 `CHAT_RELATION_REQUIRED` khi cặp
   * STAFF ↔ LANDLORD/TENANT chưa có công việc chung.
   */
  resolveScope: async (actorId: string, targetUserId: string): Promise<{ taskId: string | null }> => {
    if (!targetUserId) throw new AppError('Người nhận không hợp lệ', 400);
    if (actorId === targetUserId) throw new AppError('Không thể tự nhắn tin với chính mình', 400);

    const [actor, target] = await loadAccounts(actorId, targetUserId);
    if (!actor) throw new AppError('Người dùng không tồn tại', 404);
    if (!target) throw new AppError('Người dùng không tồn tại hoặc đã bị khóa', 404);

    // Người dùng bị ban chỉ có thể chat với Quản trị viên (ADMIN)
    if (!actor.isActive) {
      if (target.role !== 'ADMIN') {
        throw new AppError('Tài khoản của bạn đã bị khóa và chỉ có thể nhắn tin với Quản trị viên', 403, 'ACCOUNT_BANNED');
      }
    }
    if (!target.isActive) {
      if (actor.role !== 'ADMIN') {
        throw new AppError('Người dùng này đã bị khóa tài khoản', 403, 'TARGET_USER_BANNED');
      }
    }

    if (actor.role === 'ADMIN' || target.role === 'ADMIN') return { taskId: null };
    if (actor.role === 'TENANT' && target.role === 'LANDLORD') return { taskId: null };
    if (actor.role === 'LANDLORD' && target.role === 'TENANT') return { taskId: null };

    const staffFirst = actor.role === 'STAFF' && (target.role === 'LANDLORD' || target.role === 'TENANT');
    const staffSecond = target.role === 'STAFF' && (actor.role === 'LANDLORD' || actor.role === 'TENANT');
    if (!staffFirst && !staffSecond) return { taskId: null };

    const staffId = staffFirst ? actor.id : target.id;
    const otherId = staffFirst ? target.id : actor.id;
    const otherIsLandlord = (staffFirst ? target.role : actor.role) === 'LANDLORD';

    const task = await prisma.maintenanceTask.findFirst({
      where: {
        OR: [
          {
            assignedStaffId: staffId,
            ...(otherIsLandlord ? { landlordId: otherId } : { sourceIssue: { tenantId: otherId } }),
          },
          ...(otherIsLandlord ? [{ landlordId: otherId, applications: { some: { staffId } } }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    if (!task) {
      throw new AppError(
        'Bạn chỉ có thể nhắn tin với người này trong phạm vi một công việc chung',
        403,
        'CHAT_RELATION_REQUIRED',
      );
    }
    return { taskId: task.id };
  },

  /** Thành viên hội thoại — điều kiện duy nhất để đọc/ghi tin nhắn. */
  assertMember: async (userId: string, conversationId: string) => {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true, user: { select: { id: true, role: true, isActive: true } } },
    });
    if (!member) throw new AppError('Bạn không có quyền xem cuộc trò chuyện này', 403, 'CHAT_NOT_MEMBER');

    const otherMembers = await prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: userId } },
      select: { user: { select: { id: true, role: true, isActive: true } } },
    });

    if (!member.user.isActive) {
      const hasAdmin = otherMembers.some((m) => m.user.role === 'ADMIN');
      if (!hasAdmin) {
        throw new AppError('Tài khoản của bạn đã bị khóa và chỉ có thể nhắn tin với Quản trị viên', 403, 'ACCOUNT_BANNED');
      }
    } else if (member.user.role !== 'ADMIN' && otherMembers.some((m) => !m.user.isActive)) {
      throw new AppError('Người dùng trong cuộc trò chuyện này đã bị khóa tài khoản', 403, 'USER_BANNED');
    }

    return member;
  },

  /** Danh sách id người nhận còn lại của hội thoại (đã lọc trùng). */
  recipientsOf: async (conversationId: string, senderId: string) => {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  },
};
