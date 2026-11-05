"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse } from "@/types/models";

export default function AdminStatsPropertiesPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { apiClient.statistics.getAdminStats().then(setStats).catch(() => setError("Không tải được thống kê phòng.")); }, []);
  const total = stats?.overview.totalRooms ?? 0;
  const occupied = stats?.overview.occupiedRooms ?? 0;
  return <div className="space-y-6">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p><h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Bất động sản & Phòng</h1><p className="text-[14px] text-[#74817b] mt-0.5">Tổng số phòng và tỷ lệ lấp đầy từ cơ sở dữ liệu.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <Metric label="Tổng số phòng đã tạo" value={stats ? total : "—"} note={`${stats?.overview.totalProperties ?? "—"} bất động sản`} />
      <Metric label="Phòng đang có khách thuê" value={stats ? occupied : "—"} note={total ? `Tỷ lệ lấp đầy ${(occupied / total * 100).toFixed(1)}%` : "Chưa có dữ liệu"} />
      <Metric label="Phòng đang trống" value={stats ? stats.overview.vacantRooms ?? 0 : "—"} note="Có thể thuê hoặc đang chờ xử lý" />
    </div>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs"><p className="text-[13px] text-[#74817b]">{label}</p><p className="text-[26px] font-bold text-[#15594f] mt-1">{value}</p><p className="text-[12px] text-[#74817b] mt-1">{note}</p></div>;
}
