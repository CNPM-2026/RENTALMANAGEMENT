"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, FileCheck, User } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { ContractLifecyclePanel } from "@/components/contracts/contract-lifecycle-panel";
import type { Contract } from "@/types/models";

function formatDate(value?: string | null) {
  if (!value) return "Vô thời hạn";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function LandlordContractDetailPage() {
  const params = useParams();
  const contractId = params?.id as string;
  const [contract, setContract] = React.useState<Contract | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const items = await apiClient.contracts.getMyContracts();
      const found = items.find((item) => item.id === contractId);
      if (!found) throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền xem.");
      setContract(found);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được hợp đồng.");
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  // Nạp dữ liệu lần đầu bằng promise callback để không setState đồng bộ trong effect.
  React.useEffect(() => {
    let isCancelled = false;
    apiClient.contracts
      .getMyContracts()
      .then((items) => {
        if (isCancelled) return;
        const found = items.find((item) => item.id === contractId);
        if (!found) throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền xem.");
        setContract(found);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : "Không tải được hợp đồng.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [contractId]);

  if (isLoading) {
    return <div className="p-8 text-center text-[13px] text-[#74817b]">Đang tải hợp đồng...</div>;
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        <p className="rounded-[8px] border border-[#efc6bb] bg-[#fbeae6] px-3 py-2 text-[13px] text-[#a4422c]">
          {error ?? "Không tìm thấy hợp đồng."}
        </p>
        <Link href="/landlord/contracts" className="text-[13px] font-semibold text-[#15594f] underline">
          Quay lại danh sách hợp đồng
        </Link>
      </div>
    );
  }

  const property = contract.room?.property;
  const isExpired = contract.isExpired || contract.status === "EXPIRED";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/landlord/contracts"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
          >
            <ArrowLeft className="size-3.5" /> Danh sách hợp đồng
          </Link>
          <h1 className="text-[26px] font-semibold text-[#203c37]">Chi tiết hợp đồng</h1>
          <p className="text-[13px] text-[#74817b]">
            Mã hợp đồng: <strong className="text-[#203c37]">{contract.id}</strong>
          </p>
        </div>
        <Badge variant={isExpired ? "warning" : contract.status === "ACTIVE" ? "success" : "neutral"}>
          {isExpired
            ? "Đã đến hạn ký tiếp"
            : contract.status === "ACTIVE"
              ? "Đang hiệu lực"
              : contract.status === "TERMINATED"
                ? "Đã chấm dứt"
                : "Chờ ký"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] text-[#74817b]"><User className="size-3" /> Khách thuê</p>
          <p className="mt-1 text-[14px] font-semibold text-[#203c37]">{contract.tenant?.fullName ?? "Chưa cập nhật"}</p>
          <p className="text-[12px] text-[#74817b]">{contract.tenant?.phone ?? "Chưa có SĐT"}</p>
        </div>
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] text-[#74817b]"><Building2 className="size-3" /> Phòng</p>
          <p className="mt-1 text-[14px] font-semibold text-[#203c37]">Phòng {contract.room?.roomNumber ?? "—"}</p>
          <p className="text-[12px] text-[#74817b]">{property?.name ?? "Chưa cập nhật"}</p>
        </div>
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] text-[#74817b]"><CalendarDays className="size-3" /> Thời hạn</p>
          <p className="mt-1 text-[14px] font-semibold text-[#203c37]">{formatDate(contract.startDate)}</p>
          <p className="text-[12px] text-[#74817b]">đến {formatDate(contract.endDate)}</p>
        </div>
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white p-4">
          <p className="flex items-center gap-1 text-[11px] text-[#74817b]"><FileCheck className="size-3" /> Tài chính</p>
          <p className="mt-1 text-[14px] font-semibold text-[#15594f]">
            {formatCurrency(contract.monthlyRent, { showUnit: false })} đ/tháng
          </p>
          <p className="text-[12px] text-[#74817b]">
            Cọc {formatCurrency(contract.depositPaid, { showUnit: false })} đ
          </p>
        </div>
      </div>

      <ContractLifecyclePanel
        contract={contract}
        role="LANDLORD"
        currentUserId={property?.landlord?.id ?? ""}
        onChanged={() => void load()}
      />
    </div>
  );
}
