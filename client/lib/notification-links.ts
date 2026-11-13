import type { NotificationType } from '@/types/models';

/** Bốn không gian có trang thông báo riêng. */
export type NotificationPortal = 'admin' | 'landlord' | 'tenant' | 'staff';

/** Đường dẫn gốc của trang thông báo theo portal. */
export function notificationBasePath(portal: NotificationPortal): string {
  if (portal === 'tenant') return '/tenant/notifications';
  return `/${portal}/notifications`;
}

/**
 * Đích đến khi bấm "Xem chi tiết" trên một thông báo.
 *
 * Chỉ trả về đường dẫn ĐÃ TỒN TẠI trong app. Khi không xác định được đối tượng
 * (hoặc portal không có trang tương ứng), trả `null` để UI quay về trang chi
 * tiết thông báo — tránh link chết/404 như trước đây.
 */
export function resolveNotificationTarget(
  portal: NotificationPortal,
  type: NotificationType,
  referenceId?: string | null,
): string | null {
  const id = referenceId ?? null;

  switch (type) {
    case 'TASK':
    case 'OFFER':
    case 'REVIEW':
      if (portal === 'landlord' && id) return `/landlord/maintenance-tasks/${id}`;
      if (portal === 'staff' && id) return `/staff/tasks/${id}`;
      return null;

    case 'DISPUTE':
      if (portal === 'admin') return '/admin/disputes';
      if (portal === 'landlord') return '/landlord/support';
      return null;

    case 'APPOINTMENT':
      if (portal === 'landlord') return '/landlord/calendar';
      if (portal === 'tenant') return '/tenant/appointments';
      return null;

    case 'POST_APPROVED':
    case 'POST_REJECTED':
      if (portal === 'landlord' && id) return `/landlord/listings/${id}`;
      // Tenant xem trạng thái duyệt của chính tin mình ở trang tìm bạn ở ghép.
      if (portal === 'tenant') return '/roommates';
      if (portal === 'admin') return '/admin/moderation/listings';
      return null;

    case 'INVOICE':
      if (portal === 'landlord') return '/landlord/invoices';
      // Khách thuê xem hoá đơn trong trang hợp đồng của mình.
      if (portal === 'tenant') return '/tenant/contracts';
      return null;

    case 'CONTRACT':
      if (portal === 'landlord') return '/landlord/contracts';
      if (portal === 'tenant') return '/tenant/contracts';
      if (portal === 'admin') return '/admin/contracts';
      return null;

    case 'CONTRACT_TERMINATION':
    case 'CONTRACT_RENEWAL':
      if (portal === 'admin') return '/admin/contracts';
      if (portal === 'landlord') return '/landlord/contracts';
      if (portal === 'tenant') return '/tenant/contracts';
      return null;

    case 'OCCUPANCY':
      if (portal === 'landlord') return '/landlord/occupancy';
      if (portal === 'tenant') return '/tenant/occupancy';
      return null;

    case 'MESSAGE':
      if (portal === 'landlord') {
        return id ? `/landlord/messages?conversation=${encodeURIComponent(id)}` : '/landlord/messages';
      }
      if (portal === 'tenant') {
        return id ? `/tenant/messages?conversation=${encodeURIComponent(id)}` : '/tenant/messages';
      }
      return null;

    case 'COMMISSION':
      return portal === 'landlord' ? '/landlord/reports' : null;

    case 'SYSTEM':
    default:
      return null;
  }
}

/** Nhãn nút hành động tương ứng với loại thông báo. */
export function notificationActionLabel(type: NotificationType): string {
  switch (type) {
    case 'POST_REJECTED':
      return 'Xem bài viết bị từ chối';
    case 'POST_APPROVED':
      return 'Xem bài viết đã duyệt';
    case 'TASK':
    case 'OFFER':
    case 'REVIEW':
      return 'Mở chi tiết công việc';
    case 'APPOINTMENT':
      return 'Mở lịch xem phòng';
    case 'INVOICE':
      return 'Xem hoá đơn';
    case 'CONTRACT':
      return 'Xem hợp đồng';
    case 'CONTRACT_TERMINATION':
      return 'Xử lý chấm dứt hợp đồng';
    case 'CONTRACT_RENEWAL':
      return 'Xem đề xuất ký tiếp';
    case 'OCCUPANCY':
      return 'Xem số người ở';
    case 'MESSAGE':
      return 'Mở hội thoại';
    default:
      return 'Xem chi tiết';
  }
}
