import prisma from '../config/db';
import { AppError } from '../utils/AppError';
import { notificationService } from './notification.service';
import { minorToDecimalString, sumMoney, toMinorUnits } from '../utils/money';
import { billingPeriodEnd, occupancyService } from './occupancy.service';

/**
 * HOÁ ĐƠN THÁNG — điện theo chỉ số, nước theo ĐẦU NGƯỜI ĐÃ XÁC MINH.
 *
 * Quy tắc (không được nới lỏng):
 *  - Điện: `(chỉ số cuối − chỉ số đầu) × đơn giá điện của phòng`.
 *  - Nước: `đơn giá nước của phòng × số người ĐÃ ĐƯỢC CHỦ TRỌ XÁC MINH` áp dụng
 *    cho kỳ hoá đơn. Chưa có bản xác minh ⇒ mặc định **1 người** (mức tối thiểu)
 *    để vẫn phát hành được hoá đơn; con số thực tế được ghi vào snapshot.
 *  - Mọi phép tính tiền chạy trên `bigint` minor units (xem `utils/money.ts`) để
 *    không có sai số dấu phẩy động; đầu vào không hợp lệ KHÔNG bao giờ thành 0.
 *  - Hoá đơn lưu SNAPSHOT (chỉ số, đơn giá, số người) tại thời điểm phát hành:
 *    đổi giá/số người sau đó không làm sai lịch sử.
 *  - Đơn giá thiếu ở phòng (cột nullable từ trước) dùng mức mặc định đang áp
 *    dụng của hệ thống — giữ nguyên công thức cũ — nhưng luôn được ghi vào
 *    snapshot để hoá đơn tự giải thích được.
 *  - Phí internet/WiFi, phí dịch vụ và phí gửi xe lấy từ CẤU HÌNH PHÒNG tại
 *    thời điểm phát hành, cộng vào tổng và lưu snapshot trên hoá đơn. Phòng
 *    chưa cấu hình (NULL) tương đương 0 đồng; sửa phòng sau đó không làm thay
 *    đổi hoá đơn đã phát hành.
 */

export const DEFAULT_ELECTRICITY_RATE = '3500';
export const DEFAULT_WATER_RATE = '15000';

export type InvoiceBlocker = {
  code:
    | 'CONTRACT_REQUIRED'
    | 'INVOICE_EXISTS'
    | 'READING_REQUIRED'
    | 'READING_INVALID'
    | 'INVALID_UNIT_PRICE'
    | 'INVALID_ROOM_FEE'
    | 'INVALID_ROOM_EXTRA_FEE'
    | 'INVALID_OTHER_FEE';
  message: string;
  statusCode: number;
};

/**
 * Số người ở dùng để tính tiền nước khi kỳ hoá đơn CHƯA có khai báo được xác
 * minh. Mặc định 1 người (mức tối thiểu), không chặn phát hành hoá đơn và không
 * đoán theo sức chứa phòng.
 */
export const DEFAULT_UNVERIFIED_OCCUPANTS = 1;

export type InvoiceInput = {
  roomId: string;
  month: number;
  year: number;
  otherFee?: number | string | null;
};

/**
 * Số người ở dùng để tính tiền nước trong một kỳ hoá đơn.
 * `verified = false` nghĩa là kỳ này chưa có khai báo được chủ trọ xác minh và
 * hoá đơn đang dùng mức mặc định 1 người.
 */
type BillingOccupancy = {
  declarationId: string | null;
  occupants: number;
  verifiedAt: Date | null;
  verified: boolean;
};

const blocked = (code: InvoiceBlocker['code'], message: string, statusCode = 400): InvoiceBlocker => ({
  code,
  message,
  statusCode,
});

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Dựng toàn bộ dữ liệu tính hoá đơn. Dùng chung cho preview (GET) và phát hành
 * (POST) để hai đường không bao giờ lệch công thức.
 */
