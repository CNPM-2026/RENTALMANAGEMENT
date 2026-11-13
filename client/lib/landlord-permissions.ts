import type { StaffPermission } from '@/types/models';

/**
 * Quyền cần có để mở từng nhóm trang `/landlord/*`.
 *
 * `null` = chủ trọ/nhân viên nào cũng vào được (thông tin chung, không lộ dữ
 * liệu ngoài phạm vi chủ trọ đã cấp quyền). `'LANDLORD_ONLY'` = chỉ chính chủ
 * trọ, vì đó là nơi CẤP quyền cho người khác.
 */
export type LandlordRouteRule = StaffPermission | 'LANDLORD_ONLY' | null;

const RULES: Array<{ prefix: string; rule: LandlordRouteRule }> = [
  { prefix: '/landlord/staff', rule: 'LANDLORD_ONLY' },
  { prefix: '/landlord/properties', rule: 'PROPERTIES_ROOMS' },
  { prefix: '/landlord/rooms', rule: 'PROPERTIES_ROOMS' },
  { prefix: '/landlord/listings', rule: 'PROPERTIES_ROOMS' },
  { prefix: '/landlord/rental-requests', rule: 'APPOINTMENTS' },
  { prefix: '/landlord/calendar', rule: 'APPOINTMENTS' },
  { prefix: '/landlord/tenants', rule: 'APPOINTMENTS' },
  { prefix: '/landlord/occupancy', rule: 'PROPERTIES_ROOMS' },
  { prefix: '/landlord/contracts', rule: 'APPOINTMENTS' },
  { prefix: '/landlord/utilities', rule: 'INVOICES' },
  { prefix: '/landlord/invoices', rule: 'INVOICES' },
  { prefix: '/landlord/reports', rule: 'INVOICES' },
  { prefix: '/landlord/maintenance-tasks', rule: 'MAINTENANCE' },
  { prefix: '/landlord/maintenance', rule: 'MAINTENANCE' },
  { prefix: '/landlord/staff-marketplace', rule: 'MAINTENANCE' },
  { prefix: '/landlord/dashboard', rule: null },
  { prefix: '/landlord/messages', rule: null },
  { prefix: '/landlord/notifications', rule: null },
  { prefix: '/landlord/settings', rule: null },
  { prefix: '/landlord/support', rule: null },
  { prefix: '/landlord/kyc', rule: null },
];

/** Quy tắc áp dụng cho một pathname `/landlord/...` (khớp prefix dài nhất). */
export function landlordRuleForPath(pathname: string): LandlordRouteRule {
  const match = RULES.filter((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? match.rule : null;
}

/**
 * Nhân viên có được mở pathname này không. Chủ trọ luôn `true` (kiểm tra riêng
 * ở provider); hàm này chỉ xét tập quyền của nhân viên.
 */
export function canStaffAccessLandlordPath(pathname: string, permissions: StaffPermission[]): boolean {
  const rule = landlordRuleForPath(pathname);
  if (rule === null) return true;
  if (rule === 'LANDLORD_ONLY') return false;
  return permissions.includes(rule);
}

/** Nhãn tiếng Việt của từng quyền (dùng ở trang Nhân viên & phân quyền). */
export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  PROPERTIES_ROOMS: 'Bất động sản & phòng',
  MAINTENANCE: 'Bảo trì & công việc',
  INVOICES: 'Hoá đơn & tài chính',
  APPOINTMENTS: 'Lịch hẹn, thuê & hợp đồng',
};
