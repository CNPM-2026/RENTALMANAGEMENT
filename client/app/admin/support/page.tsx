"use client";

import * as React from "react";
import { LifeBuoy, Check, MessageSquare, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { SupportTicket } from "@/types/models";

export default function AdminSupportPage() {
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const loadTickets = React.useCallback(() => {
    apiClient.support.getAll().then(setTickets).catch(() => setTickets([]));
  }, []);

  React.useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const resolveTicket = async (id: string) => {
    await apiClient.support.update(id, { status: "RESOLVED" });
    loadTickets();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Quản lý Yêu cầu Hỗ trợ (Tickets)</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Tiếp nhận và giải quyết yêu cầu kỹ thuật từ người dùng và chủ trọ.</p>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
              <th className="py-3 px-4">Người gửi</th>
              <th className="py-3 px-4">Tiêu đề yêu cầu</th>
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                <td className="py-3.5 px-4 font-semibold">{t.user?.fullName ?? "Người dùng"}</td>
                <td className="py-3.5 px-4">{t.subject}</td>
                <td className="py-3.5 px-4 text-[#74817b]">{new Date(t.createdAt).toLocaleString("vi-VN")}</td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      ["RESOLVED", "CLOSED"].includes(t.status) ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#fbf1dc] text-[#9a6a12]"
                    }`}
                  >
                    {["RESOLVED", "CLOSED"].includes(t.status) ? "Đã giải quyết" : "Đang chờ"}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => resolveTicket(t.id)}
                    className="text-[12px] text-[#15594f] font-semibold hover:underline cursor-pointer"
                  >
                    {["RESOLVED", "CLOSED"].includes(t.status) ? "Đã xử lý" : "Đánh dấu đã xử lý"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
