"use client";

import * as React from "react";
import { BadgeCheck, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { translateRole } from "@/lib/labels";
import type { KycSubmission, KycRole } from "@/types/models";

/**
 * Hàng đợi KYC của ADMIN — DÙNG CHUNG cho chủ trọ và thợ.
 *
 * Chỉ có một bảng `kyc_submissions` và một endpoint duyệt, nên không tồn tại màn
 * duyệt thứ hai cho thợ. Bộ lọc role chỉ chia hàng đợi cho dễ xử lý, không đổi
 * quyền hay kết quả duyệt. Duyệt hồ sơ của thợ chính là điều kiện mở khoá cho
 * `kycGate.service` (thợ chỉ được bật "đang nhận việc" khi hồ sơ APPROVED).
 */
const ROLE_FILTERS: Array<{ key: KycRole | "ALL"; label: string }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "LANDLORD", label: "Chủ trọ" },
  { key: "STAFF", label: "Thợ dịch vụ" },
];

export default function AdminKycPage() {
  const [kycRequests, setKycRequests] = React.useState<KycSubmission[]>([]);
  const [roleFilter, setRoleFilter] = React.useState<KycRole | "ALL">("ALL");

  React.useEffect(() => {
    apiClient.adminGovernance
      .getKyc("PENDING", roleFilter === "ALL" ? undefined : roleFilter)
      .then(setKycRequests)
      .catch(() => setKycRequests([]));
  }, [roleFilter]);

  const handleAction = async (id: string, action: "APPROVED" | "REJECTED") => {
    await apiClient.adminGovernance.updateKyc(id, { status: action });
    setKycRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tài khoản & KYC</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Xác minh Danh tính (KYC)</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Đối soát CCCD/hộ chiếu cho chủ trọ và thợ dịch vụ. Hồ sơ của thợ phải được duyệt
          trước khi họ có thể bật trạng thái nhận việc.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ROLE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setRoleFilter(filter.key)}
            className={`px-3 py-1.5 rounded-[7px] border text-[12px] font-semibold cursor-pointer transition-colors ${
              roleFilter === filter.key
                ? "border-[#15594f] bg-[#15594f] text-white"
                : "border-[#e2e7e1] bg-white text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {kycRequests.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <BadgeCheck className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không còn hồ sơ chờ duyệt</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Tất cả yêu cầu xác minh đã được xử lý xong.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {kycRequests.map((req) => (
            <div
              key={req.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-[17px] font-bold text-[#203c37]">{req.user?.fullName ?? "Người dùng"}</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                    {translateRole(req.user?.role)}
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fbf1dc] text-[#9a6a12]">
                    Chờ duyệt
                  </span>
                </div>
                <p className="text-[13px] text-[#203c37]">Số CCCD: <span className="font-semibold">{req.idNumber}</span></p>
                <p className="text-[13px] text-[#74817b]">Địa chỉ thường trú: {req.permanentAddress}</p>
                <p className="text-[11px] text-[#74817b]">Nộp lúc: {new Date(req.createdAt).toLocaleString("vi-VN")}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => handleAction(req.id, "APPROVED")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] cursor-pointer"
                >
                  <Check className="size-4" />
                  <span>Duyệt hồ sơ</span>
                </button>
                <button
                  onClick={() => handleAction(req.id, "REJECTED")}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] text-[#a4422c] hover:bg-[#fbeae6] text-[13px] font-semibold cursor-pointer"
                >
                  <X className="size-4" />
                  <span>Từ chối</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
