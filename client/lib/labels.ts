/**
 * Nguồn nhãn vai trò DUY NHẤT cho toàn bộ client.
 *
 * Mọi navbar, bảng quản trị và trang cá nhân đều đọc từ đây để tên vai trò
 * không bị lệch giữa các màn hình (ví dụ "Chủ sở hữu" vs "Chủ trọ").
 */
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  LANDLORD: "Chủ trọ",
  TENANT: "Người thuê",
  STAFF: "Thợ / Dịch vụ",
  SUPPORT: "Bộ phận hỗ trợ",
};

export function translateRole(role?: string | null) {
  return role ? ROLE_LABELS[role] ?? role : "Chưa cập nhật";
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

/**
 * Nhãn trạng thái CÔNG VIỆC bảo trì (marketplace — Batch 2/3).
 * Vòng đời: OPEN → ASSIGNED → IN_PROGRESS → SUBMITTED → COMPLETED (hoặc
 * quay lại IN_PROGRESS khi chủ trọ yêu cầu làm lại); CANCELLED là nhánh huỷ.
 */
export function translateTaskStatus(status?: string | null) {
  const labels: Record<string, string> = {
    OPEN: "Đang tìm thợ",
    ASSIGNED: "Đã giao thợ",
    IN_PROGRESS: "Thợ đang thực hiện",
    SUBMITTED: "Chờ chủ trọ nghiệm thu",
    COMPLETED: "Đã hoàn thành",
    CANCELLED: "Đã huỷ",
  };
  return status ? labels[status] ?? status : "Chưa cập nhật";
}

/** Nhãn trạng thái ĐƠN ỨNG TUYỂN của thợ (Batch 2). */
export function translateApplicationStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Chờ chủ trọ duyệt",
    ACCEPTED: "Được chấp nhận",
    REJECTED: "Bị từ chối",
    WITHDRAWN: "Đã rút đơn",
  };
  return status ? labels[status] ?? status : "Chưa cập nhật";
}

/** 🆕 Batch 3 — nhãn trạng thái ĐỀ XUẤT GIÁ. */
export function translateOfferStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Chờ phản hồi",
    ACCEPTED: "Đã chấp nhận",
    REJECTED: "Đã từ chối",
    SUPERSEDED: "Đã được thay thế",
    WITHDRAWN: "Đã rút",
  };
  return status ? labels[status] ?? status : "Chưa cập nhật";
}

/** 🆕 Batch 4 — nhãn loại tranh chấp/báo cáo. */
export function translateDisputeCategory(category?: string | null) {
  const labels: Record<string, string> = {
    WORK_QUALITY: "Chất lượng công việc",
    NO_SHOW: "Không đến làm / bỏ việc",
    PRICE_DISPUTE: "Tranh chấp giá",
    SAFETY: "An toàn",
    HARASSMENT: "Quấy rối",
    FRAUD: "Lừa đảo",
    PROPERTY_DAMAGE: "Hư hại tài sản",
    OTHER: "Khác",
  };
  return category ? labels[category] ?? category : "Khác";
}

/** Lựa chọn loại tranh chấp cho form báo cáo. */
export const DISPUTE_CATEGORY_OPTIONS = [
  { value: "WORK_QUALITY", label: "Chất lượng công việc" },
  { value: "NO_SHOW", label: "Không đến làm / bỏ việc" },
  { value: "PRICE_DISPUTE", label: "Tranh chấp giá" },
  { value: "SAFETY", label: "An toàn" },
  { value: "HARASSMENT", label: "Quấy rối" },
  { value: "FRAUD", label: "Lừa đảo" },
  { value: "PROPERTY_DAMAGE", label: "Hư hại tài sản" },
  { value: "OTHER", label: "Khác" },
] as const;

/** 🆕 Batch 4 — nhãn trạng thái xử lý tranh chấp. */
export function translateDisputeStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Chờ admin tiếp nhận",
    UNDER_REVIEW: "Đang xem xét",
    RESOLVED: "Đã giải quyết",
    REJECTED: "Không đủ căn cứ",
  };
  return status ? labels[status] ?? status : "Chờ admin tiếp nhận";
}

/**
 * 🆕 Nhãn trạng thái TIẾP NHẬN báo cáo sự cố (Batch 2 — điều chỉnh luồng).
 * Khác `translateTaskStatus`: đây là phía BÁO CÁO của khách thuê, không phải
 * công việc marketplace.
 */
export function translateTriageStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: "Chờ chủ trọ xem xét",
    REVIEWED: "Đã xem xét",
    NEEDS_INFO: "Cần bổ sung thông tin",
    REJECTED: "Bị từ chối",
  };
  return status ? labels[status] ?? status : "Chờ chủ trọ xem xét";
}

/** Lựa chọn trạng thái tiếp nhận cho chủ trọ. */
export const TRIAGE_STATUS_OPTIONS = [
  { value: "REVIEWED", label: "Đã xem xét" },
  { value: "NEEDS_INFO", label: "Cần bổ sung thông tin" },
  { value: "REJECTED", label: "Từ chối báo cáo" },
] as const;

/** Nhãn mức độ khẩn cấp của công việc. */
export function translateUrgency(urgency?: string | null) {
  const labels: Record<string, string> = {
    LOW: "Thấp",
    MEDIUM: "Bình thường",
    HIGH: "Khẩn cấp",
  };
  return urgency ? labels[urgency] ?? urgency : "Chưa cập nhật";
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
    ASSIGNED: "Đã giao thợ",
    WITHDRAWN: "Đã rút",
  };
  return status ? labels[status] ?? status : "Chưa cập nhật";
}
