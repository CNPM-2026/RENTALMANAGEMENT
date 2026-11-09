export function translateRole(role?: string | null) {
  const labels: Record<string, string> = {
    ADMIN: "Quản trị viên",
    LANDLORD: "Chủ trọ",
    TENANT: "Người thuê",
    AGENT: "Môi giới",
    SUPPORT: "Bộ phận hỗ trợ",
  };
  return role ? labels[role] ?? role : "Chưa cập nhật";
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
