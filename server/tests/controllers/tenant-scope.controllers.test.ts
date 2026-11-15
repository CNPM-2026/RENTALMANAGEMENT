import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appointmentController } from '../../src/controllers/appointment.controller';
import { invoiceController } from '../../src/controllers/invoice.controller';

/**
 * Cùng một tài khoản TENANT có membership: KHÔNG có `scope=tenant` thì giữ
 * phạm vi chủ trọ (staff), có scope thì luôn đọc dữ liệu CỦA CHÍNH MÌNH.
 * Đây là chốt chặn để trang khách thuê không hiển thị/ sửa dữ liệu của chủ trọ.
 */
const mocks = vi.hoisted(() => ({
  getMyAppointments: vi.fn(),
  updateAppointmentStatus: vi.fn(),
  getMyInvoices: vi.fn(),
}));

vi.mock('../../src/services/appointment.service', () => ({
  appointmentService: {
    createAppointment: vi.fn(),
    getMyAppointments: mocks.getMyAppointments,
    updateStatus: mocks.updateAppointmentStatus,
  },
}));

vi.mock('../../src/services/invoice.service', () => ({
  invoiceService: { getMyInvoices: mocks.getMyInvoices },
}));

const TENANT_WITH_MEMBERSHIP = {
  id: 'tenant-1',
  role: 'TENANT',
  landlordId: 'landlord-1',
} as never;

const invoke = async (
  controller: (req: never, res: never, next: never) => Promise<unknown>,
  req: Record<string, unknown>,
) => {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  let caught: unknown;
  await controller(req as never, response as never, ((error?: unknown) => {
    caught = error;
  }) as never);
  if (caught) throw caught;
  return response;
};

describe('scope=tenant cho tài khoản có membership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getMyAppointments.mockResolvedValue([]);
    mocks.updateAppointmentStatus.mockResolvedValue({});
    mocks.getMyInvoices.mockResolvedValue([]);
  });

  it('appointments/my đọc lịch của chính tenant khi có scope=tenant', async () => {
    await invoke(appointmentController.getMyAppointments, {
      user: TENANT_WITH_MEMBERSHIP,
      query: { scope: 'tenant' },
    });

    expect(mocks.getMyAppointments).toHaveBeenCalledWith('tenant-1', 'TENANT');
  });

  it('appointments/my không có scope giữ phạm vi chủ trọ (không lộ dữ liệu tenant)', async () => {
    await invoke(appointmentController.getMyAppointments, {
      user: TENANT_WITH_MEMBERSHIP,
      query: {},
    });

    expect(mocks.getMyAppointments).toHaveBeenCalledWith('landlord-1', 'LANDLORD');
  });

  it('đổi trạng thái lịch hẹn dùng id tenant khi có scope=tenant', async () => {
    await invoke(appointmentController.updateStatus, {
      user: TENANT_WITH_MEMBERSHIP,
      query: { scope: 'tenant' },
      params: { id: 'appointment-1' },
      body: { status: 'CANCELLED' },
    });

    expect(mocks.updateAppointmentStatus).toHaveBeenCalledWith('tenant-1', 'appointment-1', 'CANCELLED');
  });

  it('invoices/my đọc hoá đơn của chính tenant khi có scope=tenant', async () => {
    await invoke(invoiceController.getMyInvoices, {
      user: TENANT_WITH_MEMBERSHIP,
      query: { scope: 'tenant' },
    });

    expect(mocks.getMyInvoices).toHaveBeenCalledWith('tenant-1', 'TENANT');
  });

  it('scope=tenant không áp dụng cho role khác', async () => {
    await invoke(invoiceController.getMyInvoices, {
      user: { id: 'landlord-1', role: 'LANDLORD', landlordId: null } as never,
      query: { scope: 'tenant' },
    });

    expect(mocks.getMyInvoices).toHaveBeenCalledWith('landlord-1', 'LANDLORD');
  });
});
