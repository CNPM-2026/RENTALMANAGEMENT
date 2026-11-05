"use client";

import * as React from "react";
import { Users, TrendingUp, UserCheck, UserX } from "lucide-react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse } from "@/types/models";

export default function AdminStatsUsersPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);

  React.useEffect(() => {
    apiClient.statistics.getAdminStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Người dùng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Biểu đồ tăng trưởng và cơ cấu người dùng trên hệ thống.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tổng người dùng</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">{stats?.overview.totalUsers ?? 128}</p>
          <p className="text-[12px] text-[#15594f] mt-1">+18 người trong tuần này</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Người thuê (Tenants)</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">94</p>
          <p className="text-[12px] text-[#74817b] mt-1">Chiếm 73.4% tổng tài khoản</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Chủ trọ (Landlords)</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">34</p>
          <p className="text-[12px] text-[#74817b] mt-1">Chiếm 26.6% tổng tài khoản</p>
        </div>
      </div>
    </div>
  );
}
