"use client";

import * as React from "react";
import { UserCog, Plus, ShieldCheck, Mail, Phone, MoreVertical } from "lucide-react";

export default function LandlordStaffPage() {
  const staffList = [
    { id: "1", name: "Nguyễn Văn Hưng", role: "Quản lý tòa nhà", phone: "0912 345 678", email: "hung.nv@rental.vn", status: "Hoạt động" },
    { id: "2", name: "Trần Thị Mai", role: "Kế toán / Thu ngân", phone: "0988 765 432", email: "mai.tt@rental.vn", status: "Hoạt động" },
    { id: "3", name: "Lê Văn Tùng", role: "Kỹ thuật / Bảo trì", phone: "0903 111 222", email: "tung.lv@rental.vn", status: "Hoạt động" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Nhân viên & Phân quyền</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Phân quyền quản lý tòa nhà cho quản lý cơ sở, kế toán hoặc kỹ thuật viên.</p>
        </div>
        <button
          onClick={() => alert("Thêm tài khoản nhân viên mới")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Thêm nhân viên</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staffList.map((staff) => (
          <div key={staff.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="size-10 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center font-bold text-sm">
                  {staff.name.charAt(0)}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                  {staff.status}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">{staff.name}</h3>
              <p className="text-[12px] font-medium text-[#15594f]">{staff.role}</p>

              <div className="mt-3 space-y-1 text-[12px] text-[#74817b]">
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-[#203c37]" />
                  <span>{staff.phone}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="size-3.5 text-[#203c37]" />
                  <span>{staff.email}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#e2e7e1] flex items-center justify-between text-[12px]">
              <button
                onClick={() => alert(`Chỉnh sửa quyền nhân viên: ${staff.name}`)}
                className="text-[#15594f] font-semibold hover:underline cursor-pointer"
              >
                Chỉnh sửa quyền
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
