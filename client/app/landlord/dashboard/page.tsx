"use client";

import * as React from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { LandlordStatsResponse, RoomStatus } from "@/types/models";

const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  AVAILABLE: "Trống",
  RENTED: "Đang thuê",
  MAINTENANCE: "Bảo trì",
};

const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  AVAILABLE: "#9bb5a8",
  RENTED: "#15594f",
  MAINTENANCE: "#c96a52",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

export default function LandlordDashboardPage() {
  const [stats, setStats] = React.useState<LandlordStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [fullName, setFullName] = React.useState("");

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setFullName(getCurrentUser()?.fullName ?? "");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    apiClient.statistics
      .getLandlordStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được số liệu."))
      .finally(() => setIsLoading(false));
  }, []);

  const rentedCount = stats?.roomsByStatus.find((item) => item.status === "RENTED")?.count ?? 0;
  const occupancy = stats && stats.totalRooms > 0 ? Math.round((rentedCount / stats.totalRooms) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tổng quan</p>
        <h1 className="text-[28px] font-semibold text-[#203c37] mt-1">
          Chào {fullName ? `anh/chị ${fullName}` : "bạn"}
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">Mọi chốn ở, trong một góc nhìn.</p>
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Doanh thu dự kiến / tháng" value={isLoading ? "..." : formatCurrency(stats?.expectedMonthlyRevenue ?? 0)} />
        <KpiCard label="Tổng số phòng" value={isLoading ? "..." : String(stats?.totalRooms ?? 0)} />
        <KpiCard label="Phòng đang thuê" value={isLoading ? "..." : `${rentedCount} / ${stats?.totalRooms ?? 0}`} hint={`${occupancy}% lấp đầy`} />
        <KpiCard label="Lịch xem chờ xác nhận" value={isLoading ? "..." : String(stats?.pendingAppointments ?? 0)} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-[#203c37]">Cơ cấu phòng</h2>
          <p className="text-[13px] text-[#74817b] mt-1">Số phòng theo trạng thái hiện tại</p>
          <div className="mt-5 space-y-4">
            {(["RENTED", "AVAILABLE", "MAINTENANCE"] as RoomStatus[]).map((status) => {
              const count = stats?.roomsByStatus.find((item) => item.status === status)?.count ?? 0;
              const width = stats && stats.totalRooms > 0 ? (count / stats.totalRooms) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-[14px] text-[#203c37]">
                    <span className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: ROOM_STATUS_COLORS[status] }} />
                      {ROOM_STATUS_LABELS[status]}
                    </span>
                    <span className="font-semibold">{count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#eef3ef]">
                    <div className="h-2 rounded-full" style={{ width: `${width}%`, backgroundColor: ROOM_STATUS_COLORS[status] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-[#203c37]">Cần bạn xử lý</h2>
          <div className="mt-5 flex items-center justify-between rounded-[8px] bg-[#f7f6f2] px-4 py-3">
            <span className="text-[14px] text-[#203c37]">Lịch xem chờ xác nhận</span>
            <span className="rounded-full bg-[#e8f0fb] px-2.5 py-0.5 text-[13px] font-semibold text-[#2d5d8c]">
              {stats?.pendingAppointments ?? 0}
            </span>
          </div>
          <Link href="/landlord/calendar" className="mt-4 inline-block text-[14px] font-medium text-[#15594f] hover:underline">
            Xem lịch xem phòng →
          </Link>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-sm">
      <p className="text-[13px] text-[#74817b]">{label}</p>
      <p className={`mt-2 text-[24px] font-semibold ${accent ? "text-[#9a6a12]" : "text-[#203c37]"}`}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-[#15594f]">{hint}</p>}
    </div>
  );
}
