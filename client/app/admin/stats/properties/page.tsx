"use client";

import * as React from "react";
import { Home, MapPin, CheckCircle2 } from "lucide-react";

export default function AdminStatsPropertiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Bất động sản & Phòng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Tổng số phòng trên toàn hệ thống và tỷ lệ lấp đầy bình quân.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tổng số phòng đã tạo</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">504</p>
          <p className="text-[12px] text-[#74817b] mt-1">Trên địa bàn TP.HCM & Hà Nội</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Phòng đang có khách thuê</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">428</p>
          <p className="text-[12px] text-[#15594f] mt-1">Tỷ lệ lấp đầy sàn 84.9%</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Phòng đang trống cần khách</p>
          <p className="text-[26px] font-bold text-[#9a6a12] mt-1">76</p>
          <p className="text-[12px] text-[#74817b] mt-1">Có thể thuê ngay</p>
        </div>
      </div>
    </div>
  );
}
