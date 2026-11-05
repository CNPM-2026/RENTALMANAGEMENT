"use client";

import * as React from "react";
import { UserCog, Plus, ShieldCheck, Mail } from "lucide-react";

export default function AdminStaffPage() {
  const staff = [
    { id: "1", name: "Nguyễn Văn Hùng", email: "hung.nv@admin.local", role: "Super Admin", status: "Hoạt động" },
    { id: "2", name: "Lê Thị Thanh", email: "thanh.lt@admin.local", role: "Kiểm duyệt viên", status: "Hoạt động" },
    { id: "3", name: "Phạm Quốc Tuấn", email: "tuan.pq@admin.local", role: "Hỗ trợ kỹ thuật", status: "Hoạt động" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Quản trị hệ thống</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Nhân viên Quản trị</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý đội ngũ vận hành và kiểm duyệt viên của nền tảng 5K-Rental Manager.</p>
        </div>
        <button
          onClick={() => alert("Thêm quản trị viên mới")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Thêm quản trị viên</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staff.map((s) => (
          <div key={s.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="size-10 rounded-full bg-[#15594f] text-white flex items-center justify-center font-bold text-sm">
                {s.name.charAt(0)}
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                {s.status}
              </span>
            </div>
            <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">{s.name}</h3>
            <p className="text-[12px] font-medium text-[#15594f] mt-0.5">{s.role}</p>
            <p className="text-[12px] text-[#74817b] mt-2">{s.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
