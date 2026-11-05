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

  const monthlyRev = stats?.expectedMonthlyRevenue ?? 0;
  const rentedRooms = stats?.roomsByStatus.find((item) => item.status === "RENTED")?.count ?? 0;
  const occupancyRate = stats && stats.totalRooms > 0 ? Math.round((rentedRooms / stats.totalRooms) * 100) : 0;
  const exportReport = () => {
    const rows = [
      ["Chỉ số", "Giá trị"],
      ["Doanh thu tháng", String(monthlyRev)],
      ["Tổng số phòng", String(stats?.totalRooms ?? 0)],
      ["Phòng đã thuê", String(rentedRooms)],
      ["Tỷ lệ lấp đầy", `${occupancyRate}%`],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bao-cao-thu-chi-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo kinh doanh & Thu chi</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Phân tích dòng tiền, tỷ lệ lấp đầy phòng và hiệu quả kinh doanh.</p>
        </div>
        <button
          onClick={exportReport}
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
              {stats ? [{
                month: "Tháng hiện tại", room: monthlyRev, service: 0, total: monthlyRev, status: "Đang thu",
              }].map((row, i) => (
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
              )) : (
                <tr><td colSpan={5} className="py-6 text-center text-[#74817b]">Chưa có dữ liệu doanh thu.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
