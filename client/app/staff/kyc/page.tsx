"use client";

import Link from "next/link";
import { KycSubmissionForm } from "@/components/kyc/kyc-submission-form";

/**
 * Trang KYC của THỢ ĐỘC LẬP.
 *
 * Dùng lại NGUYÊN VẸN hạ tầng của chủ trọ: cùng endpoint `/users/kyc`, cùng bảng
 * `kyc_submissions`, cùng thư mục Cloudinary private, cùng màn duyệt của admin.
 * Không có bảng hay trạng thái KYC thứ hai cho thợ.
 *
 * Khác biệt duy nhất so với chủ trọ nằm ở phía server: hồ sơ của thợ phải được
 * duyệt (`kycGate.service`) trước khi thợ được bật "đang nhận việc".
 */
export default function StaffKycPage() {
  return (
    <KycSubmissionForm
      eyebrow="Tài khoản thợ"
      title="Xác minh danh tính (KYC)"
      description="Gửi CCCD để được xác minh trước khi nhận việc từ chủ trọ."
      submitLabel="Gửi hồ sơ xác minh"
      successMessage="Đã gửi hồ sơ KYC. Bạn sẽ nhận được thông báo khi quản trị viên duyệt xong."
      notice={
        <div className="space-y-1.5">
          <p className="font-semibold">Vì sao thợ cần KYC?</p>
          <p className="text-[#74817b]">
            Hồ sơ đã duyệt là điều kiện bắt buộc để bật trạng thái &quot;đang nhận việc&quot; và
            xuất hiện trong danh sách thợ mà chủ trọ có thể tìm thấy. Bạn vẫn có thể cập nhật
            hồ sơ, kỹ năng và giá dịch vụ khi chưa xác minh.
          </p>
          <Link href="/staff/profile" className="inline-block text-[#15594f] font-semibold hover:underline">
            ← Về hồ sơ &amp; kỹ năng
          </Link>
        </div>
      }
    />
  );
}
