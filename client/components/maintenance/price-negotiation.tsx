"use client";

import * as React from "react";
import { AlertTriangle, Check, HandCoins, RotateCcw, X } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { translateOfferStatus } from "@/lib/labels";
import { formatMoneyInput, parseDecimalInput } from "@/lib/numeric";
import { NumericInput } from "@/components/ui/numeric-input";
import type { MaintenanceNegotiation, MaintenanceTaskStatus } from "@/types/models";

type PriceNegotiationProps = {
  taskId: string;
  taskStatus: MaintenanceTaskStatus;
  /** Vai trò của người xem — chỉ để hiển thị chữ, quyền thật do server quyết định. */
  viewerRole: "LANDLORD" | "STAFF";
  onUpdated?: (result: MaintenanceNegotiation) => void;
};

const inputClass =
  "w-full rounded-[7px] border border-[#dfe8e1] bg-white px-3 py-2 text-[13px] text-[#203c37] outline-none transition focus:border-[#15594f] focus:ring-2 focus:ring-[#15594f]/10 disabled:bg-[#f7f8f7]";

/**
 * Bảng THƯƠNG LƯỢNG GIÁ dùng chung cho chủ trọ và thợ (Batch 3).
 *
 * Toàn bộ quyết định (ai được đề xuất, ai được chấp nhận, giá đã chốt) do server
 * xác định; component chỉ hiển thị `canNegotiate` / `pendingOffer.canRespond`.
 */
export function PriceNegotiation({ taskId, taskStatus, viewerRole, onUpdated }: PriceNegotiationProps) {
  const [state, setState] = React.useState<MaintenanceNegotiation | null>(null);
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    apiClient.maintenanceTasks
      .getOffers(taskId)
      .then((result) => {
        setState(result);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Không tải được lịch sử thương lượng.");
      });
  }, [taskId]);

  React.useEffect(() => {
    load();
  }, [load, taskStatus]);

  const handleError = (err: unknown, fallback: string) => {
    setNotice(null);
    setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallback);
  };

  const apply = (result: MaintenanceNegotiation, message: string) => {
    setState(result);
    setAmount("");
    setNote("");
    setError(null);
    setNotice(message);
    onUpdated?.(result);
  };

  const propose = async () => {
    const parsed = parseDecimalInput(amount);
    if (parsed === null || parsed <= 0) {
      setError("Vui lòng nhập giá hợp lệ (lớn hơn 0, tối đa 2 chữ số thập phân).");
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.maintenanceTasks.proposeOffer(taskId, {
        amount: parsed,
        note: note.trim() || null,
      });
      apply(result, "Đã gửi đề xuất giá. Chờ bên còn lại phản hồi.");
    } catch (err) {
      handleError(err, "Không gửi được đề xuất giá.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (offerId: string, decision: "accept" | "reject") => {
    setBusy(true);
    try {
      const payload = { expectedVersion: state?.negotiationVersion };
      const result =
        decision === "accept"
          ? await apiClient.maintenanceTasks.acceptOffer(taskId, offerId, payload)
          : await apiClient.maintenanceTasks.rejectOffer(taskId, offerId, payload);
      apply(result, decision === "accept" ? "Đã chốt giá với bên còn lại." : "Đã từ chối đề xuất giá.");
    } catch (err) {
      handleError(err, "Không xử lý được đề xuất giá.");
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (offerId: string) => {
    setBusy(true);
    try {
      const result = await apiClient.maintenanceTasks.withdrawOffer(taskId, offerId);
      apply(result, "Đã rút đề xuất giá.");
    } catch (err) {
      handleError(err, "Không rút được đề xuất giá.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return (
      <div className="rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] px-4 py-3 text-[12px] text-[#74817b]">
        {error ?? "Đang tải thương lượng giá..."}
      </div>
    );
  }

  const { pendingOffer, offers, canNegotiate, agreedAmount, actorRole } = state;
  const history = offers.slice(0, 5);

  return (
    <div className="rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HandCoins className="size-4 text-[#15594f]" />
          <span className="text-[13px] font-semibold text-[#203c37]">Thương lượng giá</span>
        </div>
        <span className="text-[12px] text-[#74817b]">
          {agreedAmount ? `Đã chốt: ${formatMoneyInput(agreedAmount)}` : "Chưa chốt giá"}
        </span>
      </div>

      {pendingOffer && (
        <div className="rounded-[8px] border border-[#e7eefb] bg-[#f4f7fe] px-3 py-2 space-y-1.5">
          <p className="text-[12px] text-[#2a4d8f]">
            {pendingOffer.proposedByRole === "LANDLORD" ? "Chủ trọ" : "Thợ"} đề xuất{" "}
            <span className="font-semibold">{formatMoneyInput(pendingOffer.amount)}</span>
            {pendingOffer.note ? ` — ${pendingOffer.note}` : ""}
          </p>
          {pendingOffer.canRespond ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(pendingOffer.id, "accept")}
                className="inline-flex items-center gap-1 rounded-[6px] bg-[#15594f] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
              >
                <Check className="size-3.5" /> Chấp nhận
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(pendingOffer.id, "reject")}
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#f0d5cd] px-2.5 py-1 text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50 cursor-pointer"
              >
                <X className="size-3.5" /> Từ chối
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => withdraw(pendingOffer.id)}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#e2e7e1] px-2.5 py-1 text-[12px] font-semibold text-[#74817b] hover:bg-[#f1f5f2] disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="size-3.5" /> Rút đề xuất
            </button>
          )}
        </div>
      )}

      {canNegotiate ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <NumericInput
              value={amount}
              onChange={setAmount}
              maxDecimals={2}
              placeholder="Giá bạn đề xuất (VNĐ)"
              className={inputClass}
              disabled={busy}
              ariaLabel="Giá đề xuất"
            />
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú (không bắt buộc)"
              className={inputClass}
              disabled={busy}
            />
            <button
              type="button"
              onClick={propose}
              disabled={busy}
              className="shrink-0 rounded-[7px] bg-[#15594f] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
            >
              Gửi đề xuất
            </button>
          </div>
          {!agreedAmount && actorRole === "STAFF" && (
            <p className="text-[11px] text-[#9a6a12]">
              Cần chốt giá với chủ trọ trước khi bấm bắt đầu công việc.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-[#74817b]">
          Không thể thương lượng ở trạng thái hiện tại (chỉ khi việc đã giao và chưa gửi nghiệm thu).
        </p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {notice && <p className="text-[12px] text-[#15594f]">{notice}</p>}

      {history.length > 0 && (
        <div className="space-y-1 border-t border-[#e8eee9] pt-2">
          <p className="text-[11px] font-semibold text-[#74817b]">Lịch sử đề xuất</p>
          {history.map((offer) => (
            <div key={offer.id} className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[#74817b]">
              <span>
                #{offer.version} · {offer.proposedByRole === "LANDLORD" ? "Chủ trọ" : "Thợ"} ·{" "}
                {formatMoneyInput(offer.amount)}
              </span>
              <span>
                {translateOfferStatus(offer.status)} · {new Date(offer.createdAt).toLocaleString("vi-VN")}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-[#9aa8a0]">
        Bạn đang xem với vai trò {viewerRole === "LANDLORD" ? "chủ trọ" : "thợ"}.
      </p>
    </div>
  );
}
