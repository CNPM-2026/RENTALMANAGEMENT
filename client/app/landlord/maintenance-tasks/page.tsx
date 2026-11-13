"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Users,
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
import type { MaintenanceTask, MaintenanceTaskApplicant } from "@/types/models";

/**
 * MARKETPLACE CÔNG VIỆC BẢO TRÌ — phía chủ trọ (Batch 2).
 *
 * Trang này KHÔNG tạo công việc: mọi công việc phải bắt nguồn từ một báo cáo sự
 * cố của khách thuê (`/landlord/maintenance` → "Tạo việc cho thợ"). Nhờ vậy mỗi
 * công việc luôn có `sourceIssueId` và nơi làm việc được suy ra từ chính sự cố,
 * không thể đăng việc ở địa chỉ khác nơi khách thuê báo.
 *
 * Trang chỉ là lớp điều khiển: mọi kiểm tra quyền sở hữu, KYC của thợ và ràng
 * buộc "một công việc chỉ giao cho một thợ" đều nằm ở server.
 */

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : null;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("vi-VN");
}

function statusClass(status: MaintenanceTask["status"]) {
  if (status === "OPEN") return "bg-[#eaf2ed] text-[#15594f]";
  if (status === "ASSIGNED") return "bg-[#e7eefb] text-[#2a4d8f]";
  return "bg-[#f7f6f2] text-[#74817b]";
}

