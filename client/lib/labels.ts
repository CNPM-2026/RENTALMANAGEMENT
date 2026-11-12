export function translateRole(role?: string | null) {
  const labels: Record<string, string> = {
    ADMIN: "Quản trị viên",
    LANDLORD: "Chủ trọ",
    TENANT: "Người thuê",
    STAFF: "Thợ / Dịch vụ",
    SUPPORT: "Bộ phận hỗ trợ",
  };
  return role ? labels[role] ?? role : "Chưa cập nhật";
}

/**
 * Nhãn tiếng Việt cho nhóm kỹ năng của thợ (mirror `ServiceCategory`).
 */
export function translateServiceCategory(category?: string | null) {
  const labels: Record<string, string> = {
    ELECTRICAL: "Sửa điện",
    PLUMBING: "Sửa ống nước",
    WATER_LEAK: "Xử lý rò rỉ nước",
    FURNITURE: "Sửa chữa nội thất",
    AIR_CONDITIONER: "Bảo trì máy lạnh",
    PAINTING: "Sơn sửa",
    CLEANING: "Vệ sinh",
    GENERAL_MAINTENANCE: "Bảo trì tổng hợp",
  };
  return category ? labels[category] ?? category : "Chưa cập nhật";
}

/** Danh mục kỹ năng đầy đủ, dùng cho form chọn kỹ năng của thợ. */
export const SERVICE_CATEGORY_OPTIONS = [
  "ELECTRICAL",
  "PLUMBING",
  "WATER_LEAK",
  "FURNITURE",
  "AIR_CONDITIONER",
  "PAINTING",
  "CLEANING",
  "GENERAL_MAINTENANCE",
] as const;

export function translateKycState(state?: string | null) {
  const labels: Record<string, string> = {
    NONE: "Chưa nộp hồ sơ",
    PENDING: "Đang chờ duyệt",
    APPROVED: "Đã duyệt",
    REJECTED: "Bị từ chối",
  };
  return state ? labels[state] ?? state : "Chưa nộp hồ sơ";
}

export function translateStatus(status?: string | null) {
  const labels: Record<string, string> = {
    ACTIVE: "Đang hoạt động",
    AVAILABLE: "Còn trống",
    RENTED: "Đã cho thuê",
    PENDING: "Đang chờ xử lý",
    APPROVED: "Đã duyệt",
    REJECTED: "Đã từ chối",
    CLOSED: "Đã đóng",
    OPEN: "Đang mở",
    IN_PROGRESS: "Đang xử lý",
    RESOLVED: "Đã giải quyết",
    ACCEPTED: "Đã chấp nhận",
    DECLINED: "Đã từ chối",
  };
  return status ? labels[status] ?? status : "Chưa cập nhật";
}
