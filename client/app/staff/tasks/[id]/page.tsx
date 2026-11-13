"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  PlayCircle,
  Send,
  Wallet,
} from "lucide-react";
import { apiClient, ApiError, resolveMediaUrl } from "@/lib/api";
import { PriceNegotiation } from "@/components/maintenance/price-negotiation";
import { TaskReview } from "@/components/maintenance/task-review";
import { DisputeForm } from "@/components/disputes/dispute-form";
import {
  translateApplicationStatus,
  translateServiceCategory,
  translateTaskStatus,
  translateUrgency,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { MaintenanceTask, StaffProfile } from "@/types/models";

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : null;
}

/**
 * Trang CHI TIẾT công việc (phía thợ).
 *
 * Thợ ứng tuyển → (chủ trọ giao việc) → thương lượng giá → bắt đầu → gửi nghiệm
 * thu kèm ảnh. Mọi nút đều dựa trên cờ do server tính (`canStartWork`,
 * `canSubmitCompletion`) và server kiểm tra lại lần cuối.
 */
function StaffTaskDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = params?.id;

  const [task, setTask] = React.useState<MaintenanceTask | null>(null);
  const [profile, setProfile] = React.useState<StaffProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [applyMessage, setApplyMessage] = React.useState("");
  const [applyPrice, setApplyPrice] = React.useState("");
  const [completionNote, setCompletionNote] = React.useState("");
  const [completionFiles, setCompletionFiles] = React.useState<File[]>([]);

  const load = React.useCallback(() => {
    if (!taskId) return;
    // Trạng thái tải ban đầu là `true`; các lần tải lại chỉ setState trong
    // callback promise để không setState đồng bộ trong effect.
    apiClient.maintenanceTasks
      .getById(taskId)
      .then(setTask)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không tải được công việc."),
      )
      .finally(() => setLoading(false));
  }, [taskId]);

  React.useEffect(() => {
    load();
    apiClient.staffMarketplace.getMe().then(setProfile).catch(() => setProfile(null));
  }, [load]);

  const run = async (
    action: () => Promise<unknown>,
    successText: string,
    busyKey: string,
  ): Promise<boolean> => {
    setBusy(busyKey);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successText);
      load();
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors?.length ? err.errors.map((item) => item.message).join(" · ") : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Không thực hiện được thao tác.");
      }
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submitCompletion = async () => {
    if (!task) return;
    // Ảnh nghiệm thu là BẮT BUỘC (server cũng chặn): ghi chú không thay thế
    // được bằng chứng hiện trạng sau khi sửa.
    if (completionFiles.length === 0) {
      setMessage(null);
      setError("Vui lòng tải lên ít nhất một ảnh nghiệm thu trước khi gửi.");
      return;
    }
    const formData = new FormData();
    formData.append("note", completionNote);
    completionFiles.forEach((file) => formData.append("images", file));
    const succeeded = await run(
      () => apiClient.maintenanceTasks.submitCompletion(task.id, formData),
      "Đã gửi nghiệm thu, chờ chủ trọ xác nhận.",
      "completion",
    );
    // Chỉ xoá lựa chọn khi gửi THÀNH CÔNG, nếu không thợ phải chọn lại ảnh.
    if (!succeeded) return;
    setCompletionNote("");
    setCompletionFiles([]);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-[#e2e7e1] bg-white p-8 text-sm text-[#74817b]">
        <Loader2 className="size-4 animate-spin" /> Đang tải công việc...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.push("/staff/tasks")} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f]">
          <ArrowLeft className="size-4" /> Về danh sách việc làm
        </button>
        <div className="rounded-[12px] border border-[#f6cbc1] bg-[#fbeae6] p-6 text-sm text-[#a4422c]">
          {error ?? "Không tìm thấy công việc."}
        </div>
      </div>
    );
  }

  const budget = [formatMoney(task.budgetMin), formatMoney(task.budgetMax)].filter(Boolean).join(" – ");
  const myApplication = task.myApplication ?? null;
  const kycApproved = profile?.kycStatus === "APPROVED";
  const canApply = task.status === "OPEN" && !myApplication && kycApproved && profile?.isAvailable !== false;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/staff/tasks")}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
      >
        <ArrowLeft className="size-4" /> Về danh sách việc làm
      </button>

      <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#74817b]">
              {translateServiceCategory(task.category)} · #{task.id.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-[24px] font-semibold text-[#203c37]">{task.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 font-semibold text-[#15594f]">{translateTaskStatus(task.status)}</span>
              <span className="rounded-full bg-[#fbf1dc] px-2.5 py-1 font-semibold text-[#9a6a12]">{translateUrgency(task.urgency)}</span>
              {myApplication && (
                <span className="rounded-full bg-[#e7eefb] px-2.5 py-1 font-semibold text-[#2a4d8f]">
                  Đơn của bạn: {translateApplicationStatus(myApplication.status)}
                </span>
              )}
            </div>
          </div>
          <Link href={`/users/${task.landlordId}`} className="text-[13px] font-semibold text-[#15594f] hover:underline">
            Xem hồ sơ chủ trọ
          </Link>
        </div>

        <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-[#3f4f49]">{task.description}</p>

        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-[#e2e7e1] pt-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]"><MapPin className="size-3.5" /> Nơi làm việc</dt>
            <dd className="mt-1 font-medium text-[#203c37]">{task.address}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]"><Wallet className="size-3.5" /> Ngân sách</dt>
            <dd className="mt-1 font-medium text-[#203c37]">{budget || "Thương lượng"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]"><CalendarClock className="size-3.5" /> Thời gian mong muốn</dt>
            <dd className="mt-1 font-medium text-[#203c37]">
              {task.preferredStartAt ? formatDate(task.preferredStartAt, "datetime") : "Linh hoạt"}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]"><Wallet className="size-3.5" /> Giá đã chốt</dt>
            <dd className="mt-1 font-medium text-[#203c37]">{formatMoney(task.agreedAmount) ?? "Chưa chốt"}</dd>
          </div>
        </dl>

        {(task.images?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {task.images?.map((image) => {
              const url = resolveMediaUrl(image.imageUrl);
              return url ? (
                <a key={image.id} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Ảnh hiện trạng" className="h-24 w-32 rounded-[8px] object-cover" />
                </a>
              ) : null;
            })}
          </div>
        )}

        {task.assignedStaff && (
          <div className="mt-4 rounded-[8px] border border-[#e2e7e1] bg-[#f8faf7] px-4 py-3 text-[13px]">
            <span className="text-[#74817b]">Thợ được giao: </span>
            <Link
              href={`/users/${task.assignedStaff.id}`}
              className="font-semibold text-[#15594f] hover:underline"
            >
              {task.assignedStaff.fullName}
            </Link>
            {task.assignedStaff.phone && (
              <span className="text-[#74817b]"> · {task.assignedStaff.phone}</span>
            )}
          </div>
        )}

        {(task.completionImages?.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-[#74817b]">Ảnh nghiệm thu đã gửi</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {task.completionImages?.map((image) => {
                const url = resolveMediaUrl(image.imageUrl);
                return url ? (
                  <a key={image.id} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Ảnh nghiệm thu" className="h-24 w-32 rounded-[8px] object-cover" />
                  </a>
                ) : null;
              })}
            </div>
          </div>
        )}
      </section>


      {error && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#f6cbc1] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </div>
      )}
      {message && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#cce1d5] bg-[#eaf2ed] px-4 py-3 text-[13px] text-[#15594f]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {message}
        </div>
      )}

      {canApply && (
        <section className="space-y-3 rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Ứng tuyển công việc</h2>
          <p className="text-[13px] text-[#74817b]">
            Bạn cần hồ sơ thợ đã được duyệt KYC và đang bật nhận việc. Giá đề nghị để trống nghĩa là theo ngân sách / thương lượng sau.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Lời nhắn
              <textarea
                value={applyMessage}
                onChange={(event) => setApplyMessage(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]"
                placeholder="Kinh nghiệm, thời gian có thể tới..."
              />
            </label>
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Giá đề nghị (VNĐ)
              <input
                type="number"
                min={0}
                value={applyPrice}
                onChange={(event) => setApplyPrice(event.target.value)}
                className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]"
                placeholder="Không bắt buộc"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() =>
              void run(
                () =>
                  apiClient.maintenanceTasks.apply(task.id, {
                    message: applyMessage || null,
                    proposedAmount: applyPrice === "" ? null : Number(applyPrice),
                  }),
                "Đã gửi đơn ứng tuyển.",
                "apply",
              )
            }
            disabled={busy === "apply"}
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50"
          >
            <Send className="size-4" /> Gửi đơn ứng tuyển
          </button>
        </section>
      )}

      {!kycApproved && task.status === "OPEN" && !myApplication && (
        <div className="rounded-[8px] border border-[#f4deb4] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#9a6a12]">
          Hồ sơ KYC của bạn chưa được duyệt nên chưa thể ứng tuyển.{" "}
          <Link href="/staff/kyc" className="font-semibold underline">Xác minh CCCD ngay</Link>
        </div>
      )}


      {task.canStartWork && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#cce1d5] bg-[#eaf2ed] p-5">
          <p className="text-[13px] text-[#15594f]">
            Công việc đã được giao cho bạn. Hãy thống nhất giá trước khi bắt đầu.
          </p>
          <button
            type="button"
            onClick={() =>
              void run(() => apiClient.maintenanceTasks.startWork(task.id), "Đã bắt đầu công việc.", "start")
            }
            disabled={busy === "start"}
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50"
          >
            <PlayCircle className="size-4" /> Bắt đầu làm việc
          </button>
        </section>
      )}

      {task.canSubmitCompletion && (
        <section className="space-y-3 rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Gửi nghiệm thu</h2>
          <p className="text-[13px] text-[#74817b]">
            Ghi chú kết quả (tuỳ chọn) và tải lên <strong>ít nhất 1 ảnh nghiệm thu</strong> (tối đa 5 ảnh). Chủ trọ sẽ duyệt hoặc yêu cầu làm lại.
          </p>
          {task.completionReviewNote && task.completionSubmittedAt && (
            <p className="rounded-[8px] border border-[#f6cbc1] bg-[#fbeae6] p-3 text-[13px] text-[#a4422c]">
              Lần nộp trước bị yêu cầu làm lại: {task.completionReviewNote}
            </p>
          )}
          <textarea
            value={completionNote}
            onChange={(event) => setCompletionNote(event.target.value)}
            rows={3}
            className="w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]"
            placeholder="Mô tả những gì đã sửa, phụ tùng đã thay (tuỳ chọn)..."
          />
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-[#d9e3dc] px-3 py-2 text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]">
            <ImagePlus className="size-4" /> Chọn ảnh nghiệm thu
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 5);
                setCompletionFiles(files);
                event.target.value = "";
              }}
            />
          </label>
          {completionFiles.length > 0 ? (
            <p className="text-[12px] text-[#74817b]">
              Đã chọn {completionFiles.length} ảnh: {completionFiles.map((file) => file.name).join(", ")}
            </p>
          ) : (
            <p className="text-[12px] text-[#a4422c]">Bắt buộc: ảnh nghiệm thu hiện trạng sau khi sửa.</p>
          )}
          <button
            type="button"
            onClick={() => void submitCompletion()}
            disabled={busy === "completion" || completionFiles.length === 0}
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50"
          >
            <Send className="size-4" /> Gửi nghiệm thu
          </button>
        </section>
      )}

      {task.status === "SUBMITTED" && (
        <div className="rounded-[8px] border border-[#f4deb4] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#9a6a12]">
          Bạn đã gửi nghiệm thu. Đang chờ chủ trọ duyệt.
        </div>
      )}

      {task.isAssignee && (
        <PriceNegotiation taskId={task.id} taskStatus={task.status} viewerRole="STAFF" onUpdated={() => load()} />
      )}
      {task.status === "COMPLETED" && <TaskReview taskId={task.id} enabled counterpartLabel="chủ trọ" />}
      {task.isAssignee && (
        <DisputeForm taskId={task.id} targetUserId={task.landlordId} targetLabel="chủ trọ" onSubmitted={() => load()} />
      )}
    </div>
  );
}

export default function StaffTaskDetailPage() {
  return (
    <React.Suspense
      fallback={<div className="py-12 text-center text-sm text-[#74817b]">Đang tải công việc...</div>}
    >
      <StaffTaskDetailContent />
    </React.Suspense>
  );
}

