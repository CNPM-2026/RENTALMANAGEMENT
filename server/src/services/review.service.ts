import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { ReviewTargetType } from '@prisma/client';

export const reviewService = {
  // 1. Tạo đánh giá
  createReview: async (reviewerId: string, data: any) => {
    const { targetType, targetId, rating, comment } = data;

    // Không cho tự đánh giá bản thân
    if (targetType === 'USER' && targetId === reviewerId) {
      throw new AppError('Bạn không thể tự đánh giá chính mình', 400);
    }
    const targetExists = targetType === 'POST'
      ? await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } })
      : targetType === 'ROOM'
        ? await prisma.room.findUnique({ where: { id: targetId }, select: { id: true } })
        : await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!targetExists) throw new AppError('Đối tượng đánh giá không tồn tại', 404);

    // Check xem đã đánh giá chưa (Mỗi người chỉ được đánh giá 1 lần / 1 đối tượng)
    const existingReview = await prisma.review.findUnique({
      where: {
        reviewerId_targetType_targetId: { reviewerId, targetType: targetType as ReviewTargetType, targetId }
      }
    });
    if (existingReview) {
      throw new AppError('Bạn đã đánh giá đối tượng này rồi', 400);
    }

    // Tạo đánh giá
    return await prisma.review.create({
      data: {
        reviewerId,
        targetType: targetType as ReviewTargetType,
        targetId,
        rating,
        comment
      },
      include: {
        reviewer: { select: { fullName: true, avatarUrl: true } }
      }
    });
  },

  // 2. Lấy danh sách đánh giá và Điểm trung bình của 1 đối tượng
  getReviewsByTarget: async (targetType: string, targetId: string) => {
    // Lấy danh sách review
    const reviews = await prisma.review.findMany({
      where: { targetType: targetType as ReviewTargetType, targetId },
      include: {
        reviewer: { select: { fullName: true, avatarUrl: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Tính điểm trung bình
    const avgRating = reviews.length > 0 
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
      : 0;

    return {
      averageRating: Number(avgRating),
      totalReviews: reviews.length,
      reviews
    };
  }
};