"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse } from "@/types/models";

export default function AdminStatsLandlordsPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    apiClient.statistics.getAdminStats().then(setStats).catch(() => setError("Không tải được thống kê chủ trọ."));
  }, []);
  const landlords = stats?.usersByRole.find((item) => item.role === "LANDLORD")?.count ?? 0;
  const properties = stats?.overview.totalProperties ?? 0;
  return <div className="space-y-6">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p><h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Đối tác Chủ trọ</h1><p className="text-[14px] text-[#74817b] mt-0.5">Quy mô cơ sở và tỷ lệ xác minh KYC từ dữ liệu hệ thống.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <Metric label="Tổng chủ trọ" value={stats ? landlords : "—"} note={`${properties} cơ sở đã tạo`} />
      <Metric label="Chủ trọ đã xác minh KYC" value={stats ? stats.overview.verifiedLandlords ?? 0 : "—"} note="Hồ sơ KYC trạng thái APPROVED" />
      <Metric label="Trung bình cơ sở / chủ trọ" value={stats && landlords ? (properties / landlords).toFixed(1) : "—"} note="Tính từ dữ liệu hiện có" />
    </div>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs"><p className="text-[13px] text-[#74817b]">{label}</p><p className="text-[26px] font-bold text-[#15594f] mt-1">{value}</p><p className="text-[12px] text-[#74817b] mt-1">{note}</p></div>;
}
