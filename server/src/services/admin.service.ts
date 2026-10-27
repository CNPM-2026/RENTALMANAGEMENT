import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { PostStatus } from '@prisma/client';

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
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError('Không tìm thấy bài đăng', 404);

    return await prisma.post.update({
      where: { id: postId },
      data: { status }
    });
  }
};