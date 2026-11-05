"use client";

import * as React from "react";
import { AlertTriangle, Check, ShieldAlert, Eye, User } from "lucide-react";
import { apiClient } from "@/lib/api";

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState([
    {
      id: "1",
      reason: "Tin đăng phòng sai địa chỉ thực tế",
      description: "Tôi đến xem phòng nhưng địa chỉ trên tin đăng là quận 1, thực tế phòng nằm ở quận 4.",
      reporterName: "Nguyễn Văn Nam",
      targetType: "POST",
      createdAt: "2026-11-04T16:00:00Z",
      status: "PENDING",
    },
    {
      id: "2",
      reason: "Chủ trọ đòi tiền cọc bất thường không có hợp đồng",
      description: "Chủ trọ yêu cầu chuyển khoản 5 triệu trước khi xem phòng.",
      reporterName: "Lê Thị Phương",
      targetType: "USER",
      createdAt: "2026-11-05T01:30:00Z",
      status: "PENDING",
    },
  ]);

  const handleResolve = (id: string) => {
    alert("Đã xử lý xong báo cáo vi phạm");
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo Vi phạm & Khiếu nại</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Tiếp nhận phản ánh từ cộng đồng người thuê về thông tin sai lệch, lừa đảo.</p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <AlertTriangle className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có báo cáo nào tồn đọng</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Hệ thống đang vận hành an toàn và minh bạch.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[16px] text-[#203c37]">{rep.reason}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fbeae6] text-[#a4422c]">
                    {rep.targetType === "POST" ? "Vi phạm tin đăng" : "Vi phạm người dùng"}
                  </span>
                </div>
                <p className="text-[13px] text-[#74817b]">{rep.description}</p>
                <p className="text-[11px] text-[#74817b]">
                  Người báo cáo: {rep.reporterName} • {new Date(rep.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleResolve(rep.id)}
                  className="px-3.5 py-2 rounded-[8px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] cursor-pointer"
                >
                  Đã giải quyết
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
