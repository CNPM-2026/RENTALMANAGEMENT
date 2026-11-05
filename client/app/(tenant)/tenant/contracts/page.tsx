"use client";

import * as React from "react";
import Link from "next/link";
import { FileCheck, Eye } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Contract, ContractStatus } from "@/types/models";

const labels: Record<ContractStatus, string> = {
  PENDING: "Chờ ký",
  ACTIVE: "Đang hiệu lực",
  EXPIRED: "Hết hạn",
  TERMINATED: "Đã chấm dứt",
};

export default function TenantContractsPage() {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.contracts.getMyContracts().then(setContracts).catch(() => setError("Không tải được danh sách hợp đồng."));
  }, []);

  return <div className="space-y-6">
    <div><p className="text-[12px] text-[#74817b]">Tài khoản</p><h1 className="text-[26px] font-semibold text-[#203c37]">Hợp đồng của tôi</h1><p className="text-[14px] text-[#74817b]">Theo dõi hợp đồng thuê phòng và trạng thái ký.</p></div>
    {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {contracts.length === 0 ? <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center"><FileCheck className="size-12 mx-auto mb-3 text-[#9bb5a8]" /><p className="font-semibold text-[#203c37]">Chưa có hợp đồng</p></div> :
      <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f7f6f2] text-xs text-[#74817b]"><tr><th className="p-4">Phòng</th><th className="p-4">Thời hạn</th><th className="p-4">Tiền thuê</th><th className="p-4">Trạng thái</th><th className="p-4" /></tr></thead><tbody className="divide-y divide-[#eef3ef]">{contracts.map((contract) => <tr key={contract.id}><td className="p-4 font-semibold">Phòng {contract.room?.roomNumber ?? contract.roomId}</td><td className="p-4 text-[#74817b]">{new Date(contract.startDate).toLocaleDateString("vi-VN")} - {contract.endDate ? new Date(contract.endDate).toLocaleDateString("vi-VN") : "Vô thời hạn"}</td><td className="p-4 font-semibold text-[#15594f]">{contract.monthlyRent.toLocaleString("vi-VN")} đ/tháng</td><td className="p-4">{labels[contract.status]}</td><td className="p-4 text-right"><Link href={`/tenant/contracts/${contract.id}`} className="inline-flex items-center gap-1 text-[#15594f] font-semibold"><Eye className="size-4" /> Xem</Link></td></tr>)}</tbody></table></div></div>}
  </div>;
}
