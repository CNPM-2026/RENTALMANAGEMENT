"use client";

import * as React from "react";
import { Key, ShieldCheck, Check } from "lucide-react";
import { apiClient } from "@/lib/api";
import { User } from "@/types/models";

export default function AdminRolesPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  React.useEffect(() => {
    apiClient.adminGovernance.getUsers().then(setUsers).catch(() => setUsers([]));
  }, []);
  const roles = [
    { name: "Quản trị viên", desc: "Tài khoản có quyền quản trị hệ thống", count: users.filter((user) => user.role === "ADMIN").length },
    { name: "Chủ trọ", desc: "Quản lý cơ sở, phòng, tin đăng và hợp đồng", count: users.filter((user) => user.role === "LANDLORD").length },
    { name: "Người thuê", desc: "Tìm phòng, đặt lịch và quản lý hợp đồng thuê", count: users.filter((user) => user.role === "TENANT").length },
    { name: "Môi giới", desc: "Hỗ trợ dẫn xem phòng và quản lý hoa hồng", count: users.filter((user) => user.role === "AGENT").length },
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
