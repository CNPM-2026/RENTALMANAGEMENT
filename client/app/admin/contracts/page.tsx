"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileCheck, FileWarning, Paperclip, XCircle } from "lucide-react";
import { apiClient, resolveMediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  CONTRACT_TERMINATION_REASON_LABELS,
  CONTRACT_TERMINATION_STATUS_LABELS,
  DEPOSIT_REFUND_STATUS_LABELS,
  TERMINATION_STATUS_CLASS,
} from "@/lib/contract-lifecycle";
import type { ContractTerminationRequest, ContractTerminationStatus } from "@/types/models";

const TABS: Array<{ value: ContractTerminationStatus | "ALL"; label: string }> = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Đã từ chối" },
  { value: "ALL", label: "Tất cả" },
];

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function AdminContractsPage() {
  const [requests, setRequests] = React.useState<ContractTerminationRequest[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<ContractTerminationStatus | "ALL">("PENDING");
  const [isLoading, setIsLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [refunds, setRefunds] = React.useState<Record<string, string>>({});
  const [effectiveDates, setEffectiveDates] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async (status: ContractTerminationStatus | "ALL") => {
    try {
      const items = await apiClient.contracts.getTerminationRequests(
        status === "ALL" ? undefined : status,
      );
      setRequests(items ?? []);
      setError(null);
    } catch (err) {
      setRequests([]);
      setError(err instanceof Error ? err.message : "Không tải được yêu cầu chấm dứt hợp đồng.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Nạp dữ liệu lần đầu bằng promise callback để không setState đồng bộ trong effect.
  React.useEffect(() => {
    let isCancelled = false;
    apiClient.contracts
      .getTerminationRequests(statusFilter === "ALL" ? undefined : statusFilter)
      .then((items) => {
        if (isCancelled) return;
        setRequests(items ?? []);
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setRequests([]);
        setError(err instanceof Error ? err.message : "Không tải được yêu cầu chấm dứt hợp đồng.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [statusFilter]);

  const review = async (
    request: ContractTerminationRequest,
    status: "APPROVED" | "REJECTED",
  ) => {
    const note = (notes[request.id] ?? "").trim();
    if (note.length < 10) {
      setError("Cần nêu kết luận ít nhất 10 ký tự trước khi duyệt hoặc từ chối.");
      return;
    }
    const deposit = Number(request.contract?.depositPaid ?? 0);
    const refundAmount =
      status === "APPROVED"
        ? request.reason === "LANDLORD_VIOLATION"
          ? deposit
          : Number(refunds[request.id] ?? request.depositRefundAmount ?? 0)
        : 0;
    if (status === "APPROVED" && (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > deposit)) {
      setError(`Mức hoàn cọc phải trong khoảng 0 - ${deposit}.`);
      return;
    }

    setProcessingId(request.id);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.contracts.reviewTerminationRequest(request.id, {
        status,
        reviewNote: note,
        ...(status === "APPROVED" ? { refundAmount } : {}),
        ...(effectiveDates[request.id] ? { effectiveDate: effectiveDates[request.id] } : {}),
      });
      setSuccess(
        status === "APPROVED"
          ? "Đã duyệt chấm dứt hợp đồng và trả phòng về trạng thái trống."
          : "Đã từ chối yêu cầu chấm dứt hợp đồng.",
      );
      setNotes((prev) => ({ ...prev, [request.id]: "" }));
      await load(statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xử lý được yêu cầu chấm dứt.");
      await load(statusFilter);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">
          Duyệt chấm dứt hợp đồng
        </h1>
        <p className="mt-0.5 text-[14px] text-[#74817b]">
          Kiểm tra bằng chứng, quyết định chấm dứt và mức hoàn cọc. Hợp đồng chỉ chấm dứt sau khi
          Admin duyệt.
        </p>
      </div>

      {error && (
        <p className="rounded-[8px] border border-[#efc6bb] bg-[#fbeae6] px-3 py-2 text-[13px] text-[#a4422c]">
          {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-1.5 rounded-[8px] border border-[#b2d3c2] bg-[#eaf2ed] px-3 py-2 text-[13px] text-[#15594f]">
          <CheckCircle2 className="size-4" /> {success}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setIsLoading(true);
              setStatusFilter(tab.value);
            }}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              statusFilter === tab.value
                ? "border-[#15594f] bg-[#15594f] text-white"
                : "border-[#e2e7e1] bg-white text-[#74817b] hover:border-[#15594f] hover:text-[#15594f]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[12px] border border-[#e2e7e1] bg-white" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <FileCheck className="mx-auto mb-3 size-12 text-[#9bb5a8]" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có yêu cầu nào</h3>
          <p className="mt-1 text-[13px] text-[#74817b]">
            Không có hồ sơ chấm dứt hợp đồng ở trạng thái đã chọn.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const contract = request.contract;
            const deposit = Number(contract?.depositPaid ?? 0);
            const isPending = request.status === "PENDING";
            const busy = processingId === request.id;
            const defaultRefund =
              request.reason === "LANDLORD_VIOLATION"
                ? deposit
                : Number(request.depositRefundAmount ?? 0);
            return (
              <div
                key={request.id}
                className="space-y-4 rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileWarning className="size-4 text-[#a4422c]" />
                      <strong className="text-[15px] text-[#203c37]">
                        {CONTRACT_TERMINATION_REASON_LABELS[request.reason]}
                      </strong>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TERMINATION_STATUS_CLASS[request.status]}`}
                      >
                        {CONTRACT_TERMINATION_STATUS_LABELS[request.status]}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#74817b]">
                      Phòng {contract?.room?.roomNumber ?? "—"} •{" "}
                      {contract?.room?.property?.name ?? "Chưa cập nhật"} •{" "}
                      {contract?.room?.property?.address ?? ""}
                    </p>
                    <p className="text-[12px] text-[#74817b]">
                      Người thuê:{" "}
                      <strong className="text-[#203c37]">
                        {contract?.tenant?.fullName ?? "—"}
                      </strong>{" "}
                      • Chủ trọ:{" "}
                      <strong className="text-[#203c37]">
                        {contract?.room?.property?.landlord?.fullName ?? "—"}
                      </strong>
                    </p>
                    <p className="text-[11px] text-[#74817b]">
                      Gửi bởi {request.requestedBy?.fullName ?? request.requestedById} (
                      {request.initiatorRole}) • {formatDate(request.createdAt)}
                      {request.requestedEffectiveDate
                        ? ` • Mong muốn chấm dứt từ ${formatDate(request.requestedEffectiveDate)}`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-[8px] bg-[#f7f6f2] px-3 py-2 text-right text-[12px] text-[#74817b]">
                    <p>Tiền cọc đã thu</p>
                    <p className="text-[15px] font-bold text-[#203c37]">
                      {formatCurrency(deposit, { showUnit: false })} đ
                    </p>
                  </div>
                </div>

                <p className="whitespace-pre-line rounded-[8px] bg-[#f7f6f2] p-3 text-[13px] text-[#203c37]">
                  {request.details}
                </p>

                {request.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {request.attachments.map((attachment, index) => {
                      const url = resolveMediaUrl(attachment.url);
                      if (!url) return null;
                      return (
                        <a
                          key={attachment.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-[6px] border border-[#e2e7e1] px-2.5 py-1.5 text-[11px] text-[#15594f] hover:border-[#15594f]"
                        >
                          <Paperclip className="size-3" /> Bằng chứng {index + 1}
                        </a>
                      );
                    })}
                  </div>
                )}

                {request.status === "APPROVED" && (
                  <div className="rounded-[8px] border border-[#b2d3c2] bg-[#eaf2ed] p-3 text-[12px] text-[#15594f]">
                    Đã chấm dứt. Hoàn cọc{" "}
                    <strong>
                      {formatCurrency(Number(request.depositRefundAmount ?? 0), {
                        showUnit: false,
                      })}{" "}
                      đ
                    </strong>{" "}
                    — {DEPOSIT_REFUND_STATUS_LABELS[request.refundStatus]}.
                  </div>
                )}

                {request.reviewNote && (
                  <p className="text-[12px] text-[#203c37]">
                    <strong>Kết luận:</strong> {request.reviewNote}
                    {request.reviewedBy?.fullName ? ` (${request.reviewedBy.fullName})` : ""}
                  </p>
                )}

                {isPending && (
                  <div className="space-y-3 border-t border-[#e2e7e1] pt-3">
                    {request.reason === "LANDLORD_VIOLATION" && (
                      <p className="flex items-start gap-1.5 rounded-[8px] border border-[#f0d9a8] bg-[#fff4e5] px-3 py-2 text-[12px] text-[#8a5700]">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Chủ trọ vi phạm: khi duyệt, hệ thống bắt buộc hoàn đủ 100% tiền cọc.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="text-[12px] font-semibold text-[#74817b] sm:col-span-2">
                        Kết luận của Admin (bắt buộc)
                        <textarea
                          rows={2}
                          value={notes[request.id] ?? ""}
                          onChange={(event) =>
                            setNotes((prev) => ({ ...prev, [request.id]: event.target.value }))
                          }
                          placeholder="Nêu căn cứ và quyết định xử lý..."
                          className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2 text-[13px] font-normal outline-none focus:border-[#15594f]"
                        />
                      </label>
                      <div className="space-y-2">
                        <label className="block text-[12px] font-semibold text-[#74817b]">
                          Mức hoàn cọc (đ)
                          <input
                            type="number"
                            min={0}
                            max={deposit}
                            readOnly={request.reason === "LANDLORD_VIOLATION"}
                            value={refunds[request.id] ?? String(defaultRefund)}
                            onChange={(event) =>
                              setRefunds((prev) => ({
                                ...prev,
                                [request.id]: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2 text-[13px] font-normal outline-none focus:border-[#15594f] read-only:bg-[#eaf2ed]"
                          />
                        </label>
                        <label className="block text-[12px] font-semibold text-[#74817b]">
                          Ngày chấm dứt
                          <input
                            type="date"
                            value={
                              effectiveDates[request.id] ??
                              request.requestedEffectiveDate?.slice(0, 10) ??
                              ""
                            }
                            onChange={(event) =>
                              setEffectiveDates((prev) => ({
                                ...prev,
                                [request.id]: event.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2 text-[13px] font-normal outline-none focus:border-[#15594f]"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        loading={busy}
                        onClick={() => void review(request, "REJECTED")}
                        leftIcon={<XCircle className="size-3.5" />}
                      >
                        Từ chối
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={busy}
                        onClick={() => void review(request, "APPROVED")}
                        leftIcon={<CheckCircle2 className="size-3.5" />}
                      >
                        Duyệt chấm dứt
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
