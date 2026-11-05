"use client";

import * as React from "react";
import { Scale, Check, AlertCircle } from "lucide-react";

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Quản lý Khiếu nại & Tranh chấp</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Hòa giải các tranh chấp về tiền cọc, hợp đồng hoặc quyền lợi giữa chủ trọ và người thuê.</p>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
        <Scale className="size-12 text-[#9bb5a8] mx-auto mb-3" />
        <h3 className="text-[16px] font-semibold text-[#203c37]">Không có tranh chấp nào đang mở</h3>
        <p className="text-[13px] text-[#74817b] mt-1">Các khiếu nại tranh chấp hợp đồng cần can thiệp pháp lý sẽ hiển thị tại đây.</p>
      </div>
    </div>
  );
}
