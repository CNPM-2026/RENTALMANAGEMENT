"use client";

import * as React from "react";
import { BarChart3, TrendingUp, DollarSign, Download, Calendar, ArrowUpRight } from "lucide-react";
import { apiClient } from "@/lib/api";
import { LandlordStatsResponse } from "@/types/models";

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordReportsPage() {
  const [stats, setStats] = React.useState<LandlordStatsResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.statistics
      .getLandlordStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const monthlyRev = stats?.expectedMonthlyRevenue ?? 28500000;
  const occupancyRate = stats && stats.totalRooms > 0 ? 85 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo kinh doanh & Thu chi</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Phân tích dòng tiền, tỷ lệ lấp đầy phòng và hiệu quả kinh doanh.</p>
        </div>
        <button
          onClick={() => alert("Xuất báo cáo Excel")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] bg-white text-[#203c37] text-[13px] font-medium hover:bg-[#f7f6f2] transition-colors shadow-xs self-start cursor-pointer"
        >
          <Download className="size-4" />
          <span>Xuất báo cáo Excel</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#74817b]">Doanh thu tháng này</span>
            <div className="size-8 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-[#15594f] mt-2">
            {isLoading ? "..." : formatCurrency(monthlyRev)}
          </p>
          <div className="flex items-center gap-1 text-[12px] text-[#15594f] mt-1">
            <TrendingUp className="size-3.5" />
            <span>+12.5% so với tháng trước</span>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#74817b]">Tỷ lệ lấp đầy</span>
            <div className="size-8 rounded-[8px] bg-[#e8f0fb] text-[#2d5d8c] flex items-center justify-center">
              <BarChart3 className="size-4" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-[#203c37] mt-2">
            {isLoading ? "..." : `${occupancyRate}%`}
          </p>
          <p className="text-[12px] text-[#74817b] mt-1">
            {stats?.totalRooms ?? 0} tổng số phòng trọ
          </p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#74817b]">Chi phí vận hành ước tính</span>
            <div className="size-8 rounded-[8px] bg-[#fbeae6] text-[#a4422c] flex items-center justify-center">
              <DollarSign className="size-4" />
            </div>
          </div>
          <p className="text-[24px] font-bold text-[#203c37] mt-2">
            {isLoading ? "..." : formatCurrency(monthlyRev * 0.15)}
          </p>
          <p className="text-[12px] text-[#74817b] mt-1">Điện, nước công cộng, vệ sinh</p>
        </div>
      </div>

      {/* Revenue History Table */}
      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <h2 className="text-[17px] font-semibold text-[#203c37]">Lịch sử doanh thu các tháng gần nhất</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Tiền phòng</th>
                <th className="py-3 px-4">Tiền dịch vụ</th>
                <th className="py-3 px-4">Tổng thu</th>
                <th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
              {[
                { month: "Tháng 11/2026", room: monthlyRev * 0.85, service: monthlyRev * 0.15, total: monthlyRev, status: "Đang thu" },
                { month: "Tháng 10/2026", room: 24000000, service: 3800000, total: 27800000, status: "Hoàn tất" },
                { month: "Tháng 09/2026", room: 24000000, service: 4100000, total: 28100000, status: "Hoàn tất" },
                { month: "Tháng 08/2026", room: 22000000, service: 3500000, total: 25500000, status: "Hoàn tất" },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-[#f7f6f2]/60 transition-colors">
                  <td className="py-3 px-4 font-semibold">{row.month}</td>
                  <td className="py-3 px-4">{formatCurrency(row.room)}</td>
                  <td className="py-3 px-4">{formatCurrency(row.service)}</td>
                  <td className="py-3 px-4 font-bold text-[#15594f]">{formatCurrency(row.total)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#eaf2ed] text-[#15594f]">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
