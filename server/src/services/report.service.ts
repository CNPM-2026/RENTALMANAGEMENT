import prisma from '../config/db';
import { AppError } from '../utils/AppError';

export const reportService = {
  // Người dùng gửi báo cáo
  createReport: async (reporterId: string, data: any) => {
    const { targetType, targetId, reason } = data;
    const targetExists = targetType === 'POST'
      ? await prisma.post.findUnique({ where: { id: targetId }, select: { id: true } })
      : targetType === 'ROOM'
        ? await prisma.room.findUnique({ where: { id: targetId }, select: { id: true } })
        : await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!targetExists) throw new AppError('Đối tượng báo cáo không tồn tại', 404);
    return await prisma.report.create({
      data: { reporterId, targetType, targetId, reason, status: 'PENDING' }
    });
  },

  // Admin lấy danh sách báo cáo (Lọc theo trạng thái PENDING/RESOLVED)
  getAllReports: async (status?: string) => {
    const reports = await prisma.report.findMany({
      where: status ? { status } : {},
      include: {
        reporter: { select: { fullName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return Promise.all(reports.map(async (report) => ({
      ...report,
      target: report.targetType === 'POST'
        ? await prisma.post.findUnique({
          where: { id: report.targetId },
          select: { id: true, title: true, status: true, author: { select: { id: true, fullName: true, email: true, isActive: true } } },
        })
        : report.targetType === 'USER'
          ? await prisma.user.findUnique({ where: { id: report.targetId }, select: { id: true, fullName: true, email: true, isActive: true } })
          : await prisma.room.findUnique({ where: { id: report.targetId }, select: { id: true, roomNumber: true, property: { select: { name: true, landlordId: true } } } }),
    })));
  },

  // Admin xử lý báo cáo
  resolveReport: async (reportId: string, status: string) => {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new AppError('Không tìm thấy báo cáo', 404);

    return await prisma.report.update({
      where: { id: reportId },
      data: { status } // RESOLVED
    });
  }
};