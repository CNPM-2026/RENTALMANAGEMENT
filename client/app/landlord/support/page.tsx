"use client";

import * as React from "react";
import { LifeBuoy, Phone, Mail, MessageCircle, HelpCircle, FileText } from "lucide-react";

export default function LandlordSupportPage() {
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
    </div>
  );
}
