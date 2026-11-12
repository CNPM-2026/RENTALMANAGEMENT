"use client";

import { KycSubmissionForm } from "@/components/kyc/kyc-submission-form";

/**
 * Trang KYC của CHỦ TRỌ.
 *
 * Toàn bộ logic nộp/duyệt nằm ở component dùng chung `KycSubmissionForm`
 * (cùng API `/users/kyc`, cùng bảng `kyc_submissions`, cùng hàng đợi admin với
 * hồ sơ của thợ). Trang này chỉ giữ phần chữ nghĩa riêng của chủ trọ, nên hành vi
 * hiện có của chủ trọ không thay đổi.
 */
export default function LandlordKycPage() {
  return (
    <KycSubmissionForm
      eyebrow="Tài khoản chủ trọ"
      title="Yêu cầu kiểm duyệt KYC"
      description="Gửi thông tin định danh để admin xác minh tài khoản chủ trọ."
      submitLabel="Gửi yêu cầu kiểm duyệt"
      successMessage="Đã gửi yêu cầu KYC, vui lòng chờ admin kiểm duyệt."
    />
  );
}
