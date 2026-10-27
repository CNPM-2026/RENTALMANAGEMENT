import prisma from '../config/db';
import { AppError } from '../utils/AppError';

// Tạm thời fix cứng đơn giá (sau này có thể thêm vào bảng Property/Room)
const ELECTRICITY_PRICE = 3500; // VNĐ / kWh
const WATER_PRICE = 15000;      // VNĐ / m3

export const invoiceService = {
  generateInvoice: async (landlordId: string, data: any) => {
    const { roomId, month, year, otherFee = 0 } = data;

    // 1. Kiểm tra phòng và quyền sở hữu
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { property: true }
    });
    if (!room || room.property.landlordId !== landlordId) {
      throw new AppError('Phòng không tồn tại hoặc bạn không có quyền', 403);
    }

    // 2. Phải có hợp đồng ACTIVE mới được xuất hóa đơn
    const contract = await prisma.contract.findFirst({
      where: { roomId, status: 'ACTIVE' }
    });
    if (!contract) throw new AppError('Phòng này hiện không có hợp đồng thuê nào đang hoạt động', 400);

    // 3. Check xem hóa đơn tháng này xuất chưa
    const existingInvoice = await prisma.invoice.findUnique({
      where: { roomId_month_year: { roomId, month, year } }
    });
    if (existingInvoice) throw new AppError('Hóa đơn tháng này đã được tạo rồi', 400);

    // 4. Lấy chỉ số điện nước để tính tiền
    const reading = await prisma.meterReading.findUnique({
      where: { roomId_month_year: { roomId, month, year } }
    });
    if (!reading) throw new AppError('Chưa ghi nhận chỉ số điện nước cho tháng này', 400);

    // 5. Tính toán tiền
    const electricityUsed = reading.electricityEnd - reading.electricityStart;
    const waterUsed = reading.waterEnd - reading.waterStart;

    const roomFee = contract.monthlyRent;
    const electricityFee = electricityUsed * ELECTRICITY_PRICE;
    const waterFee = waterUsed * WATER_PRICE;
    const totalAmount = Number(roomFee) + electricityFee + waterFee + Number(otherFee);

    // Hạn chót thanh toán: Ngày 10 của tháng hiện tại (hoặc tháng sau tùy logic)
    const dueDate = new Date(year, month - 1, 10); 

    // 6. Tạo hóa đơn
    return await prisma.invoice.create({
      data: {
        roomId,
        tenantId: contract.tenantId,
        month,
        year,
        roomFee,
        electricityFee,
        waterFee,
        otherFee,
        totalAmount,
        dueDate,
        status: 'UNPAID'
      },
      include: {
        room: { select: { roomNumber: true } },
        tenant: { select: { fullName: true } }
      }
    });
  },

  // Lấy danh sách hóa đơn (Dùng cho cả Chủ trọ và Người thuê)
  getMyInvoices: async (userId: string, role: string) => {
    const whereClause: any = {};
    
    if (role === 'LANDLORD') {
      whereClause.room = { property: { landlordId: userId } };
    } else if (role === 'TENANT') {
      whereClause.tenantId = userId;
    }

    return await prisma.invoice.findMany({
      where: whereClause,
      include: {
        room: { include: { property: { select: { name: true } } } },
        tenant: { select: { fullName: true, phone: true } }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });
  },

  // Xác nhận thanh toán (Chủ trọ thu tiền mặt -> Bấm nút)
  payInvoice: async (landlordId: string, invoiceId: string) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { room: { include: { property: true } } }
    });

    if (!invoice) throw new AppError('Không tìm thấy hóa đơn', 404);
    if (invoice.room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền thao tác trên hóa đơn này', 403);
    }
    if (invoice.status === 'PAID') throw new AppError('Hóa đơn này đã được thanh toán', 400);

    return await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() }
    });
  }
};