"use client";

import * as React from "react";
import { LifeBuoy, Check, MessageSquare, Clock } from "lucide-react";

export default function AdminSupportPage() {
  const [tickets, setTickets] = React.useState([
    { id: "1", user: "Nguyễn Văn Nam", subject: "Không nhận được mã xác nhận OTP reset mật khẩu", status: "PENDING", createdAt: "2026-11-05T03:00:00Z" },
    { id: "2", user: "Trần Minh An", subject: "Hỏi về cách xuất hóa đơn VAT cho công ty thuê trọ", status: "RESOLVED", createdAt: "2026-11-04T11:00:00Z" },
  ]);

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
                <td className="py-3.5 px-4 font-semibold">{t.user}</td>
                <td className="py-3.5 px-4">{t.subject}</td>
                <td className="py-3.5 px-4 text-[#74817b]">{new Date(t.createdAt).toLocaleString("vi-VN")}</td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      t.status === "RESOLVED" ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#fbf1dc] text-[#9a6a12]"
                    }`}
                  >
                    {t.status === "RESOLVED" ? "Đã giải quyết" : "Đang chờ"}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => alert(`Mở ticket #${t.id}`)}
                    className="text-[12px] text-[#15594f] font-semibold hover:underline cursor-pointer"
                  >
                    Trả lời ticket
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
