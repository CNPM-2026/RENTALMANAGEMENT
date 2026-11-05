"use client";

import * as React from "react";
import { ShieldAlert, Search, Filter, AlertOctagon } from "lucide-react";

export default function AdminFraudPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Điều tra Tin giả & Lừa đảo</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Hệ thống AI quét tự động phát hiện số điện thoại lừa đảo, trùng lặp hình ảnh hoặc giá bất thường.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tin nghi vấn lừa đảo</p>
          <p className="text-[26px] font-bold text-[#a4422c] mt-1">2</p>
          <p className="text-[11px] text-[#74817b] mt-1">Do hệ thống AI gắn cờ</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Số điện thoại vào sổ đen</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">18</p>
          <p className="text-[11px] text-[#74817b] mt-1">Đã chặn đăng ký tài khoản</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Độ tin cậy toàn sàn</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">99.4%</p>
          <p className="text-[11px] text-[#74817b] mt-1">Chỉ số an toàn bảo vệ người thuê</p>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <h3 className="text-[16px] font-semibold text-[#203c37] mb-3">Danh sách cảnh báo tự động</h3>
        <div className="divide-y divide-[#eef3ef]">
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-[14px] text-[#203c37]">Phòng cao cấp Quận 1 giá 800k (Bất thường)</p>
              <p className="text-[12px] text-[#74817b]">Phát hiện giá thuê thấp hơn 85% so với mặt bằng khu vực Bến Nghé.</p>
            </div>
            <button
              onClick={() => alert("Đã đình chỉ tin đăng")}
              className="px-3 py-1.5 rounded-[6px] bg-[#a4422c] text-white text-[12px] font-medium cursor-pointer"
            >
              Khóa tin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
