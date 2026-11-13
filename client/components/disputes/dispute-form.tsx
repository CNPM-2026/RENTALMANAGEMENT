"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Flag, ImagePlus } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { DISPUTE_CATEGORY_OPTIONS } from "@/lib/labels";

type DisputeFormProps = {
  /** Công việc liên quan (nếu báo cáo phát sinh từ một công việc cụ thể). */
  taskId?: string;
  /** Người bị báo cáo (bắt buộc khi có `taskId` — server đối chiếu bên còn lại). */
  targetUserId?: string;
  targetLabel?: string;
  onSubmitted?: () => void;
};

/**
 * Form GỬI BÁO CÁO / TRANH CHẤP (Batch 4).
 *
 * Bằng chứng gửi dưới dạng TỆP (multipart). Server kiểm tra magic bytes + MIME,
 * upload PRIVATE, và chỉ người báo cáo + admin xem được — client không bao giờ
 * gửi URL ảnh.
 */
export function DisputeForm({ taskId, targetUserId, targetLabel, onSubmitted }: DisputeFormProps) {
  const [category, setCategory] = React.useState<string>("WORK_QUALITY");
  const [reason, setReason] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (reason.trim().length < 10) {
      setError("Vui lòng mô tả sự việc ít nhất 10 ký tự.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("reason", reason.trim());
      if (taskId) {
        // Báo cáo một NGƯỜI trong ngữ cảnh công việc: targetType USER + taskId.
        formData.append("targetType", targetUserId ? "USER" : "TASK");
        formData.append("targetId", targetUserId ?? taskId);
        formData.append("taskId", taskId);
      }
      for (const file of files) formData.append("images", file);

      await apiClient.reports.create(formData);
      setReason("");
      setFiles([]);
      setDone("Đã gửi báo cáo. Admin sẽ xem xét và phản hồi.");
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không gửi được báo cáo.");
    } finally {
      setBusy(false);
    }
  };

  // Không có `taskId` thì form này không đủ ngữ cảnh để báo cáo an toàn.
  if (!taskId) return null;

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-[#f0d5cd] bg-[#fdf6f4] p-4 space-y-2">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#a4422c]">
        <Flag className="size-4" /> Báo cáo / tranh chấp{targetLabel ? ` — ${targetLabel}` : ""}
      </p>
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        className="w-full rounded-[7px] border border-[#dfe8e1] bg-white px-3 py-2 text-[13px] outline-none"
      >
        {DISPUTE_CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="Mô tả sự việc (ít nhất 10 ký tự)"
        className="w-full rounded-[7px] border border-[#dfe8e1] bg-white px-3 py-2 text-[13px] outline-none"
      />
      <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#74817b]">
        <ImagePlus className="size-4" />
        <span>Đính kèm bằng chứng (tối đa 5 ảnh, 5MB/ảnh)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
        />
      </label>
      {files.length > 0 && <p className="text-[11px] text-[#74817b]">Đã chọn {files.length} tệp.</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-[7px] bg-[#a4422c] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#8d3723] disabled:opacity-50 cursor-pointer"
      >
        Gửi báo cáo
      </button>
      {error && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {done && (
        <p className="flex items-start gap-1.5 text-[12px] text-[#15594f]">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {done}
        </p>
      )}
    </form>
  );
}