const buildComputation = async (landlordId: string, input: InvoiceInput) => {
  const { roomId, month, year } = input;

  // Sai quyền sở hữu là lỗi FATAL (không phải "blocker"): không được lộ dữ liệu.
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { property: true },
  });
  if (!room || room.property.landlordId !== landlordId) {
    throw new AppError('Phòng không tồn tại hoặc bạn không có quyền', 403);
  }

  const blockers: InvoiceBlocker[] = [];

  const contract = await prisma.contract.findFirst({
    where: { roomId, status: 'ACTIVE' },
    select: { id: true, tenantId: true, monthlyRent: true },
  });
  if (!contract) {
    blockers.push(blocked('CONTRACT_REQUIRED', 'Phòng này hiện không có hợp đồng thuê nào đang hoạt động'));
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { roomId_month_year: { roomId, month, year } },
    select: { id: true },
  });
  if (existingInvoice) {
    blockers.push(blocked('INVOICE_EXISTS', 'Hóa đơn tháng này đã được tạo rồi', 409));
  }

  const reading = await prisma.meterReading.findUnique({
    where: { roomId_month_year: { roomId, month, year } },
  });
  if (!reading) {
    blockers.push(blocked('READING_REQUIRED', 'Chưa ghi nhận chỉ số điện nước cho tháng này'));
  }

  let electricityConsumption: number | null = null;
  let waterConsumption: number | null = null;
  if (reading) {
    const readingsValid =
      nonNegativeInteger(reading.electricityStart) &&
      nonNegativeInteger(reading.electricityEnd) &&
      nonNegativeInteger(reading.waterStart) &&
      nonNegativeInteger(reading.waterEnd);
    if (!readingsValid) {
      blockers.push(
        blocked('READING_INVALID', 'Chỉ số điện nước không hợp lệ (phải là số nguyên không âm)'),
      );
    } else if (reading.electricityEnd < reading.electricityStart) {
      blockers.push(
        blocked(
          'READING_INVALID',
          `Chỉ số điện cuối kỳ (${reading.electricityEnd}) nhỏ hơn chỉ số đầu kỳ (${reading.electricityStart})`,
        ),
      );
    } else if (reading.waterEnd < reading.waterStart) {
      blockers.push(
        blocked(
          'READING_INVALID',
          `Chỉ số nước cuối kỳ (${reading.waterEnd}) nhỏ hơn chỉ số đầu kỳ (${reading.waterStart})`,
        ),
      );
    } else {
      electricityConsumption = reading.electricityEnd - reading.electricityStart;
      waterConsumption = reading.waterEnd - reading.waterStart;
    }
  }

  // Đơn giá: dùng giá của phòng; thiếu thì dùng mức mặc định đang áp dụng.
  const electricityUnitPriceMinor = toMinorUnits(
    room.electricityRate === null ? DEFAULT_ELECTRICITY_RATE : room.electricityRate.toString(),
  );
  const waterUnitPriceMinor = toMinorUnits(
    room.waterRate === null ? DEFAULT_WATER_RATE : room.waterRate.toString(),
  );
  if (electricityUnitPriceMinor === null || electricityUnitPriceMinor < 0n) {
    blockers.push(blocked('INVALID_UNIT_PRICE', 'Đơn giá điện của phòng không hợp lệ — cần cập nhật phòng'));
  }
  if (waterUnitPriceMinor === null || waterUnitPriceMinor < 0n) {
    blockers.push(blocked('INVALID_UNIT_PRICE', 'Đơn giá nước của phòng không hợp lệ — cần cập nhật phòng'));
  }

  const roomFeeMinor = contract ? toMinorUnits(contract.monthlyRent.toString()) : null;
  if (contract && (roomFeeMinor === null || roomFeeMinor < 0n)) {
    blockers.push(blocked('INVALID_ROOM_FEE', 'Tiền thuê của hợp đồng không hợp lệ — cần cập nhật hợp đồng'));
  }

  /**
   * Phí cố định của phòng: cột nullable = "chưa cấu hình" ⇒ 0 đồng.
   * Giá trị đã cấu hình phải parse được thành minor units không âm; nếu dữ liệu
   * bẩn thì chặn phát hành chứ không âm thầm bỏ qua khoản thu của chủ trọ.
   */
  const configuredFeeMinor = (
    value: { toString(): string } | null | undefined,
  ): bigint | null => {
    if (value === null || value === undefined) return 0n;
    const minor = toMinorUnits(value.toString());
    return minor !== null && minor >= 0n ? minor : null;
  };
  const internetFeeMinor = configuredFeeMinor(room.internetFee);
  const serviceFeeMinor = configuredFeeMinor(room.serviceFee);
  const parkingFeeMinor = configuredFeeMinor(room.parkingFee);
  if (internetFeeMinor === null || serviceFeeMinor === null || parkingFeeMinor === null) {
    blockers.push(
      blocked(
        'INVALID_ROOM_EXTRA_FEE',
        'Phí internet/dịch vụ/gửi xe của phòng không hợp lệ — cần cập nhật phòng',
      ),
    );
  }

  const otherFeeRaw = input.otherFee;
  const otherFeeMinor =
    otherFeeRaw === undefined || otherFeeRaw === null || otherFeeRaw === ''
      ? 0n
      : toMinorUnits(otherFeeRaw);
  if (otherFeeMinor === null || otherFeeMinor < 0n) {
    blockers.push(blocked('INVALID_OTHER_FEE', 'Phụ phí không hợp lệ'));
  }

  // Số người ĐÃ XÁC MINH áp dụng cho kỳ. PENDING/REJECTED không bao giờ được dùng.
  // Chưa xác minh ⇒ mặc định 1 người (yêu cầu nghiệp vụ), KHÔNG chặn phát hành.
  const periodEnd = billingPeriodEnd(month, year);
  const verifiedOccupancy = contract
    ? await occupancyService.resolveVerifiedOccupancy({ roomId, tenantId: contract.tenantId, month, year })
    : null;
  const occupancy: BillingOccupancy | null = contract
    ? verifiedOccupancy
      ? {
          declarationId: verifiedOccupancy.declarationId,
          occupants: verifiedOccupancy.occupants,
          verifiedAt: verifiedOccupancy.verifiedAt,
          verified: true,
        }
      : {
          declarationId: null,
          occupants: DEFAULT_UNVERIFIED_OCCUPANTS,
          verifiedAt: null,
          verified: false,
        }
    : null;


  let fees: {
    roomFee: string;
    electricityFee: string;
    waterFee: string;
    internetFee: string;
    serviceFee: string;
    parkingFee: string;
    otherFee: string;
    totalAmount: string;
  } | null = null;

  if (
    blockers.length === 0 &&
    contract &&
    roomFeeMinor !== null &&
    otherFeeMinor !== null &&
    internetFeeMinor !== null &&
    serviceFeeMinor !== null &&
    parkingFeeMinor !== null &&
    electricityUnitPriceMinor !== null &&
    waterUnitPriceMinor !== null &&
    electricityConsumption !== null &&
    occupancy
  ) {
    const electricityFeeMinor = electricityUnitPriceMinor * BigInt(electricityConsumption);
    const waterFeeMinor = waterUnitPriceMinor * BigInt(occupancy.occupants);
    const totalMinor = sumMoney([
      minorToDecimalString(roomFeeMinor),
      minorToDecimalString(electricityFeeMinor),
      minorToDecimalString(waterFeeMinor),
      minorToDecimalString(internetFeeMinor),
      minorToDecimalString(serviceFeeMinor),
      minorToDecimalString(parkingFeeMinor),
      minorToDecimalString(otherFeeMinor),
    ]);
    if (totalMinor === null) {
      blockers.push(blocked('INVALID_OTHER_FEE', 'Không tính được tổng tiền hoá đơn'));
    } else {
      fees = {
        roomFee: minorToDecimalString(roomFeeMinor),
        electricityFee: minorToDecimalString(electricityFeeMinor),
        waterFee: minorToDecimalString(waterFeeMinor),
        internetFee: minorToDecimalString(internetFeeMinor),
        serviceFee: minorToDecimalString(serviceFeeMinor),
        parkingFee: minorToDecimalString(parkingFeeMinor),
        otherFee: minorToDecimalString(otherFeeMinor),
        totalAmount: minorToDecimalString(totalMinor),
      };
    }
  }

  return {
    room,
    contract,
    reading,
    occupancy,
    periodEnd,
    electricityConsumption,
    waterConsumption,
    electricityUnitPriceMinor,
    waterUnitPriceMinor,
    fees,
    blockers,
  };
};

