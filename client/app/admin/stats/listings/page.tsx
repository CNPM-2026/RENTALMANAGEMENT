"use client";

import * as React from "react";
import { FileText, Eye, CheckCircle, Clock } from "lucide-react";

export default function AdminStatsListingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Tin đăng cho thuê</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Lượng tin đăng mới, tốc độ phê duyệt và số lượt xem bài đăng.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tin đang hiển thị công khai</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">162</p>
          <p className="text-[12px] text-[#15594f] mt-1">Đã kiểm duyệt đạt chuẩn</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Lượt xem tin tuần qua</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">14,250</p>
          <p className="text-[12px] text-[#15594f] mt-1">+23.5% lượng truy cập</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Thời gian duyệt tin trung bình</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">18 phút</p>
          <p className="text-[12px] text-[#74817b] mt-1">Cam kết &lt; 30 phút</p>
        </div>
      </div>
    </div>
  );
}
