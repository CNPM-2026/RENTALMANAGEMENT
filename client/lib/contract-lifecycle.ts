import type {
  ContractRenewalStatus,
  ContractTerminationReason,
  ContractTerminationStatus,
  DepositRefundStatus,
} from '@/types/models';

export const CONTRACT_TERMINATION_REASON_LABELS: Record<ContractTerminationReason, string> = {
  TENANT_MOVED_OUT: 'Người thuê chuyển đi / trả phòng',
  TENANT_VIOLATION: 'Người thuê vi phạm điều khoản, nội quy',
  LANDLORD_VIOLATION: 'Chủ trọ vi phạm điều khoản, nội quy',
  MUTUAL_AGREEMENT: 'Hai bên thỏa thuận chấm dứt',
  OTHER: 'Lý do khác',
};

export const CONTRACT_TERMINATION_STATUS_LABELS: Record<ContractTerminationStatus, string> = {
  PENDING: 'Chờ Admin duyệt',
  APPROVED: 'Đã duyệt chấm dứt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã huỷ yêu cầu',
};

export const DEPOSIT_REFUND_STATUS_LABELS: Record<DepositRefundStatus, string> = {
  NOT_REQUIRED: 'Không phát sinh hoàn cọc',
  PENDING: 'Chờ chủ trọ hoàn cọc',
  PAID: 'Đã hoàn cọc',
};

export const CONTRACT_RENEWAL_STATUS_LABELS: Record<ContractRenewalStatus, string> = {
  PENDING: 'Chờ phản hồi',
  APPROVED: 'Đã ký tiếp',
  DECLINED: 'Đã từ chối',
  CANCELLED: 'Đã huỷ',
};

export const TERMINATION_STATUS_CLASS: Record<ContractTerminationStatus, string> = {
  PENDING: 'border-[#f0d9a8] bg-[#fff4e5] text-[#8a5700]',
  APPROVED: 'border-[#b2d3c2] bg-[#eaf2ed] text-[#15594f]',
  REJECTED: 'border-[#efc6bb] bg-[#fbeae6] text-[#a4422c]',
  CANCELLED: 'border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b]',
};

export const RENEWAL_STATUS_CLASS: Record<ContractRenewalStatus, string> = {
  PENDING: 'border-[#f0d9a8] bg-[#fff4e5] text-[#8a5700]',
  APPROVED: 'border-[#b2d3c2] bg-[#eaf2ed] text-[#15594f]',
  DECLINED: 'border-[#efc6bb] bg-[#fbeae6] text-[#a4422c]',
  CANCELLED: 'border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b]',
};
