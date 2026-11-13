"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileWarning, Paperclip, RefreshCw, Upload, XCircle } from "lucide-react";
import { apiClient, resolveMediaUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency } from "@/lib/utils";
import {
  CONTRACT_RENEWAL_STATUS_LABELS,
  CONTRACT_TERMINATION_REASON_LABELS,
  CONTRACT_TERMINATION_STATUS_LABELS,
  DEPOSIT_REFUND_STATUS_LABELS,
  RENEWAL_STATUS_CLASS,
  TERMINATION_STATUS_CLASS,
} from "@/lib/contract-lifecycle";
import type {
  Contract,
  ContractRenewalRequest,
  ContractTerminationReason,
  ContractTerminationRequest,
} from "@/types/models";

interface Props {
  contract: Contract;
  role: "LANDLORD" | "TENANT";
  currentUserId: string;
  onChanged?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("vi-VN");
}

const TENANT_REASONS: ContractTerminationReason[] = ["LANDLORD_VIOLATION", "MUTUAL_AGREEMENT", "OTHER"];
const LANDLORD_REASONS: ContractTerminationReason[] = [
  "TENANT_MOVED_OUT",
  "TENANT_VIOLATION",
  "MUTUAL_AGREEMENT",
  "OTHER",
];

/**
 * Thẻ nghiệp vụ dùng chung cho hai bên:
 * - gửi yêu cầu chấm dứt kèm bằng chứng (bắt buộc ảnh);
 * - xem trạng thái Admin duyệt + nghĩa vụ hoàn cọc;
 * - gửi / phản hồi đề xuất ký tiếp.
 */
