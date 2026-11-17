import type { NotificationType, Role } from '@/types/models';

/** Bốn không gian có trang thông báo riêng. */
export type NotificationPortal = 'admin' | 'landlord' | 'tenant' | 'staff';

/**
 * Role của tài khoản đang đăng nhập → không gian thông báo tương ứng.
 *
 * Luôn lấy role từ user (session), KHÔNG suy ra từ URL/portal của trang hiện tại:
 * một tài khoản có thể mở trang công khai hoặc trang được cấp quyền, nhưng link
 * thông báo vẫn phải trỏ về đúng không gian của chính tài khoản đó.
 */
export function notificationPortalForRole(role: Role | null | undefined): NotificationPortal | null {
  switch (role) {
    case 'ADMIN':
      return 'admin';
    case 'LANDLORD':
      return 'landlord';
    case 'TENANT':
      return 'tenant';
    case 'STAFF':
      return 'staff';
    default:
      return null;
  }
}

/** Đường dẫn gốc của trang thông báo theo portal (dùng nội bộ sau khi đã có role). */
function basePathForPortal(portal: NotificationPortal): string {
  if (portal === 'tenant') return '/tenant/notifications';
  return `/${portal}/notifications`;
}

/** Đường dẫn gốc của trang thông báo theo role của user đang đăng nhập. */
export function notificationBasePath(role: Role | null | undefined): string | null {
  const portal = notificationPortalForRole(role);
  return portal ? basePathForPortal(portal) : null;
}

/** Ghép `?key=<id>` (hoặc nối tiếp query đã có) mà vẫn encode id an toàn. */
function withFocus(path: string, key: string, id: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(id)}`;
}

/**
 * Đích đến khi bấm "Xem chi tiết" trên một thông báo.
 *
 * `role` là role của USER đang đăng nhập (không phải portal của trang hiện tại).
 * Chỉ trả về đường dẫn ĐÃ TỒN TẠI trong app. Khi không xác định được role/đối
 * tượng (hoặc role không có trang tương ứng), trả `null` để UI quay về trang chi
 * tiết thông báo — tránh link chết/404 như trước đây.
 */
function resolveForPortal(
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
      // `/admin/disputes` chỉ là trang giới thiệu tĩnh; hàng đợi thật nằm ở
      // `/admin/reports`. Người tố giác xem lại báo cáo của mình ở trang an toàn
      // (tenant), mục "Báo cáo của tôi" (landlord) hoặc trang riêng (staff).
      if (portal === 'admin') return id ? withFocus('/admin/reports', 'report', id) : '/admin/reports';
      if (portal === 'tenant') return id ? withFocus('/tenant/safety', 'report', id) : '/tenant/safety';
      if (portal === 'landlord') return id ? withFocus('/landlord/support', 'report', id) : '/landlord/support';
      if (portal === 'staff') return id ? withFocus('/staff/reports', 'report', id) : '/staff/reports';
      return null;

    case 'APPOINTMENT':
      if (portal === 'landlord') return id ? withFocus('/landlord/calendar', 'appointment', id) : '/landlord/calendar';
      if (portal === 'tenant') return id ? withFocus('/tenant/appointments', 'appointment', id) : '/tenant/appointments';
      return null;

    case 'POST_APPROVED':
    case 'POST_REJECTED':
      if (portal === 'landlord' && id) return `/landlord/listings/${id}`;
      // Tenant xem trạng thái duyệt của chính tin mình ở trang tìm bạn ở ghép.
      if (portal === 'tenant') return id ? withFocus('/roommates', 'post', id) : '/roommates';
      if (portal === 'admin') return '/admin/moderation/listings';
      return null;

    case 'POST_PENDING':
      if (portal === 'admin') {
        return '/admin/moderation/listings';
      }
      return null;

    case 'SUPPORT_TICKET':
      if (portal === 'admin') {
        return id
          ? `/admin/support#ticket-${encodeURIComponent(id)}`
          : '/admin/support';
      }
      return null;

    case 'INVOICE':
      if (portal === 'landlord') return id ? withFocus('/landlord/invoices', 'invoice', id) : '/landlord/invoices';
      // Khách thuê có trang hoá đơn riêng; trước đây trỏ nhầm sang hợp đồng.
      if (portal === 'tenant') return id ? withFocus('/tenant/invoices', 'invoice', id) : '/tenant/invoices';
      return null;

    case 'CONTRACT':
      // Hai bên đều có trang chi tiết hợp đồng thật.
      if (portal === 'landlord' && id) return `/landlord/contracts/${id}`;
      if (portal === 'tenant' && id) return `/tenant/contracts/${id}`;
      if (portal === 'landlord') return '/landlord/contracts';
      if (portal === 'tenant') return '/tenant/contracts';
      if (portal === 'admin') return '/admin/contracts';
      return null;

    case 'CONTRACT_TERMINATION':
    case 'CONTRACT_RENEWAL':
      // Thông báo cho Admin giữ ID yêu cầu (màn duyệt chấm dứt); thông báo cho
      // hai bên lưu ID hợp đồng để mở đúng trang chi tiết.
      if (portal === 'admin') return id ? withFocus('/admin/contracts', 'request', id) : '/admin/contracts';
      if (portal === 'landlord' && id) return `/landlord/contracts/${id}`;
      if (portal === 'tenant' && id) return `/tenant/contracts/${id}`;
      if (portal === 'landlord') return '/landlord/contracts';
      if (portal === 'tenant') return '/tenant/contracts';
      return null;

    case 'OCCUPANCY':
      if (portal === 'landlord') return id ? withFocus('/landlord/occupancy', 'declaration', id) : '/landlord/occupancy';
      if (portal === 'tenant') return id ? withFocus('/tenant/occupancy', 'declaration', id) : '/tenant/occupancy';
      return null;

    case 'MESSAGE':
      if (portal === 'landlord') {
        return id ? `/landlord/messages?conversation=${encodeURIComponent(id)}` : '/landlord/messages';
      }
      if (portal === 'tenant') {
        return id ? `/tenant/messages?conversation=${encodeURIComponent(id)}` : '/tenant/messages';
      }
      if (portal === 'admin') {
        return id ? `/admin/messages?conversation=${encodeURIComponent(id)}` : '/admin/messages';
      }
      if (portal === 'staff') {
        return id ? `/staff/messages?conversation=${encodeURIComponent(id)}` : '/staff/messages';
      }
      return null;

    case 'COMMISSION':
      return portal === 'landlord' ? '/landlord/reports' : null;

    case 'RENTAL_REQUEST':
      if (portal === 'landlord') return id ? withFocus('/landlord/rental-requests', 'request', id) : '/landlord/rental-requests';
      if (portal === 'tenant') return id ? withFocus('/tenant/rental-requests', 'request', id) : '/tenant/rental-requests';
      return null;

    case 'MAINTENANCE_REQUEST':
      if (portal === 'landlord' && id) return `/landlord/maintenance/${id}`;
      if (portal === 'tenant' && id) return `/tenant/maintenance/${id}`;
      if (portal === 'landlord') return '/landlord/maintenance';
      if (portal === 'tenant') return '/tenant/maintenance';
      return null;

    case 'ROOMMATE_INVITATION':
      if (portal === 'tenant') {
        return id ? withFocus('/tenant/roommate-invitations', 'invitation', id) : '/tenant/roommate-invitations';
      }
      return null;

    case 'KYC':
      if (portal === 'admin') return id ? `/admin/landlords/kyc/${id}` : '/admin/landlords/kyc';
      if (portal === 'tenant') return '/tenant/kyc';
      if (portal === 'landlord') return '/landlord/kyc';
      if (portal === 'staff') return '/staff/kyc';
      return null;

    case 'SYSTEM':
      if (portal === 'admin') return '/admin/moderation/listings';
      return null;

    default:
      if (portal === 'admin') return '/admin/moderation/listings';
      return null;
  }
}

