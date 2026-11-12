"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AdminStatsResponse, Role } from "@/types/models";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  LANDLORD: "Chủ trọ",
  TENANT: "Người thuê",
  STAFF: "Thợ / Dịch vụ",
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<AdminStatsResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.statistics
      .getAdminStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được số liệu."))
      .finally(() => setIsLoading(false));
  }, []);

  const overview = stats?.overview;
  const value = (n: number | undefined) => (isLoading ? "..." : formatNumber(n ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Quản trị nền tảng</p>
        <h1 className="text-[28px] font-semibold text-[#203c37] mt-1">Tổng quan nền tảng</h1>
        <p className="text-[14px] text-[#74817b] mt-1">Một góc nhìn chung cho hệ thống 5K-Rental Manager.</p>
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Người dùng" value={value(overview?.totalUsers)} />
        <KpiCard label="Tin đăng" value={value(overview?.totalPosts)} />
        <KpiCard label="Lịch xem phòng" value={value(overview?.totalAppointments)} />
        <KpiCard label="Tin chờ kiểm duyệt" value={value(overview?.pendingPosts)} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-[#203c37]">Người dùng theo vai trò</h2>
          <div className="mt-5 divide-y divide-[#eef3ef]">
            {(stats?.usersByRole ?? []).map((item) => (
              <div key={item.role} className="flex items-center justify-between py-3 text-[14px] text-[#203c37]">
                <span>{ROLE_LABELS[item.role] ?? item.role}</span>
                <span className="font-semibold">{formatNumber(item.count)}</span>
              </div>
            ))}
            {!isLoading && stats && stats.usersByRole.length === 0 && (
              <p className="py-3 text-[14px] text-[#74817b]">Chưa có dữ liệu.</p>
            )}
          </div>
        </section>

        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm">
          <h2 className="text-[17px] font-semibold text-[#203c37]">Ưu tiên xử lý hôm nay</h2>
          <div className="mt-5 space-y-3">
            <PriorityRow label="Tin chờ kiểm duyệt" value={overview?.pendingPosts} loading={isLoading} />
            <PriorityRow label="Báo cáo vi phạm" value={overview?.pendingReports} loading={isLoading} />
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-sm">
      <p className="text-[13px] text-[#74817b]">{label}</p>
      <p className={`mt-2 text-[24px] font-semibold ${accent ? "text-[#9a6a12]" : "text-[#203c37]"}`}>{value}</p>
    </div>
  );
}

function PriorityRow({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[8px] bg-[#f7f6f2] px-4 py-3">
      <span className="text-[14px] text-[#203c37]">{label}</span>
      <span className="rounded-full bg-[#fbf1dc] px-2.5 py-0.5 text-[13px] font-semibold text-[#9a6a12]">
        {loading ? "..." : formatNumber(value ?? 0)}
      </span>
    </div>
  );
}