export default function LandlordMaintenanceTasksPage() {
  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([]);
  const [applications, setApplications] = React.useState<Record<string, MaintenanceTaskApplicant[]>>({});
  const [openTaskId, setOpenTaskId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  /** 🆕 Batch 3 — ghi chú/lý do dùng chung cho ô duyệt nghiệm thu. */
  const [reviewTaskId, setReviewTaskId] = React.useState<string | null>(null);
  const [reviewNote, setReviewNote] = React.useState("");

  const loadTasks = React.useCallback(() => {
    apiClient.maintenanceTasks
      .getMine()
      .then(setTasks)
      .catch(() => setTasks([]));
  }, []);

  React.useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setError(
        err.errors?.length
          ? err.errors.map((item) => `${item.field}: ${item.message}`).join(" • ")
          : err.message,
      );
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  };

  /**
   * Không còn hàm tạo công việc ở đây: công việc chỉ được tạo từ một báo cáo sự
   * cố (`POST /maintenance/:id/tasks`). Trang này chỉ quản lý công việc đã có.
   */

  const toggleApplications = async (taskId: string) => {
    if (openTaskId === taskId) {
      setOpenTaskId(null);
      return;
    }
    setOpenTaskId(taskId);
    try {
      const items = await apiClient.maintenanceTasks.listApplications(taskId);
      setApplications((prev) => ({ ...prev, [taskId]: items }));
    } catch (err) {
      handleError(err, "Không tải được danh sách đơn ứng tuyển.");
    }
  };

  const acceptApplication = async (taskId: string, applicationId: string) => {
    setError(null);
    setMessage(null);
    setBusyId(applicationId);
    try {
      const updated = await apiClient.maintenanceTasks.acceptApplication(taskId, applicationId);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, ...updated, _count: task._count }
            : task,
        ),
      );
      const items = await apiClient.maintenanceTasks.listApplications(taskId);
      setApplications((prev) => ({ ...prev, [taskId]: items }));
      setMessage("Đã giao việc cho thợ.");
    } catch (err) {
      handleError(err, "Không giao được việc. Có thể công việc vừa được giao cho thợ khác.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectApplication = async (taskId: string, applicationId: string) => {
    setError(null);
    setMessage(null);
    setBusyId(applicationId);
    try {
      await apiClient.maintenanceTasks.rejectApplication(taskId, applicationId);
      const items = await apiClient.maintenanceTasks.listApplications(taskId);
      setApplications((prev) => ({ ...prev, [taskId]: items }));
      setMessage("Đã từ chối đơn ứng tuyển.");
    } catch (err) {
      handleError(err, "Không từ chối được đơn ứng tuyển.");
    } finally {
      setBusyId(null);
    }
  };

  const cancelTask = async (taskId: string) => {
    setError(null);
    setMessage(null);
    setBusyId(taskId);
    try {
      const updated = await apiClient.maintenanceTasks.cancel(taskId);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task)));
      setMessage("Đã huỷ công việc.");
    } catch (err) {
      handleError(err, "Không huỷ được công việc.");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * 🆕 Batch 3 — chủ trọ XÁC NHẬN hoàn thành. Server kiểm tra lại quyền sở hữu
   * và trạng thái SUBMITTED bằng compare-and-set, nên hai tab bấm cùng lúc chỉ
   * một bên thắng.
   */
  const confirmCompletion = async (taskId: string) => {
    setError(null);
    setMessage(null);
    setBusyId(taskId);
    try {
      const note = reviewTaskId === taskId ? reviewNote.trim() : "";
      const updated = await apiClient.maintenanceTasks.confirmCompletion(
        taskId,
        note ? { note } : {},
      );
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task)));
      setReviewTaskId(null);
      setReviewNote("");
      setMessage("Đã xác nhận hoàn thành công việc.");
    } catch (err) {
      handleError(err, "Không xác nhận được hoàn thành. Có thể kết quả vừa được xử lý ở nơi khác.");
    } finally {
      setBusyId(null);
    }
  };

  /** 🆕 Batch 3 — YÊU CẦU LÀM LẠI: lý do bắt buộc ≥ 10 ký tự (server cũng kiểm tra). */
  const rejectCompletion = async (taskId: string) => {
    const reason = (reviewTaskId === taskId ? reviewNote : "").trim();
    if (reason.length < 10) {
      setError("Vui lòng nêu lý do yêu cầu làm lại (ít nhất 10 ký tự) để thợ biết cần sửa gì.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(taskId);
    try {
      const updated = await apiClient.maintenanceTasks.rejectCompletion(taskId, reason);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task)));
      setReviewTaskId(null);
      setReviewNote("");
      setMessage("Đã yêu cầu thợ làm lại.");
    } catch (err) {
      handleError(err, "Không gửi được yêu cầu làm lại.");
    } finally {
      setBusyId(null);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Chợ công việc bảo trì</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Nhận đơn từ thợ đã xác minh CCCD và giao việc cho đúng một thợ. Công việc được tạo từ
            báo cáo sự cố của khách thuê ở mục “Sửa chữa &amp; Bảo trì”.
          </p>
        </div>
        <Link
          href="/landlord/maintenance"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <ClipboardList className="size-4" />
          <span>Tạo việc từ sự cố</span>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#cfe3d8] bg-[#eaf2ed] px-4 py-3 text-[13px] text-[#15594f]">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}



      <div className="grid grid-cols-1 gap-4">
        {tasks.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-6 text-center text-[13px] text-[#74817b]">
            Chưa có công việc nào. Việc cần thợ được tạo từ báo cáo sự cố của khách thuê ở mục “Sửa
            chữa &amp; Bảo trì”.
          </p>
        )}

        {tasks.map((task) => {
          const counts = applications[task.id];
          const isOpen = task.status === "OPEN";
          const budgetMin = formatMoney(task.budgetMin);
          const budgetMax = formatMoney(task.budgetMax);
          return (
            <div key={task.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/landlord/maintenance-tasks/${task.id}`} className="font-bold text-[16px] text-[#203c37] hover:text-[#15594f] hover:underline">{task.title}</Link>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClass(task.status)}`}>
                      {translateTaskStatus(task.status)}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f3] text-[#15594f]">
                      {translateServiceCategory(task.category)}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fbf1dc] text-[#9a6a12]">
                      {translateUrgency(task.urgency)}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#74817b] whitespace-pre-line">{task.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#74817b]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {task.property?.name ?? "—"}
                      {task.room ? ` · Phòng ${task.room.roomNumber}` : ""} · {task.address}
                    </span>
                    {budgetMin || budgetMax ? (
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="size-3.5" />
                        {budgetMin ?? "…"} – {budgetMax ?? "…"}
                      </span>
                    ) : null}
                    {task.preferredStartAt ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3.5" />
                        {formatDateTime(task.preferredStartAt)}
                      </span>
                    ) : null}
                    {task.additionalInstructions ? <span>Lưu ý: {task.additionalInstructions}</span> : null}
                  </div>
                  {task.images?.length ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {task.images.map((image) => {
                        const url = resolveMediaUrl(image.imageUrl);
                        if (!url) return null;
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={image.id}
                            src={url}
                            alt={`Ảnh hiện trạng: ${task.title}`}
                            className="size-16 rounded-[8px] object-cover border border-[#e2e7e1]"
                          />
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleApplications(task.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed] cursor-pointer"
                  >
                    <Users className="size-3.5" />
                    <span>Đơn ứng tuyển ({task._count?.applications ?? counts?.length ?? 0})</span>
                  </button>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => cancelTask(task.id)}
                      disabled={busyId === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#f0d5cd] text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      <span>Huỷ việc</span>
                    </button>
                  )}
                </div>
              </div>


              {/* 🆕 Batch 3 — thợ đã gửi nghiệm thu: xác nhận hoặc yêu cầu làm lại */}
              {task.status === "SUBMITTED" && (
                <div className="border-t border-[#e2e7e1] pt-3 space-y-2">
                  <p className="text-[13px] font-semibold text-[#203c37]">Kết quả thợ gửi nghiệm thu</p>
                  <p className="text-[12px] text-[#74817b]">
                    Gửi lúc {formatDateTime(task.completionSubmittedAt) ?? "—"}
                    {task.completionAttempts ? ` · lần ${task.completionAttempts}` : ""}
                  </p>
                  {task.completionNote ? (
                    <p className="text-[13px] text-[#203c37] whitespace-pre-line">{task.completionNote}</p>
                  ) : null}
                  {task.completionImages?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {task.completionImages.map((image) => {
                        const url = resolveMediaUrl(image.imageUrl);
                        if (!url) return null;
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={image.id}
                            src={url}
                            alt={`Ảnh nghiệm thu: ${task.title}`}
                            className="size-20 rounded-[8px] object-cover border border-[#e2e7e1]"
                          />
                        );
                      })}
                    </div>
                  ) : null}

                  <label className="block text-[12px] font-semibold text-[#203c37]">
                    Ghi chú duyệt / lý do yêu cầu làm lại
                    <textarea
                      value={reviewTaskId === task.id ? reviewNote : ""}
                      onChange={(event) => {
                        setReviewTaskId(task.id);
                        setReviewNote(event.target.value);
                      }}
                      rows={3}
                      maxLength={1000}
                      placeholder="VD: Trần vẫn còn thấm ở góc phải, cần xử lý lại."
                      className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => confirmCompletion(task.id)}
                      disabled={busyId === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Xác nhận hoàn thành</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectCompletion(task.id)}
                      disabled={busyId === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#f0d5cd] text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      <span>Yêu cầu làm lại</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#74817b]">
                    Xác nhận sẽ chuyển công việc và báo cáo sự cố liên quan sang trạng thái hoàn thành.
                    Yêu cầu làm lại bắt buộc có lý do (ít nhất 10 ký tự).
                  </p>
                </div>
              )}

              {task.status === "IN_PROGRESS" && task.completionReviewNote ? (
                <p className="text-[12px] text-[#a4422c]">
                  Đã yêu cầu thợ làm lại: {task.completionReviewNote}
                </p>
              ) : null}

              {/* 🆕 Batch 3 — chốt giá trước khi thợ bắt đầu; đổi giá cần cả hai bên. */}
              {task.status !== "OPEN" && task.status !== "CANCELLED" && (
                <PriceNegotiation taskId={task.id} taskStatus={task.status} viewerRole="LANDLORD" />
              )}
              {/* 🆕 Batch 4 — đánh giá công việc đã hoàn thành. */}
              <TaskReview taskId={task.id} enabled={task.status === "COMPLETED"} counterpartLabel="thợ" />
              {/* 🆕 Batch 4 — báo cáo/tranh chấp gắn với công việc này. */}
              {task.assignedStaffId && (task.status === "IN_PROGRESS" || task.status === "COMPLETED") && (
                <DisputeForm
                  taskId={task.id}
                  targetUserId={task.assignedStaffId}
                  targetLabel={task.assignedStaff?.fullName ?? "thợ được giao"}
                />
              )}

              {task.status === "COMPLETED" ? (
                <p className="text-[12px] text-[#15594f]">
                  Đã nghiệm thu{task.completionReviewedAt ? ` lúc ${formatDateTime(task.completionReviewedAt)}` : ""}
                  {task.completionReviewNote ? ` · Ghi chú: ${task.completionReviewNote}` : ""}
                </p>
              ) : null}


              {openTaskId === task.id && (
                <div className="border-t border-[#e2e7e1] pt-3 space-y-3">
                  {(counts ?? []).length === 0 ? (
                    <p className="text-[13px] text-[#74817b]">Chưa có thợ nào ứng tuyển công việc này.</p>
                  ) : (
                    (counts ?? []).map((application) => {
                      const profile = application.staff.staffProfile;
                      const canDecide = isOpen && application.status === "PENDING";
                      return (
                        <div
                          key={application.id}
                          className="rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] p-3 space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-semibold text-[#203c37]">
                              {application.staff.fullName}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                              KYC: {translateKycState(application.kycStatus ?? "NONE")}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f6f2] text-[#74817b]">
                              {translateApplicationStatus(application.status)}
                            </span>
                            {application.staff.phone ? (
                              <span className="text-[12px] text-[#74817b]">{application.staff.phone}</span>
                            ) : null}
                          </div>
                          {profile?.skills?.length ? (
                            <p className="text-[12px] text-[#74817b]">
                              Kỹ năng: {profile.skills.map((skill) => translateServiceCategory(skill.category)).join(", ")}
                            </p>
                          ) : null}
                          {profile?.description ? (
                            <p className="text-[12px] text-[#74817b]">{profile.description}</p>
                          ) : null}
                          {application.message ? (
                            <p className="text-[13px] text-[#203c37] whitespace-pre-line">
                              &ldquo;{application.message}&rdquo;
                            </p>
                          ) : null}
                          {canDecide && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => acceptApplication(task.id, application.id)}
                                disabled={busyId === application.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span>Giao việc</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectApplication(task.id, application.id)}
                                disabled={busyId === application.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#f0d5cd] text-[12px] font-semibold text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-50 cursor-pointer"
                              >
                                <XCircle className="size-3.5" />
                                <span>Từ chối</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