/**
 * Đích đến theo ROLE của user đang đăng nhập.
 *
 * Đây là API mà UI phải gọi. `role` lấy từ `getCurrentUser()?.role`, tuyệt đối
 * không truyền portal của route hiện tại.
 */
export function resolveNotificationTarget(
  role: Role | null | undefined,
  type: NotificationType,
  referenceId?: string | null,
): string | null {
  const portal = notificationPortalForRole(role);
  if (!portal) return null;
  return resolveForPortal(portal, type, referenceId);
}

/** Nhãn nút hành động tương ứng với loại thông báo (theo portal đã suy ra từ role). */
function actionLabelForPortal(
  type: NotificationType,
  portal?: NotificationPortal,
): string {
  switch (type) {
    case 'POST_REJECTED':
      if (portal === 'admin') return 'Xem tin đăng';
      if (portal === 'tenant') return 'Mở khu ở ghép';
      return 'Xem bài viết bị từ chối';
    case 'POST_APPROVED':
      if (portal === 'admin') return 'Xem tin đăng';
      if (portal === 'tenant') return 'Mở khu ở ghép';
      return 'Xem bài viết đã duyệt';
    case 'POST_PENDING':
      return 'Duyệt tin đăng';
    case 'SUPPORT_TICKET':
      return 'Xử lý yêu cầu hỗ trợ';
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
      return portal === 'admin' ? 'Xử lý chấm dứt hợp đồng' : 'Xem hợp đồng';
    case 'CONTRACT_RENEWAL':
      return portal === 'admin' ? 'Xem yêu cầu ký tiếp' : 'Xem đề xuất ký tiếp';
    case 'OCCUPANCY':
      return 'Xem số người ở';
    case 'MESSAGE':
      return 'Mở hội thoại';
    case 'DISPUTE':
      return portal === 'admin' ? 'Xử lý tranh chấp' : 'Xem báo cáo của tôi';
    case 'COMMISSION':
      return 'Xem báo cáo hoa hồng';
    case 'RENTAL_REQUEST':
      return 'Mở yêu cầu thuê phòng';
    case 'MAINTENANCE_REQUEST':
      return 'Mở báo cáo sự cố';
    case 'ROOMMATE_INVITATION':
      return 'Mở lời mời ở ghép';
    case 'KYC':
      return 'Duyệt hồ sơ KYC';
    case 'SYSTEM':
      return 'Xem chi tiết';
    default:
      return 'Xem chi tiết';
  }
}

/** Nhãn nút hành động theo ROLE của user đang đăng nhập. */
export function notificationActionLabel(
  type: NotificationType,
  role?: Role | null,
): string {
  return actionLabelForPortal(type, notificationPortalForRole(role) ?? undefined);
}
