"use client";

import * as React from "react";
import { LifeBuoy, Phone, Mail, MessageCircle, HelpCircle, FileText, Flag, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { readFocusParam, scrollToFocus } from "@/lib/notification-focus";
import type { Report } from "@/types/models";

export default function LandlordSupportPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [reportsError, setReportsError] = React.useState("");
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.reports
      .getMy()
      .then((items) => {
        setReports(items ?? []);
        setReportsError("");
      })
      .catch(() => setReportsError("Không tải được danh sách báo cáo của bạn."));
  }, []);

  // Thông báo DISPUTE mở `?report=<id>` và cuộn tới đúng báo cáo đã gửi.
  React.useEffect(() => {
    const id = readFocusParam("report");
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      setFocusId(id);
      scrollToFocus(`report-${id}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reports]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Hỗ trợ</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Trung tâm Hỗ trợ Chủ trọ</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Đội ngũ kỹ thuật & CSKH 5K-Rental Manager luôn đồng hành cùng bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="size-10 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center">
            <Phone className="size-5" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">Hotline khẩn cấp</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Hỗ trợ kỹ thuật và sự cố 24/7</p>
          <p className="text-[16px] font-bold text-[#15594f] mt-3">1900 6868</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="size-10 rounded-[8px] bg-[#e8f0fb] text-[#2d5d8c] flex items-center justify-center">
            <Mail className="size-5" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">Email phản hồi</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Tiếp nhận khiếu nại và hợp đồng</p>
          <p className="text-[15px] font-bold text-[#2d5d8c] mt-3">support@5k-rental.vn</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="size-10 rounded-[8px] bg-[#fbf1dc] text-[#9a6a12] flex items-center justify-center">
            <MessageCircle className="size-5" />
          </div>
          <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">Zalo OA Hỗ trợ</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Chat trực tiếp cùng tư vấn viên</p>
          <p className="text-[15px] font-bold text-[#9a6a12] mt-3">Kênh hỗ trợ chính thức của 5K-Rental Manager</p>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-4">
        <h2 className="text-[17px] font-semibold text-[#203c37]">Câu hỏi thường gặp</h2>
        <div className="space-y-3">
          {[
            { q: "Làm thế nào để tạo hợp đồng điện tử có giá trị pháp lý?", a: "Bạn vào mục 'Hợp đồng & đặt cọc', chọn 'Lập hợp đồng mới' và nhập CCCD cùng thông tin phòng. Hệ thống sẽ tự động gửi mã OTP xác nhận cho khách thuê." },
            { q: "Cách tính hóa đơn tiền điện nước tự động như thế nào?", a: "Vào mục 'Điện nước & dịch vụ', nhập số mới của tháng này. Hệ thống sẽ lấy (Số mới - Số cũ) x Đơn giá để tạo hóa đơn cho bạn chỉ trong 1 click." },
            { q: "Làm sao để đăng tin lên trang tìm kiếm của người thuê?", a: "Vào 'Tin đăng' -> 'Đăng tin mới'. Đội ngũ kiểm duyệt 5K-Rental Manager sẽ duyệt tin trong vòng 15-30 phút." },
          ].map((faq, i) => (
            <div key={i} className="p-4 rounded-[8px] bg-[#f7f6f2] border border-[#e2e7e1]">
              <p className="text-[14px] font-semibold text-[#203c37]">{faq.q}</p>
              <p className="text-[13px] text-[#74817b] mt-1.5">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-4" id="my-reports">
        <div className="flex items-center gap-2">
          <Flag className="size-4 text-[#a4422c]" />
          <h2 className="text-[17px] font-semibold text-[#203c37]">Báo cáo / tranh chấp tôi đã gửi</h2>
        </div>
        <p className="text-[13px] text-[#74817b]">
          Theo dõi kết luận của Admin. Khi có cập nhật, thông báo sẽ mở đúng báo cáo tại đây.
        </p>

        {reportsError && (
          <p className="flex items-start gap-2 rounded-[8px] border border-[#f0d5cd] bg-[#fbeae6] px-3 py-2 text-[12px] text-[#a4422c]">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {reportsError}
          </p>
        )}

        {reports.length === 0 ? (
          <p className="text-[13px] text-[#74817b]">Bạn chưa gửi báo cáo nào.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.id}
                id={`report-${report.id}`}
                className={`scroll-mt-24 rounded-[8px] border p-3 ${
                  focusId === report.id
                    ? "border-[#15594f] bg-[#eaf2ed]/40 ring-2 ring-[#15594f]/20"
                    : "border-[#eef3ef]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#203c37]">
                    {report.category ?? "Báo cáo vi phạm"}
                  </p>
                  <span className="rounded-full bg-[#f7f6f2] px-2 py-0.5 text-[11px] font-semibold text-[#74817b]">
                    {report.status === "RESOLVED"
                      ? "Đã giải quyết"
                      : report.status === "REJECTED"
                        ? "Đã bác bỏ"
                        : report.status === "UNDER_REVIEW"
                          ? "Đang xem xét"
                          : "Chờ xử lý"}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-[12px] text-[#5c6964]">{report.reason}</p>
                {report.resolution && (
                  <p className="mt-1 text-[12px] text-[#15594f]">Kết luận: {report.resolution}</p>
                )}
                <p className="mt-1 text-[11px] text-[#74817b]">
                  Gửi lúc {new Date(report.createdAt).toLocaleString("vi-VN")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
