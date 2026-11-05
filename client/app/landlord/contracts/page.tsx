"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileCheck, Search, Eye, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Contract, ContractStatus } from "@/types/models";

const STATUS_MAP: Record<ContractStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Chờ ký", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
  ACTIVE: { label: "Hiệu lực", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  EXPIRED: { label: "Hết hạn", bg: "bg-[#f7f6f2]", text: "text-[#74817b]" },
  TERMINATED: { label: "Đã chấm dứt", bg: "bg-[#fbeae6]", text: "text-[#a4422c]" },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordContractsPage() {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    apiClient.contracts
      .getMyContracts()
      .then((data) => setContracts(data ?? []))
      .catch(() => setContracts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = contracts.filter((c) =>
    (c.tenant?.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.room?.roomNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Cho thuê</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Hợp đồng & Đặt cọc</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý các hợp đồng thuê nhà điện tử và tiền cọc phòng.</p>
        </div>
        <button
          onClick={() => alert("Mở form lập hợp đồng mới")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Lập hợp đồng mới</span>
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên khách thuê hoặc số phòng..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <FileCheck className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có hợp đồng nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Khi bạn ký hợp đồng với khách thuê, thông tin hợp đồng sẽ hiển thị ở đây.</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                  <th className="py-3 px-4">Khách thuê</th>
                  <th className="py-3 px-4">Phòng</th>
                  <th className="py-3 px-4">Thời hạn</th>
                  <th className="py-3 px-4">Tiền thuê</th>
                  <th className="py-3 px-4">Tiền cọc</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
                {filtered.map((item) => {
                  const st = STATUS_MAP[item.status] || STATUS_MAP.ACTIVE;
                  return (
                    <tr key={item.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                      <td className="py-3.5 px-4 font-semibold">{item.tenant?.fullName || "Khách thuê"}</td>
                      <td className="py-3.5 px-4 font-medium">Phòng {item.room?.roomNumber || "---"}</td>
                      <td className="py-3.5 px-4 text-[#74817b]">
                        {new Date(item.startDate).toLocaleDateString("vi-VN")} - {item.endDate ? new Date(item.endDate).toLocaleDateString("vi-VN") : "Vô thời hạn"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#15594f]">{formatCurrency(item.monthlyRent)}</td>
                      <td className="py-3.5 px-4">{formatCurrency(item.depositPaid)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/tenant/contracts/${item.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
