import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { Prisma, ReviewTargetType } from '@prisma/client';
import { notificationService } from './notification.service';

/**
 * ĐÁNH GIÁ (Batch 4).
 *
 * Bất biến:
 * 1. Chỉ người THAM GIA hợp lệ mới đánh giá được. Với `TASK`, đó là chủ trọ sở
 *    hữu công việc hoặc thợ ĐƯỢC GIAO, và công việc phải đã `COMPLETED`.
 * 2. Không tự đánh giá chính mình.
 * 3. Không đánh giá trùng: `@@unique([reviewerId, targetType, targetId])` ở DB là
 *    chốt cuối; P2002 được đổi thành 409 thay vì 500.
 * 4. Điểm trung bình được TÍNH từ bảng `reviews` (không lưu ở `users`/
 *    `staff_profiles`), nên không API hồ sơ nào có thể sửa điểm bằng cách gửi
 *    trường `rating`.
 */

const TASK_REVIEW_SELECT = {
  id: true,
  landlordId: true,
  assignedStaffId: true,
  status: true,
  title: true,
} as const;

/** Chỉ hai người này là chủ thể của một công việc. */
const taskParticipants = (task: { landlordId: string; assignedStaffId: string | null }) =>
  [task.landlordId, task.assignedStaffId].filter((id): id is string => Boolean(id));

export const reviewService = {
  /**
   * Tạo đánh giá. `TASK` là loại mới của Batch 4; POST/ROOM/USER giữ nguyên luật
   * cũ (quan hệ giao dịch phải tồn tại) để không phá dữ liệu đang có.
   */
  createReview: async (
    reviewerId: string,
    data: { targetType: ReviewTargetType; targetId: string; rating: number; comment?: string | null },
  ) => {
    const { targetType, targetId, rating, comment } = data;

    if (targetType === 'USER' && targetId === reviewerId) {
      throw new AppError('Bạn không thể tự đánh giá chính mình', 400, 'SELF_REVIEW_FORBIDDEN');
    }

    let counterpartId: string | null = null;

    if (targetType === 'TASK') {
      const task = await prisma.maintenanceTask.findUnique({
        where: { id: targetId },
        select: TASK_REVIEW_SELECT,
      });
      if (!task) throw new AppError('Không tìm thấy công việc', 404);
      if (task.status !== 'COMPLETED') {
        throw new AppError('Chỉ được đánh giá công việc đã hoàn thành', 409, 'TASK_NOT_COMPLETED');
      }
      if (!taskParticipants(task).includes(reviewerId)) {
        // 404 (không phải 403): không lộ sự tồn tại công việc của người khác.
        throw new AppError('Không tìm thấy công việc', 404);
      }
      counterpartId = task.landlordId === reviewerId ? task.assignedStaffId : task.landlordId;
    } else {
      const targetExists =
        targetType === 'POST'
          ? await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } })
          : targetType === 'ROOM'
            ? await prisma.room.findUnique({ where: { id: targetId }, select: { id: true } })
            : await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!targetExists) throw new AppError('Đối tượng đánh giá không tồn tại', 404);

      const isRelated =
        targetType === 'POST'
          ? Boolean(
              await prisma.appointment.findFirst({
                where: { postId: targetId, tenantId: reviewerId, status: 'COMPLETED' },
                select: { id: true },
              }),
            )
          : targetType === 'ROOM'
            ? Boolean(
                await prisma.room.findFirst({
                  where: {
                    id: targetId,
                    OR: [
                      { property: { landlordId: reviewerId } },
                      { contracts: { some: { tenantId: reviewerId } } },
                    ],
                  },
                  select: { id: true },
                }),
              )
            : Boolean(
                await prisma.contract.findFirst({
                  where: {
                    OR: [
                      { tenantId: reviewerId, room: { property: { landlordId: targetId } } },
                      { tenantId: targetId, room: { property: { landlordId: reviewerId } } },
                    ],
                  },
                  select: { id: true },
                }),
              );
      if (!isRelated) {
        throw new AppError('Bạn chưa có quan hệ giao dịch phù hợp để đánh giá đối tượng này', 403, 'REVIEW_FORBIDDEN');
      }
      counterpartId = targetType === 'USER' ? targetId : null;
    }

    let review;
    try {
      review = await prisma.review.create({
        data: { reviewerId, targetType, targetId, rating, comment: comment ?? null },
        include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Bạn đã đánh giá đối tượng này rồi', 409, 'REVIEW_ALREADY_EXISTS');
      }
      throw error;
    }

    if (targetType === 'TASK' && counterpartId) {
      await notificationService
        .notifyUsers(
          [counterpartId],
          {
            title: 'Công việc vừa được đánh giá',
            content: `Bạn vừa nhận được đánh giá ${rating}/5 cho công việc đã hoàn thành.`,
            type: 'REVIEW',
            referenceId: targetId,
          },
          () => `review:${review.id}`,
        )
        .catch(() => undefined);
    }

    return review;
  },

  /** Danh sách đánh giá + điểm trung bình của một đối tượng. */
  getReviewsByTarget: async (targetType: string, targetId: string) => {
    const reviews = await prisma.review.findMany({
      where: { targetType: targetType as ReviewTargetType, targetId },
      include: { reviewer: { select: { fullName: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const averageRating =
      reviews.length > 0 ? Number((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)) : 0;

    return { averageRating, totalReviews: reviews.length, reviews };
  },

  /**
   * Điểm đánh giá của một THỢ, tính từ các đánh giá TASK của những công việc thợ
   * đó được giao. Không lưu cột `rating` trên hồ sơ -> không thể bị ghi đè.
   */
  getStaffRatingSummary: async (staffId: string) => {
    const tasks = await prisma.maintenanceTask.findMany({
      where: { assignedStaffId: staffId, status: 'COMPLETED' },
      select: { id: true },
    });
    const taskIds = tasks.map((task) => task.id);
    if (!taskIds.length) return { averageRating: 0, totalReviews: 0 };

    const result = await prisma.review.aggregate({
      where: { targetType: 'TASK', targetId: { in: taskIds } },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      averageRating: result._avg.rating ? Number(result._avg.rating.toFixed(1)) : 0,
      totalReviews: result._count._all,
    };
  },

  /**
   * Trạng thái đánh giá của MỘT công việc với người xem hiện tại — dùng cho UI
   * (hiện/ẩn form đánh giá) và để biết mình đã đánh giá chưa.
   */
  getTaskReviewState: async (viewerId: string, taskId: string) => {
    const task = await prisma.maintenanceTask.findUnique({
      where: { id: taskId },
      select: TASK_REVIEW_SELECT,
    });
    if (!task || !taskParticipants(task).includes(viewerId)) {
      throw new AppError('Không tìm thấy công việc', 404);
    }

    const myReview = await prisma.review.findUnique({
      where: { reviewerId_targetType_targetId: { reviewerId: viewerId, targetType: 'TASK', targetId: taskId } },
      select: { id: true, rating: true, comment: true, createdAt: true },
    });
    const counterpartId = task.landlordId === viewerId ? task.assignedStaffId : task.landlordId;
    const counterpartReview = counterpartId
      ? await prisma.review.findUnique({
          where: {
            reviewerId_targetType_targetId: {
              reviewerId: counterpartId,
              targetType: 'TASK',
              targetId: taskId,
            },
          },
          select: { id: true, rating: true, comment: true, createdAt: true },
        })
      : null;

    return {
      taskId,
      status: task.status,
      canReview: task.status === 'COMPLETED' && !myReview,
      myReview,
      counterpartReview,
    };
  },
};
