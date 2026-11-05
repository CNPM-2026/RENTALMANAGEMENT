"use client";

import * as React from "react";
import { BadgeCheck, Check, X, Eye, FileText, ShieldAlert } from "lucide-react";

export default function AdminKycPage() {
  const [kycRequests, setKycRequests] = React.useState([
    {
      id: "1",
      fullName: "Đức Quang",
      cccd: "079099012345",
      address: "245 Bạch Đằng, P.15, Bình Thạnh, TP.HCM",
      submittedAt: "2026-11-04T14:20:00Z",
      status: "PENDING",
      frontIdUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
      backIdUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
    },
    {
      id: "2",
      fullName: "Võ Hoàng Yến",
      cccd: "031088009876",
      address: "12 Võ Văn Ngân, Linh Chiểu, Thủ Đức",
      submittedAt: "2026-11-05T09:10:00Z",
      status: "PENDING",
      frontIdUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
      backIdUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400",
    },
  ]);

  const handleAction = (id: string, action: "APPROVED" | "REJECTED") => {
    alert(`Đã ${action === "APPROVED" ? "phê duyệt" : "từ chối"} hồ sơ KYC`);
    setKycRequests((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tài khoản & KYC</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Xác minh Danh tính (KYC)</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Đối soát CCCD/hộ chiếu và thông tin đăng ký cơ sở kinh doanh của chủ trọ.</p>
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
                  <h3 className="text-[17px] font-bold text-[#203c37]">{req.fullName}</h3>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fbf1dc] text-[#9a6a12]">
                    Chờ duyệt
                  </span>
                </div>
                <p className="text-[13px] text-[#203c37]">Số CCCD: <span className="font-semibold">{req.cccd}</span></p>
                <p className="text-[13px] text-[#74817b]">Địa chỉ thường trú: {req.address}</p>
                <p className="text-[11px] text-[#74817b]">Nộp lúc: {new Date(req.submittedAt).toLocaleString("vi-VN")}</p>
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
