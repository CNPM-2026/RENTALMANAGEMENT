/**
 * 5K-Rental Manager - Core Frontend Utility Helpers
 * Provides classnames merger (cn), Vietnamese currency formatter (formatCurrency),
 * compact real estate pricing, date formatting, and status badge helpers.
 */

import { Role, PostStatus, RoomStatus, ContractStatus, InvoiceStatus, AppointmentStatus } from '@/types/models';
import { translateRole } from '@/lib/labels';

/**
 * ClassValue type definition compatible with clsx
 */
export type ClassValue =
  | string
  | number
  | bigint
  | boolean
  | undefined
  | null
  | { [key: string]: unknown }
  | ClassValue[];

/**
 * Robust, zero-dependency classnames combiner.
 * Handles strings, conditional booleans, nested arrays, and truthy object dictionaries.
 * Can seamlessly switch to twMerge(clsx(inputs)) once clsx and tailwind-merge are added.
 */
export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;

    if (typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint') {
      classes.push(String(input));
    } else if (Array.isArray(input)) {
      const inner = cn(...input);
      if (inner) classes.push(inner);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}

/**
 * Formats a monetary number to Vietnamese Đồng (VNĐ).
 * Example: 3500000 -> "3.500.000 ₫"
 */
export function formatCurrency(
  val: number | string | null | undefined,
  options?: { showUnit?: boolean; unit?: '₫' | 'VNĐ' }
): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return options?.showUnit === false ? '0' : '0 ₫';
  }

  const num = typeof val === 'string' ? parseFloat(val) : val;
  const formatted = new Intl.NumberFormat('vi-VN').format(num);

  if (options?.showUnit === false) {
    return formatted;
  }

  const unit = options?.unit ?? '₫';
  return `${formatted} ${unit}`;
}

/**
 * Compact Vietnamese price formatting for rental cards and listings.
 * Examples:
 *   3500000 -> "3.5 triệu/tháng"
 *   1200000000 -> "1.2 tỷ/tháng"
 *   500000 -> "500k/tháng"
 */
export function formatPriceCompact(
  val: number | string | null | undefined,
  suffix = '/tháng'
): string {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return `Thỏa thuận`;
  }

  const num = typeof val === 'string' ? parseFloat(val) : val;

  if (num >= 1_000_000_000) {
    const bill = (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '');
    return `${bill} tỷ${suffix}`;
  }

  if (num >= 1_000_000) {
    const mill = (num / 1_000_000).toFixed(1).replace(/\.0$/, '');
    return `${mill} triệu${suffix}`;
  }

  if (num >= 1_000) {
    const k = Math.round(num / 1_000);
    return `${k}k${suffix}`;
  }

  return `${formatCurrency(num)}${suffix}`;
}

/**
 * Formats date to Vietnamese localized format.
 * - 'short': "05/11/2026"
 * - 'long': "05 Tháng 11, 2026"
 * - 'datetime': "14:30 05/11/2026"
 */
export function formatDate(
  date: string | number | Date | null | undefined,
  format: 'short' | 'long' | 'datetime' = 'short'
): string {
  if (!date) return '-';

  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (format === 'short') {
      return `${day}/${month}/${year}`;
    }

    if (format === 'datetime') {
      return `${hours}:${minutes} ${day}/${month}/${year}`;
    }

    if (format === 'long') {
      return `${day} tháng ${month}, ${year}`;
    }

    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Formats area in square meters.
 * Example: 25 -> "25 m²"
 */
export function formatArea(area: number | null | undefined): string {
  if (area === null || area === undefined || isNaN(area)) return '-';
  return `${area} m²`;
}

/**
 * Returns human-friendly Vietnamese label for user roles.
 * Giữ hàm này cho code cũ nhưng uỷ quyền cho `translateRole` để chỉ có một
 * nguồn nhãn vai trò duy nhất.
 */
export function getRoleLabel(role?: Role | null): string {
  return translateRole(role);
}

/**
 * Status Badge Helpers
 */
export function getPostStatusBadge(status: PostStatus): { label: string; variant: 'warning' | 'success' | 'error' | 'neutral' } {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ duyệt', variant: 'warning' };
    case 'APPROVED':
      return { label: 'Đã duyệt', variant: 'success' };
    case 'REJECTED':
      return { label: 'Từ chối', variant: 'error' };
    case 'CLOSED':
      return { label: 'Đã đóng', variant: 'neutral' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function getRoomStatusBadge(status: RoomStatus): { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' } {
  switch (status) {
    case 'AVAILABLE':
      return { label: 'Còn trống', variant: 'success' };
    case 'RENTED':
      return { label: 'Đã thuê', variant: 'neutral' };
    case 'MAINTENANCE':
      return { label: 'Bảo trì', variant: 'warning' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function getContractStatusBadge(status: ContractStatus): { label: string; variant: 'warning' | 'success' | 'neutral' | 'error' } {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ kích hoạt', variant: 'warning' };
    case 'ACTIVE':
      return { label: 'Đang hiệu lực', variant: 'success' };
    case 'EXPIRED':
      return { label: 'Hết hạn', variant: 'neutral' };
    case 'TERMINATED':
      return { label: 'Đã chấm dứt', variant: 'error' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function getInvoiceStatusBadge(status: InvoiceStatus): { label: string; variant: 'error' | 'success' } {
  switch (status) {
    case 'PAID':
      return { label: 'Đã thanh toán', variant: 'success' };
    case 'UNPAID':
      return { label: 'Chưa thanh toán', variant: 'error' };
    default:
      return { label: status, variant: 'error' };
  }
}

export function getAppointmentStatusBadge(status: AppointmentStatus): { label: string; variant: 'warning' | 'success' | 'error' | 'neutral' } {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ xác nhận', variant: 'warning' };
    case 'CONFIRMED':
      return { label: 'Đã xác nhận', variant: 'success' };
    case 'COMPLETED':
      return { label: 'Đã hoàn thành', variant: 'neutral' };
    case 'CANCELLED':
      return { label: 'Đã hủy', variant: 'error' };
    default:
      return { label: status, variant: 'neutral' };
  }
}
