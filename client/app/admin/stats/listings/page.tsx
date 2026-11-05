"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse } from "@/types/models";

export default function AdminStatsListingsPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { apiClient.statistics.getAdminStats().then(setStats).catch(() => setError("Không tải được thống kê tin đăng.")); }, []);
  return <div className="space-y-6">
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div><p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p><h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Thống kê Tin đăng cho thuê</h1><p className="text-[14px] text-[#74817b] mt-0.5">Tin đăng công khai và lượt xem được ghi nhận thực tế.</p></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <Metric label="Tin đang hiển thị công khai" value={stats ? stats.overview.publicPosts ?? 0 : "—"} note="Tin có trạng thái APPROVED" />
      <Metric label="Tổng lượt xem tin" value={stats ? (stats.overview.totalPostViews ?? 0).toLocaleString("vi-VN") : "—"} note="Tổng viewCount toàn hệ thống" />
      <Metric label="Tin đang chờ duyệt" value={stats ? stats.overview.pendingPosts : "—"} note="Cần admin xử lý" />
    </div>
  </div>;
}

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs"><p className="text-[13px] text-[#74817b]">{label}</p><p className="text-[26px] font-bold text-[#15594f] mt-1">{value}</p><p className="text-[12px] text-[#74817b] mt-1">{note}</p></div>;
}
