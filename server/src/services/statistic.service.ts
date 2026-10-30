import prisma from '../config/db';

export const statisticService = {
  // 1. Dashboard cho ADMIN (Toàn hệ thống)
  getAdminStats: async () => {
    const totalUsers = await prisma.user.count();
    const totalPosts = await prisma.post.count();
    const totalAppointments = await prisma.appointment.count({ where: { status: 'COMPLETED' } });
    const pendingPosts = await prisma.post.count({ where: { status: 'PENDING' } });
    const pendingReports = await prisma.report.count({ where: { status: 'PENDING' } });

    // Đếm user theo Role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true }
    });

    return {
      overview: { totalUsers, totalPosts, totalAppointments, pendingPosts, pendingReports },
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count._all }))
    };
  },

  // 2. Dashboard cho LANDLORD (Quản lý nhà trọ của mình)
  getLandlordStats: async (landlordId: string) => {
    // Đếm tổng số phòng
    const totalRooms = await prisma.room.count({
      where: { property: { landlordId } }
    });

    // Đếm phòng theo trạng thái (Trống, Đã thuê, Bảo trì)
    const roomsByStatus = await prisma.room.groupBy({
      by: ['status'],
      where: { property: { landlordId } },
      _count: { _all: true }
    });

    // Tính tổng doanh thu dự kiến (Dựa trên các hợp đồng đang ACTIVE)
    const activeContracts = await prisma.contract.findMany({
      where: { room: { property: { landlordId } }, status: 'ACTIVE' },
      select: { monthlyRent: true }
    });
    
    const expectedMonthlyRevenue = activeContracts.reduce(
      (sum, contract) => sum + Number(contract.monthlyRent), 0
    );

    // Đếm số lịch hẹn đang chờ duyệt
    const pendingAppointments = await prisma.appointment.count({
      where: { landlordId, status: 'PENDING' }
    });

    return {
      totalRooms,
      expectedMonthlyRevenue,
      pendingAppointments,
      roomsByStatus: roomsByStatus.map(r => ({ status: r.status, count: r._count._all }))
    };
  }
};