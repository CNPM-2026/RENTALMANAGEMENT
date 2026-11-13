"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Loader2,
  MapPin,
  User,
  Wallet,
  XCircle,
} from "lucide-react";
import { apiClient, ApiError, resolveMediaUrl } from "@/lib/api";
import { PriceNegotiation } from "@/components/maintenance/price-negotiation";
import { TaskReview } from "@/components/maintenance/task-review";
import { DisputeForm } from "@/components/disputes/dispute-form";
import {
  translateApplicationStatus,
  translateKycState,
  translateServiceCategory,
  translateTaskStatus,
  translateUrgency,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { MaintenanceTask, MaintenanceTaskApplicant } from "@/types/models";

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : null;
}

/**
 * Trang CHI TIẾT công việc bảo trì (phía chủ trọ / nhân viên có quyền MAINTENANCE).
 *
 * Đây là nơi duy nhất để:
 *  - xem đơn ứng tuyển và giao việc;
 *  - xem bằng chứng nghiệm thu thợ vừa gửi và DUYỆT / YÊU CẦU LÀM LẠI;
 *  - thương lượng giá, đánh giá và mở tranh chấp.
 * Mọi quyết định vẫn được server kiểm tra lại bằng trạng thái thật.
 */
function LandlordMaintenanceTaskDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = params?.id;

  const [task, setTask] = React.useState<MaintenanceTask | null>(null);
  const [applications, setApplications] = React.useState<MaintenanceTaskApplicant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [confirmNote, setConfirmNote] = React.useState("");
  const [rejectReason, setRejectReason] = React.useState("");

  const load = React.useCallback(() => {
    if (!taskId) return;
    // Không setState ĐỒNG BỘ trong effect: trạng thái tải ban đầu là `true`,
    // còn các lần tải lại chỉ cập nhật state trong callback promise.
    apiClient.maintenanceTasks
      .getById(taskId)
      .then(async (data) => {
        setTask(data);
        setApplications(data.applications ?? []);
        // Danh sách đơn ứng tuyển có thể chưa nằm trong payload chi tiết.
        if (!data.applications) {
          const items = await apiClient.maintenanceTasks.listApplications(taskId).catch(() => []);
          setApplications(items);
        }
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không tải được công việc."),
      )
      .finally(() => setLoading(false));
  }, [taskId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, successText: string, busyKey: string) => {
    setBusyId(busyKey);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successText);
      load();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.errors?.length ? err.errors.map((item) => item.message).join(" • ") : err.message);
      } else {
        setError(err instanceof Error ? err.message : "Không thực hiện được thao tác.");
      }
    } finally {
      setBusyId(null);
    }
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
        <Link href="/landlord/maintenance-tasks" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f]">
          <ArrowLeft className="size-4" /> Về danh sách công việc
        </Link>
        <div className="rounded-[12px] border border-[#f6cbc1] bg-[#fbeae6] p-6 text-sm text-[#a4422c]">
          {error ?? "Không tìm thấy công việc."}
        </div>
      </div>
    );
  }

  const pendingApplications = applications.filter((application) => application.status === "PENDING");
  const budget = [formatMoney(task.budgetMin), formatMoney(task.budgetMax)].filter(Boolean).join(" – ");

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/landlord/maintenance-tasks")}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
      >
        <ArrowLeft className="size-4" /> Về danh sách công việc
      </button>

      <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#74817b]">
              {translateServiceCategory(task.category)} · Công việc #{task.id.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-[24px] font-semibold text-[#203c37]">{task.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 font-semibold text-[#15594f]">
                {translateTaskStatus(task.status)}
              </span>
              <span className="rounded-full bg-[#fbf1dc] px-2.5 py-1 font-semibold text-[#9a6a12]">
                {translateUrgency(task.urgency)}
              </span>
              {task.property?.name && (
                <span className="text-[#74817b]">
                  {task.property.name}{task.room ? ` · Phòng ${task.room.roomNumber}` : ""}
                </span>
              )}
            </div>
          </div>
          {task.status === "OPEN" && (
            <button
              type="button"
              onClick={() => void run(() => apiClient.maintenanceTasks.cancel(task.id), "Đã huỷ công việc.", "cancel")}
              disabled={busyId === "cancel"}
              className="rounded-[8px] border border-[#f6cbc1] px-3.5 py-2 text-[13px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50"
            >
              Huỷ công việc
            </button>
          )}
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

        {task.additionalInstructions && (
          <p className="mt-4 rounded-[8px] bg-[#f7f6f2] p-3 text-[13px] text-[#5c6964]">
            <span className="font-semibold text-[#203c37]">Yêu cầu thêm: </span>
            {task.additionalInstructions}
          </p>
        )}

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

      {task.assignedStaff && (
        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Thợ được giao</h2>
          <Link
            href={`/users/${task.assignedStaff.id}`}
            className="mt-3 inline-flex items-center gap-3 rounded-[8px] p-2 hover:bg-[#f7f6f2]"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-[#eaf2ed] text-[#15594f]"><User className="size-5" /></span>
            <span>
              <span className="block text-[14px] font-semibold text-[#203c37]">{task.assignedStaff.fullName}</span>
              <span className="block text-[12px] text-[#74817b]">
                {task.assignedStaff.phone ?? "Xem hồ sơ & đánh giá"}
              </span>
            </span>
          </Link>
        </section>
      )}

      {task.status === "OPEN" && (
        <section className="space-y-3 rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <h2 className="text-[15px] font-semibold text-[#203c37]">
            Đơn ứng tuyển ({pendingApplications.length} đang chờ)
          </h2>
          {applications.length === 0 ? (
            <p className="text-sm text-[#74817b]">Chưa có thợ nào ứng tuyển.</p>
          ) : (
            applications.map((application) => (
              <div key={application.id} className="rounded-[8px] border border-[#e2e7e1] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/users/${application.staff.id}`} className="text-[14px] font-semibold text-[#15594f] hover:underline">
                    {application.staff.fullName}
                  </Link>
                  <span className="text-[12px] text-[#74817b]">
                    {translateApplicationStatus(application.status)} · KYC {translateKycState(application.kycStatus)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-[#5c6964]">
                  {application.message || "Không có lời nhắn."}
                </p>
                <p className="mt-1 text-[12px] text-[#74817b]">
                  Giá đề nghị: {formatMoney(application.proposedAmount) ?? "Theo ngân sách"}
                </p>
                {application.status === "PENDING" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          () => apiClient.maintenanceTasks.acceptApplication(task.id, application.id),
                          "Đã giao việc cho thợ.",
                          `accept-${application.id}`,
                        )
                      }
                      disabled={busyId === `accept-${application.id}`}
                      className="rounded-[7px] bg-[#15594f] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50"
                    >
                      Giao việc
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run(
                          () => apiClient.maintenanceTasks.rejectApplication(task.id, application.id),
                          "Đã từ chối đơn ứng tuyển.",
                          `reject-${application.id}`,
                        )
                      }
                      disabled={busyId === `reject-${application.id}`}
                      className="rounded-[7px] border border-[#f6cbc1] px-3 py-1.5 text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50"
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      )}


      {task.status === "SUBMITTED" && (
        <section className="space-y-4 rounded-[12px] border border-[#f4deb4] bg-[#fffaf0] p-5 shadow-xs">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Nghiệm thu công việc</h2>
          <p className="text-[13px] text-[#74817b]">
            Thợ đã gửi nghiệm thu lúc {task.completionSubmittedAt ? formatDate(task.completionSubmittedAt, "datetime") : "—"}
            {task.completionAttempts ? ` (lần thứ ${task.completionAttempts})` : ""}.
          </p>
          {task.completionNote && (
            <p className="rounded-[8px] bg-white p-3 text-[13px] text-[#3f4f49]">
              <span className="font-semibold">Ghi chú của thợ: </span>
              {task.completionNote}
            </p>
          )}
          {(task.completionImages?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
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
          )}
          {task.completionReviewNote && task.completionReviewedAt && (
            <p className="rounded-[8px] border border-[#f6cbc1] bg-[#fbeae6] p-3 text-[13px] text-[#a4422c]">
              Lần duyệt trước: {task.completionReviewNote}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Ghi chú xác nhận (tuỳ chọn)
              <textarea
                value={confirmNote}
                onChange={(event) => setConfirmNote(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]"
                placeholder="Ví dụ: Đã kiểm tra, vệ sinh sạch sẽ."
              />
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => apiClient.maintenanceTasks.confirmCompletion(task.id, { note: confirmNote || null }),
                    "Đã xác nhận hoàn thành.",
                    "confirm",
                  )
                }
                disabled={busyId === "confirm"}
                className="mt-2 rounded-[7px] bg-[#15594f] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-50"
              >
                Duyệt hoàn thành
              </button>
            </label>
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Lý do làm lại (bắt buộc, tối thiểu 10 ký tự)
              <textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]"
                placeholder="Mô tả cụ thể phần chưa đạt để thợ sửa lại."
              />
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => apiClient.maintenanceTasks.rejectCompletion(task.id, rejectReason.trim()),
                    "Đã gửi yêu cầu làm lại.",
                    "reject-completion",
                  )
                }
                disabled={busyId === "reject-completion" || rejectReason.trim().length < 10}
                className="mt-2 inline-flex items-center gap-1 rounded-[7px] border border-[#f6cbc1] px-4 py-2 text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50"
              >
                <XCircle className="size-3.5" /> Yêu cầu làm lại
              </button>
            </label>
          </div>
        </section>
      )}

      {task.status === "COMPLETED" && (
        <section className="rounded-[12px] border border-[#cce1d5] bg-[#eaf2ed] p-5 text-[13px] text-[#15594f]">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="size-4" /> Công việc đã hoàn thành
          </p>
          {task.completionReviewNote && <p className="mt-1">Ghi chú duyệt: {task.completionReviewNote}</p>}
        </section>
      )}

      {task.assignedStaffId && (
        <PriceNegotiation
          taskId={task.id}
          taskStatus={task.status}
          viewerRole="LANDLORD"
          onUpdated={() => load()}
        />
      )}
      {task.status === "COMPLETED" && (
        <TaskReview
          taskId={task.id}
          enabled
          counterpartLabel={task.assignedStaff?.fullName}
        />
      )}
      {task.assignedStaff && (
        <DisputeForm
          taskId={task.id}
          targetUserId={task.assignedStaff.id}
          targetLabel={task.assignedStaff.fullName}
          onSubmitted={() => load()}
        />
      )}
    </div>
  );
}

export default function LandlordMaintenanceTaskDetailPage() {
  return (
    <React.Suspense
      fallback={<div className="py-12 text-center text-sm text-[#74817b]">Đang tải công việc...</div>}
    >
      <LandlordMaintenanceTaskDetailContent />
    </React.Suspense>
  );
}

