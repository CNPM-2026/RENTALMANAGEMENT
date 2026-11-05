"use client";

import * as React from "react";
import { Building, ShieldCheck, TrendingUp } from "lucide-react";

export default function AdminStatsLandlordsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Đối tác Chủ trọ</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Quy mô cơ sở, tỷ lệ xác minh KYC và phân bố khu vực.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tổng chủ trọ</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">34</p>
          <p className="text-[12px] text-[#15594f] mt-1">Đang quản lý 112 dãy nhà trọ</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Chủ trọ đã xác minh KYC</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">29</p>
          <p className="text-[12px] text-[#74817b] mt-1">Tỷ lệ 85.3% đối tác uy tín</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Trung bình phòng / chủ trọ</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">14.8</p>
          <p className="text-[12px] text-[#74817b] mt-1">Quy mô tầm trung phổ biến</p>
        </div>
      </div>
    </div>
  );
}
