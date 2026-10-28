import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostStatus } from '@prisma/client';
import { notificationService } from './notification.service';

export const adminService = {
  // Lấy danh sách bài chờ duyệt
  getPendingPosts: async () => {
    return await prisma.post.findMany({
      where: { status: 'PENDING' },
      include: {
        author: { select: { fullName: true, email: true } },
        images: true,
        room: true
      },
      orderBy: { createdAt: 'asc' } // Cũ nhất xếp trước để duyệt
    });
  },

  // Duyệt hoặc từ chối bài
  updatePostStatus: async (postId: string, status: PostStatus) => {
    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) throw new AppError('Không tìm thấy bài đăng', 404);

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: { status }
    });

    // Gửi thông báo cho tác giả khi bài đăng được duyệt hoặc từ chối
    if (status === 'APPROVED') {
      await notificationService.createNotification(
        post.authorId,
        'Bài đăng được duyệt',
        `Bài đăng "${post.title}" của bạn đã được duyệt và hiển thị công khai.`,
        'POST_APPROVED',
        postId
      );
    } else if (status === 'REJECTED') {
      await notificationService.createNotification(
        post.authorId,
        'Bài đăng bị từ chối',
        `Bài đăng "${post.title}" của bạn đã bị từ chối duyệt.`,
        'POST_REJECTED',
        postId
      );
    }

    return updatedPost;
  }
};