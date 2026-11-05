"use client";

import * as React from "react";
import { AlertTriangle, Check, ShieldAlert, Eye, User } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Report } from "@/types/models";

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);

  React.useEffect(() => {
    apiClient.reports.getAll({ status: "PENDING" }).then(setReports).catch(() => setReports([]));
  }, []);

  const handleResolve = async (id: string) => {
    await apiClient.reports.resolve(id, { status: "RESOLVED" });
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
                <p className="text-[13px] text-[#74817b]">Đối tượng: {rep.targetId}</p>
                <p className="text-[11px] text-[#74817b]">
                  Người báo cáo: {rep.reporter?.fullName ?? rep.reporterId} • {new Date(rep.createdAt).toLocaleString("vi-VN")}
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
