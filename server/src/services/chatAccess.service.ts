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
    if (!actor?.isActive) throw new AppError('Tài khoản của bạn không còn hoạt động', 403);
    if (!target || !target.isActive) throw new AppError('Người dùng không tồn tại hoặc đã bị khóa', 404);

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
      select: { conversationId: true },
    });
    if (!member) throw new AppError('Bạn không có quyền xem cuộc trò chuyện này', 403, 'CHAT_NOT_MEMBER');
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
