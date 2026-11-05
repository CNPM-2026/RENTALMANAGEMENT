"use client";

import * as React from "react";
import { Key, ShieldCheck, Check } from "lucide-react";

export default function AdminRolesPage() {
  const roles = [
    { name: "Super Admin", desc: "Toàn quyền cấu hình, xóa dữ liệu và quản trị nhân sự", count: 2 },
    { name: "Kiểm duyệt viên (Moderator)", desc: "Quyền duyệt bài đăng, xử lý báo cáo vi phạm và kiểm tra KYC", count: 5 },
    { name: "CSKH & Hỗ trợ kỹ thuật", desc: "Quyền tiếp nhận và trả lời tickets của người thuê & chủ trọ", count: 8 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Quản trị hệ thống</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Phân quyền Vai trò (RBAC)</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Thiết lập ma trận phân quyền chi tiết cho các cấp bậc nhân viên.</p>
      </div>

      <div className="space-y-4">
        {roles.map((r, i) => (
          <div key={i} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-[16px] font-bold text-[#203c37]">{r.name}</h3>
              <p className="text-[13px] text-[#74817b]">{r.desc}</p>
            </div>
            <span className="text-[13px] font-semibold text-[#15594f] bg-[#eaf2ed] px-3 py-1 rounded-full">
              {r.count} nhân sự
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