export function ContractLifecyclePanel({ contract, role, currentUserId, onChanged }: Props) {
  const [terminations, setTerminations] = React.useState<ContractTerminationRequest[]>([]);
  const [renewals, setRenewals] = React.useState<ContractRenewalRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isTerminationOpen, setIsTerminationOpen] = React.useState(false);
  const [isRenewalOpen, setIsRenewalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [terminationForm, setTerminationForm] = React.useState<{
    reason: ContractTerminationReason;
    details: string;
    effectiveDate: string;
    files: File[];
  }>({
    reason: role === "LANDLORD" ? "TENANT_MOVED_OUT" : "LANDLORD_VIOLATION",
    details: "",
    effectiveDate: "",
    files: [],
  });
  const [renewalForm, setRenewalForm] = React.useState({
    proposedEndDate: "",
    proposedMonthlyRent: String(contract.monthlyRent),
    note: "",
  });
  const [responseNote, setResponseNote] = React.useState("");

  const refresh = React.useCallback(async () => {
    try {
      const [terminationItems, renewalItems] = await Promise.all([
        apiClient.contracts.getTerminationRequests(),
        apiClient.contracts.getRenewalRequests(),
      ]);
      setTerminations(terminationItems.filter((item) => item.contractId === contract.id));
      setRenewals(renewalItems.filter((item) => item.contractId === contract.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được trạng thái hợp đồng.");
    } finally {
      setIsLoading(false);
    }
  }, [contract.id]);

  // Nạp dữ liệu lần đầu bằng promise callback để không setState đồng bộ trong effect.
  React.useEffect(() => {
    let isCancelled = false;
    Promise.all([
      apiClient.contracts.getTerminationRequests(),
      apiClient.contracts.getRenewalRequests(),
    ])
      .then(([terminationItems, renewalItems]) => {
        if (isCancelled) return;
        setTerminations(terminationItems.filter((item) => item.contractId === contract.id));
        setRenewals(renewalItems.filter((item) => item.contractId === contract.id));
        setError(null);
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : "Không tải được trạng thái hợp đồng.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [contract.id]);

  const pendingTermination = terminations.find((item) => item.status === "PENDING") ?? null;
  const latestTermination = terminations[0] ?? null;
  const pendingRenewal = renewals.find((item) => item.status === "PENDING") ?? null;
  const latestRenewal = renewals[0] ?? null;
  const isCounterpartRenewal = Boolean(
    pendingRenewal && pendingRenewal.requestedById !== currentUserId,
  );
  const isTerminated =
    contract.status === "TERMINATED" || latestTermination?.status === "APPROVED";
  const canRequestTermination =
    !isTerminated &&
    (contract.status === "ACTIVE" || contract.status === "EXPIRED") &&
    !pendingTermination;
  const canRequestRenewal =
    !isTerminated &&
    (contract.status === "ACTIVE" || contract.status === "EXPIRED") &&
    Boolean(contract.endDate) &&
    !pendingRenewal;

  const notifyChanged = () => {
    onChanged?.();
    void refresh();
  };

  const openTermination = () => {
    setError(null);
    setSuccess(null);
    setTerminationForm({
      reason: role === "LANDLORD" ? "TENANT_MOVED_OUT" : "LANDLORD_VIOLATION",
      details: "",
      effectiveDate: "",
      files: [],
    });
    setIsTerminationOpen(true);
  };

  const submitTermination = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (terminationForm.details.trim().length < 20) {
      setError("Vui lòng mô tả sự việc ít nhất 20 ký tự.");
      return;
    }
    if (terminationForm.files.length === 0) {
      setError("Bắt buộc tải lên ít nhất một ảnh bằng chứng.");
      return;
    }
    const formData = new FormData();
    formData.append("reason", terminationForm.reason);
    formData.append("details", terminationForm.details.trim());
    if (terminationForm.effectiveDate) {
      formData.append("requestedEffectiveDate", terminationForm.effectiveDate);
    }
    terminationForm.files.forEach((file) => formData.append("images", file));

    setIsSubmitting(true);
    try {
      await apiClient.contracts.createTerminationRequest(contract.id, formData);
      setIsTerminationOpen(false);
      setSuccess("Đã gửi yêu cầu chấm dứt kèm bằng chứng. Admin sẽ xem xét và phản hồi.");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được yêu cầu chấm dứt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRenewal = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.contracts.createRenewalRequest(contract.id, {
        proposedEndDate: renewalForm.proposedEndDate || null,
        ...(renewalForm.proposedMonthlyRent
          ? { proposedMonthlyRent: Number(renewalForm.proposedMonthlyRent) }
          : {}),
        note: renewalForm.note.trim() || null,
      });
      setIsRenewalOpen(false);
      setSuccess("Đã gửi đề xuất ký tiếp. Bên còn lại sẽ nhận thông báo để phản hồi.");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được đề xuất ký tiếp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const respondRenewal = async (status: "APPROVED" | "DECLINED") => {
    if (!pendingRenewal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.contracts.respondRenewalRequest(pendingRenewal.id, {
        status,
        note: responseNote.trim() || null,
      });
      setResponseNote("");
      setSuccess(status === "APPROVED" ? "Đã đồng ý ký tiếp hợp đồng." : "Đã từ chối ký tiếp.");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không phản hồi được đề xuất ký tiếp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmRefund = async (request: ContractTerminationRequest) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.contracts.confirmDepositRefund(request.id);
      setSuccess("Đã xác nhận hoàn tiền cọc cho người thuê.");
      notifyChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xác nhận được việc hoàn cọc.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasons = role === "LANDLORD" ? LANDLORD_REASONS : TENANT_REASONS;
  const refundAmount = Number(latestTermination?.depositRefundAmount ?? 0);

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#203c37]">Chấm dứt & ký tiếp hợp đồng</h3>
            <p className="mt-1 text-[12px] text-[#74817b]">
              Yêu cầu chấm dứt cần bằng chứng ảnh và phải được Admin duyệt. Hợp đồng không có
              ngày kết thúc là vô thời hạn nên không cần ký tiếp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#e2e7e1] px-2.5 py-1.5 text-[12px] font-semibold text-[#15594f] hover:bg-[#f7f6f2]"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} /> Làm mới
          </button>
        </div>

        {error && (
          <p className="rounded-[8px] border border-[#efc6bb] bg-[#fbeae6] px-3 py-2 text-[12px] text-[#a4422c]">
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 rounded-[8px] border border-[#b2d3c2] bg-[#eaf2ed] px-3 py-2 text-[12px] text-[#15594f]">
            <CheckCircle2 className="size-3.5" /> {success}
          </p>
        )}
        {isLoading && <p className="text-[12px] text-[#74817b]">Đang tải trạng thái hợp đồng...</p>}

        {latestTermination && (
          <div className="rounded-[10px] border border-[#e2e7e1] bg-[#f7f6f2] p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <FileWarning className="size-4 text-[#a4422c]" />
              <strong className="text-[13px] text-[#203c37]">Yêu cầu chấm dứt</strong>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TERMINATION_STATUS_CLASS[latestTermination.status]}`}
              >
                {CONTRACT_TERMINATION_STATUS_LABELS[latestTermination.status]}
              </span>
            </div>
            <p className="text-[12px] text-[#203c37]">
              Lý do: {CONTRACT_TERMINATION_REASON_LABELS[latestTermination.reason]}
            </p>
            <p className="whitespace-pre-line text-[12px] text-[#74817b]">{latestTermination.details}</p>
            <p className="text-[11px] text-[#74817b]">
              Người gửi: {latestTermination.requestedBy?.fullName ?? latestTermination.requestedById} •{" "}
              {formatDate(latestTermination.createdAt)}
            </p>
            {latestTermination.reviewNote && (
              <p className="text-[12px] text-[#15594f]">
                Kết luận của Admin: {latestTermination.reviewNote}
              </p>
            )}
            {latestTermination.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {latestTermination.attachments.map((attachment, index) => {
                  const url = resolveMediaUrl(attachment.url);
                  if (!url) return null;
                  return (
                    <a
                      key={attachment.id}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-[6px] border border-[#e2e7e1] bg-white px-2 py-1 text-[11px] text-[#15594f] hover:border-[#15594f]"
                    >
                      <Paperclip className="size-3" /> Bằng chứng {index + 1}
                    </a>
                  );
                })}
              </div>
            )}
            {latestTermination.status === "APPROVED" && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#e2e7e1] pt-2 text-[12px] text-[#203c37]">
                <span>
                  Hoàn cọc: <strong>{formatCurrency(refundAmount, { showUnit: false })} đ</strong> •{" "}
                  {DEPOSIT_REFUND_STATUS_LABELS[latestTermination.refundStatus]}
                </span>
                {role === "LANDLORD" && latestTermination.refundStatus === "PENDING" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={isSubmitting}
                    onClick={() => void confirmRefund(latestTermination)}
                  >
                    Xác nhận đã hoàn cọc
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {(pendingRenewal || latestRenewal) && (
          <div className="rounded-[10px] border border-[#e2e7e1] bg-[#f7f6f2] p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <RefreshCw className="size-4 text-[#15594f]" />
              <strong className="text-[13px] text-[#203c37]">Ký tiếp hợp đồng</strong>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                  RENEWAL_STATUS_CLASS[(pendingRenewal ?? latestRenewal)!.status]
                }`}
              >
                {CONTRACT_RENEWAL_STATUS_LABELS[(pendingRenewal ?? latestRenewal)!.status]}
              </span>
            </div>
            <p className="text-[12px] text-[#203c37]">
              Thời hạn mới:{" "}
              <strong>
                {(pendingRenewal ?? latestRenewal)!.proposedEndDate
                  ? formatDate((pendingRenewal ?? latestRenewal)!.proposedEndDate)
                  : "Vô thời hạn"}
              </strong>
              {((pendingRenewal ?? latestRenewal)!.proposedMonthlyRent ?? null) != null && (
                <>
                  {" "}• Tiền thuê:{" "}
                  <strong>
                    {formatCurrency((pendingRenewal ?? latestRenewal)!.proposedMonthlyRent!, {
                      showUnit: false,
                    })}{" "}
                    đ/tháng
                  </strong>
                </>
              )}
            </p>
            {(pendingRenewal ?? latestRenewal)!.note && (
              <p className="whitespace-pre-line text-[12px] text-[#74817b]">
                {(pendingRenewal ?? latestRenewal)!.note}
              </p>
            )}
            {pendingRenewal && isCounterpartRenewal ? (
              <div className="space-y-2 border-t border-[#e2e7e1] pt-2">
                <textarea
                  value={responseNote}
                  onChange={(event) => setResponseNote(event.target.value)}
                  rows={2}
                  placeholder="Ghi chú phản hồi (không bắt buộc)"
                  className="w-full rounded-[8px] border border-[#e2e7e1] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#15594f]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    loading={isSubmitting}
                    onClick={() => void respondRenewal("APPROVED")}
                    leftIcon={<CheckCircle2 className="size-3.5" />}
                  >
                    Đồng ý ký tiếp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={isSubmitting}
                    onClick={() => void respondRenewal("DECLINED")}
                    leftIcon={<XCircle className="size-3.5" />}
                  >
                    Từ chối
                  </Button>
                </div>
              </div>
            ) : pendingRenewal ? (
              <p className="text-[12px] text-[#8a5700]">
                Đang chờ {role === "LANDLORD" ? "người thuê" : "chủ trọ"} phản hồi đề xuất.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-[#e2e7e1] pt-3">
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!canRequestTermination}
            onClick={openTermination}
            leftIcon={<AlertTriangle className="size-3.5" />}
          >
            Yêu cầu chấm dứt hợp đồng
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canRequestRenewal}
            onClick={() => {
              setError(null);
              setSuccess(null);
              setRenewalForm({
                proposedEndDate: "",
                proposedMonthlyRent: String(contract.monthlyRent),
                note: "",
              });
              setIsRenewalOpen(true);
            }}
            leftIcon={<RefreshCw className="size-3.5" />}
          >
            Đề xuất ký tiếp
          </Button>
          {!contract.endDate && (
            <span className="self-center text-[11px] text-[#74817b]">
              Hợp đồng vô thời hạn — không cần ký tiếp.
            </span>
          )}
        </div>
      </div>

      <Modal
        isOpen={isTerminationOpen}
        onClose={() => setIsTerminationOpen(false)}
        title="Yêu cầu chấm dứt hợp đồng"
        description="Bắt buộc mô tả sự việc và đính kèm ảnh bằng chứng. Yêu cầu chỉ có hiệu lực sau khi Admin duyệt."
        size="lg"
      >
        <form onSubmit={submitTermination} className="space-y-4">
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Lý do chấm dứt
            <select
              value={terminationForm.reason}
              onChange={(event) =>
                setTerminationForm((form) => ({
                  ...form,
                  reason: event.target.value as ContractTerminationReason,
                }))
              }
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            >
              {reasons.map((reason) => (
                <option key={reason} value={reason}>
                  {CONTRACT_TERMINATION_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Mô tả chi tiết sự việc
            <textarea
              required
              minLength={20}
              rows={4}
              value={terminationForm.details}
              onChange={(event) =>
                setTerminationForm((form) => ({ ...form, details: event.target.value }))
              }
              placeholder="Ví dụ: chủ trọ không sửa điện, cắt nước trái thỏa thuận; hoặc người thuê vi phạm nội quy gây ồn nhiều lần..."
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Ngày mong muốn chấm dứt (không bắt buộc)
            <input
              type="date"
              value={terminationForm.effectiveDate}
              onChange={(event) =>
                setTerminationForm((form) => ({ ...form, effectiveDate: event.target.value }))
              }
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Ảnh bằng chứng (bắt buộc, tối đa 5 ảnh)
            <input
              required
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) =>
                setTerminationForm((form) => ({
                  ...form,
                  files: Array.from(event.target.files ?? []).slice(0, 5),
                }))
              }
              className="mt-1 block w-full rounded-[8px] border border-dashed border-[#cbd5cc] bg-[#f7f6f2] px-3 py-3 text-[12px] font-normal text-[#203c37] file:mr-3 file:rounded-[6px] file:border-0 file:bg-[#15594f] file:px-3 file:py-1.5 file:text-[12px] file:text-white"
            />
            <span className="mt-1 flex items-center gap-1 text-[11px] font-normal text-[#74817b]">
              <Upload className="size-3" /> Hỗ trợ JPG, PNG, WEBP; mỗi ảnh tối đa 5MB.
            </span>
          </label>
          {error && <p className="text-[12px] text-[#a4422c]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#e2e7e1] pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTerminationOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="danger" size="sm" loading={isSubmitting}>
              Gửi yêu cầu chấm dứt
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isRenewalOpen}
        onClose={() => setIsRenewalOpen(false)}
        title="Đề xuất ký tiếp hợp đồng"
        description="Bên còn lại sẽ nhận thông báo và quyết định đồng ý hoặc từ chối."
        size="md"
      >
        <form onSubmit={submitRenewal} className="space-y-4">
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Ngày kết thúc mới (để trống = vô thời hạn)
            <input
              type="date"
              value={renewalForm.proposedEndDate}
              min={contract.endDate?.slice(0, 10) || undefined}
              onChange={(event) =>
                setRenewalForm((form) => ({ ...form, proposedEndDate: event.target.value }))
              }
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Tiền thuê hàng tháng
            <input
              type="number"
              min={0}
              value={renewalForm.proposedMonthlyRent}
              onChange={(event) =>
                setRenewalForm((form) => ({ ...form, proposedMonthlyRent: event.target.value }))
              }
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#74817b]">
            Ghi chú
            <textarea
              rows={3}
              value={renewalForm.note}
              onChange={(event) => setRenewalForm((form) => ({ ...form, note: event.target.value }))}
              placeholder="Ví dụ: giữ nguyên giá, gia hạn thêm 12 tháng..."
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-2.5 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </label>
          {error && <p className="text-[12px] text-[#a4422c]">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[#e2e7e1] pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsRenewalOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
              Gửi đề xuất ký tiếp
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
