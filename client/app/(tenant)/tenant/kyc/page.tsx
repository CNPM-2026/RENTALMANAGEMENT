"use client";

import Link from "next/link";
import { KycSubmissionForm } from "@/components/kyc/kyc-submission-form";

/**
 * Trang KYC của KHÁCH THUÊ.
 *
 * Dùng chung bảng `kyc_submissions`, endpoint `/users/kyc` và hàng đợi duyệt của
 * admin với chủ trọ/thợ. Server bắt buộc hồ sơ APPROVED trước khi khách thuê gửi
 * yêu cầu thuê phòng (`rentalRequestService.create`).
 */
export default function TenantKycPage() {
  return (
    <KycSubmissionForm
      eyebrow="Tài khoản khách thuê"
      title="Xác minh danh tính (KYC)"
      description="Xác thực CCCD một lần để đủ điều kiện gửi yêu cầu thuê phòng."
      submitLabel="Gửi hồ sơ xác minh"
      successMessage="Đã gửi hồ sơ KYC. Bạn sẽ nhận được thông báo khi quản trị viên duyệt xong."
      notice={
        <div className="space-y-1.5">
          <p className="font-semibold">Vì sao khách thuê cần KYC?</p>
          <p className="text-[#74817b]">
            Hồ sơ đã duyệt là điều kiện bắt buộc để gửi yêu cầu thuê phòng. Sau khi được duyệt,
            ảnh CCCD sẽ được xoá khỏi Cloudinary và tài khoản không thể nộp lại hồ sơ KYC.
          </p>
          <Link href="/tenant/profile" className="inline-block text-[#15594f] font-semibold hover:underline">
            ← Về hồ sơ cá nhân
          </Link>
        </div>
      }
    />
  );
}
