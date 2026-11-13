"use client";

import * as React from "react";
import { AlertTriangle, Star } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import type { TaskReviewState } from "@/types/models";

type TaskReviewProps = {
  taskId: string;
  /** Chỉ hiện khối đánh giá khi công việc đã hoàn thành. */
  enabled: boolean;
  /** Nhãn cho người được đánh giá (chủ trọ hoặc thợ) — chỉ để hiển thị. */
  counterpartLabel?: string;
};

/**
 * ĐÁNH GIÁ CÔNG VIỆC (Batch 4).
 *
 * Chỉ người tham gia công việc ĐÃ HOÀN THÀNH mới thấy form; server kiểm tra lại
 * toàn bộ (quan hệ, trạng thái, trùng lặp) nên không thể đánh giá hộ/đánh giá
 * nhiều lần hay đánh giá công việc chưa xong.
 */
export function TaskReview({ taskId, enabled, counterpartLabel }: TaskReviewProps) {
  const [state, setState] = React.useState<TaskReviewState | null>(null);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    if (!enabled) return;
    apiClient.reviews
      .getTaskState(taskId)
      .then(setState)
      .catch(() => setState(null));
  }, [enabled, taskId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (!enabled || !state) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiClient.reviews.create({
        targetType: "TASK",
        targetId: taskId,
        rating,
        comment: comment.trim() || undefined,
      });
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được đánh giá.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] p-4 space-y-2">
      <p className="text-[13px] font-semibold text-[#203c37]">
        Đánh giá công việc{counterpartLabel ? ` — ${counterpartLabel}` : ""}
      </p>

      {state.canReview ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} sao`}
                className="cursor-pointer"
              >
                <Star
                  className={`size-5 ${value <= rating ? "fill-[#e0a800] text-[#e0a800]" : "text-[#c9d3cd]"}`}
                />
              </button>
            ))}
            <span className="ml-1 text-[12px] text-[#74817b]">{rating}/5</span>
          </div>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Chia sẻ trải nghiệm của bạn (không bắt buộc)"
            className="w-full rounded-[7px] border border-[#dfe8e1] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#15594f]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="rounded-[7px] bg-[#15594f] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
          >
            Gửi đánh giá
          </button>
        </div>
      ) : (
        <div className="space-y-1 text-[12px] text-[#74817b]">
          {state.myReview ? (
            <p>
              Bạn đã đánh giá {state.myReview.rating}/5
              {state.myReview.comment ? ` — ${state.myReview.comment}` : ""}
            </p>
          ) : (
            <p>Chưa thể đánh giá (công việc chưa hoàn thành).</p>
          )}
          {state.counterpartReview && (
            <p>
              Đánh giá từ bên kia: {state.counterpartReview.rating}/5
              {state.counterpartReview.comment ? ` — ${state.counterpartReview.comment}` : ""}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
