"use client";

import * as React from "react";
import { Users, TrendingUp, UserCheck, UserX } from "lucide-react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse } from "@/types/models";

export default function AdminStatsUsersPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.statistics.getAdminStats().then(setStats).catch(() => setError("Không tải được thống kê người dùng."));
  }, []);

  return (
    <div className="space-y-6">
      {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Người dùng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Biểu đồ tăng trưởng và cơ cấu người dùng trên hệ thống.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tổng người dùng</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">{stats?.overview.totalUsers ?? "—"}</p>
          <p className="text-[12px] text-[#15594f] mt-1">Tổng tài khoản đã đăng ký</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Người thuê (Tenants)</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">{stats?.usersByRole.find((item) => item.role === "TENANT")?.count ?? "—"}</p>
          <p className="text-[12px] text-[#74817b] mt-1">Theo vai trò TENANT</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Chủ trọ (Landlords)</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">{stats?.usersByRole.find((item) => item.role === "LANDLORD")?.count ?? "—"}</p>
          <p className="text-[12px] text-[#74817b] mt-1">Theo vai trò LANDLORD</p>
        </div>
      </div>
    </div>
  );
}