export const invoiceService = {
  /**
   * Xem trước hoá đơn (chỉ đọc). Trả `ready=false` + danh sách `blockers` thay vì
   * ném lỗi để UI hiển thị được lý do cụ thể trước khi bấm phát hành.
   */
  previewInvoice: async (landlordId: string, input: InvoiceInput) => {
    const computation = await buildComputation(landlordId, input);
    const { room, contract, reading, occupancy, periodEnd, blockers, fees } = computation;

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      month: input.month,
      year: input.year,
      periodEnd,
      ready: blockers.length === 0,
      blockers,
      contract: contract ? { id: contract.id, tenantId: contract.tenantId } : null,
      reading: reading
        ? {
            electricityStart: reading.electricityStart,
            electricityEnd: reading.electricityEnd,
            waterStart: reading.waterStart,
            waterEnd: reading.waterEnd,
            electricityConsumption: computation.electricityConsumption,
            waterConsumption: computation.waterConsumption,
          }
        : null,
      occupancy: occupancy
        ? {
            declarationId: occupancy.declarationId,
            occupants: occupancy.occupants,
            verified: occupancy.verified,
          }
        : null,
      unitPrices: {
        electricity:
          computation.electricityUnitPriceMinor === null
            ? null
            : minorToDecimalString(computation.electricityUnitPriceMinor),
        water:
          computation.waterUnitPriceMinor === null
            ? null
            : minorToDecimalString(computation.waterUnitPriceMinor),
      },
      fees,
    };
  },

  /**
   * Phát hành hoá đơn. Blocker ĐẦU TIÊN quyết định lỗi trả về (mã máy đọc được
   * + thông điệp tiếng Việt), nên không bao giờ "thành công" khi thiếu dữ liệu.
   */
  generateInvoice: async (landlordId: string, input: InvoiceInput) => {
    const { roomId, month, year } = input;
    const computation = await buildComputation(landlordId, input);
    const [firstBlocker] = computation.blockers;
    if (firstBlocker) {
      throw new AppError(firstBlocker.message, firstBlocker.statusCode, firstBlocker.code);
    }

    const { contract, reading, occupancy, fees } = computation;
    if (!contract || !reading || !occupancy || !fees) {
      // Không thể xảy ra nếu blockers rỗng; chốt chặn để không ghi hoá đơn nửa vời.
      throw new AppError('Không đủ dữ liệu để phát hành hoá đơn', 409, 'INVOICE_NOT_READY');
    }

    const dueDate = new Date(year, month - 1, 10);

    let invoice;
    try {
      invoice = await prisma.invoice.create({
        data: {
          roomId,
          tenantId: contract.tenantId,
          month,
          year,
          roomFee: fees.roomFee,
          electricityFee: fees.electricityFee,
          waterFee: fees.waterFee,
          internetFee: fees.internetFee,
          serviceFee: fees.serviceFee,
          parkingFee: fees.parkingFee,
          otherFee: fees.otherFee,
          totalAmount: fees.totalAmount,
          dueDate,
          status: 'UNPAID',
          // Snapshot bất biến của kỳ này.
          electricityStart: reading.electricityStart,
          electricityEnd: reading.electricityEnd,
          electricityConsumption: computation.electricityConsumption,
          waterConsumption: computation.waterConsumption,
          waterOccupants: occupancy.occupants,
          electricityUnitPrice: minorToDecimalString(computation.electricityUnitPriceMinor!),
          waterUnitPrice: minorToDecimalString(computation.waterUnitPriceMinor!),
          occupancyDeclarationId: occupancy.declarationId,
        },
        include: {
          room: { select: { roomNumber: true } },
          tenant: { select: { fullName: true } },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new AppError('Hóa đơn tháng này đã được tạo rồi', 409, 'INVOICE_EXISTS');
      }
      throw error;
    }

    await notificationService.createNotification(
      contract.tenantId,
      'Hóa đơn mới',
      `Hóa đơn tháng ${month}/${year} của phòng ${invoice.room.roomNumber} đã được tạo.`,
      'INVOICE',
      invoice.id,
      `invoice:${invoice.id}:created`,
    );
    return invoice;
  },


  // Lấy danh sách hóa đơn (Dùng cho cả Chủ trọ và Người thuê)
  getMyInvoices: async (userId: string, role: string) => {
    const whereClause: any = {};

    if (role === 'LANDLORD') {
      whereClause.room = { property: { landlordId: userId } };
    } else if (role === 'TENANT') {
      whereClause.tenantId = userId;
    } else {
      throw new AppError('Role không được phép xem hóa đơn cá nhân', 403);
    }

    return await prisma.invoice.findMany({
      where: whereClause,
      include: {
        room: { include: { property: { select: { name: true } } } },
        tenant: { select: { fullName: true, phone: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  },

  // Xác nhận thanh toán (Chủ trọ thu tiền mặt -> Bấm nút)
  payInvoice: async (landlordId: string, invoiceId: string) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { room: { include: { property: true } } },
    });

    if (!invoice) throw new AppError('Không tìm thấy hóa đơn', 404);
    if (invoice.room.property.landlordId !== landlordId) {
      throw new AppError('Bạn không có quyền thao tác trên hóa đơn này', 403);
    }
    if (invoice.status === 'PAID') throw new AppError('Hóa đơn này đã được thanh toán', 400);

    const paidInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await notificationService.createNotification(
      invoice.tenantId,
      'Hóa đơn đã thanh toán',
      `Hóa đơn tháng ${invoice.month}/${invoice.year} đã được xác nhận thanh toán.`,
      'INVOICE',
      invoice.id,
    );
    return paidInvoice;
  },
};
