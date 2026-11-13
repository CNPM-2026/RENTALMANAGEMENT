"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Filter,
  ImagePlus,
  MapPin,
  PlayCircle,
  Send,
  ShieldAlert,
  Wallet,
  XCircle,
} from "lucide-react";
import { apiClient, ApiError, resolveMediaUrl } from "@/lib/api";
import { parseDecimalInput } from "@/lib/numeric";
import { NumericInput } from "@/components/ui/numeric-input";
import { PriceNegotiation } from "@/components/maintenance/price-negotiation";
import { TaskReview } from "@/components/maintenance/task-review";
import {
  SERVICE_CATEGORY_OPTIONS,
  translateApplicationStatus,
  translateServiceCategory,
  translateTaskStatus,
  translateUrgency,
} from "@/lib/labels";
import type {
  MaintenanceTask,
  MaintenanceTaskApplication,
  ServiceCategory,
  StaffProfile,
} from "@/types/models";

/**
 * MARKETPLACE CÔNG VIỆC BẢO TRÌ — phía THỢ (Batch 2).
 *
 * UI tự tắt nút "Ứng tuyển" khi thợ chưa được duyệt KYC, nhưng đó chỉ là lớp
 * trải nghiệm: quyền thực sự do server quyết định (`assertKycApproved` chạy
 * trong cùng transaction với lệnh ghi). Không có dữ liệu KYC nào được gửi lên
 * từ client — server luôn đọc lại từ DB.
 */
const DEFAULT_FILTERS = {
  search: "",
  category: "" as ServiceCategory | "",
  urgency: "" as "LOW" | "MEDIUM" | "HIGH" | "",
  latitude: "",
  longitude: "",
  radiusKm: "",
};

/** Rỗng -> null (không phải 0); chấp nhận dấu phẩy thập phân. */
function parseOptionalNumber(raw: string, label: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`${label} không hợp lệ: "${trimmed}" không phải là số.`);
  return value;
}

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

function formatDistance(distanceKm?: number | null) {
  if (distanceKm === null || distanceKm === undefined) return null;
  return `Cách ${distanceKm} km`;
}

export default function StaffTasksPage() {
  const [tasks, setTasks] = React.useState<MaintenanceTask[]>([]);
  const [myApplications, setMyApplications] = React.useState<MaintenanceTaskApplication[]>([]);
  const [assignedTasks, setAssignedTasks] = React.useState<MaintenanceTask[]>([]);
  const [profile, setProfile] = React.useState<StaffProfile | null>(null);
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [applied, setApplied] = React.useState(DEFAULT_FILTERS);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  /** 🆕 Batch 3 — công việc đang mở form gửi nghiệm thu. */
  const [completionTaskId, setCompletionTaskId] = React.useState<string | null>(null);
  const [completionNote, setCompletionNote] = React.useState("");
  const [completionFiles, setCompletionFiles] = React.useState<File[]>([]);
  /** 🆕 Batch 3 — giá thợ đề nghị khi ứng tuyển, theo từng công việc. */
  const [applyPrices, setApplyPrices] = React.useState<Record<string, string>>({});

  const kycStatus = profile?.kycStatus ?? "NONE";
  const isKycApproved = kycStatus === "APPROVED";
  const canApply = isKycApproved && Boolean(profile) && profile?.isAvailable !== false;

  const loadTasks = React.useCallback(
    () =>
      Promise.resolve()
        .then(() => {
          const latitude = parseOptionalNumber(applied.latitude, "Vĩ độ");
          const longitude = parseOptionalNumber(applied.longitude, "Kinh độ");
          if ((latitude === null) !== (longitude === null)) {
            throw new Error("Vui lòng nhập đủ cả vĩ độ và kinh độ, hoặc bỏ trống cả hai.");
          }
          const radiusKm = parseOptionalNumber(applied.radiusKm, "Bán kính");
          return {
            page: 1,
            limit: 50,
            ...(applied.search.trim() ? { search: applied.search.trim() } : {}),
            ...(applied.category ? { category: applied.category as ServiceCategory } : {}),
            ...(applied.urgency ? { urgency: applied.urgency as "LOW" | "MEDIUM" | "HIGH" } : {}),
            ...(latitude !== null && longitude !== null
              ? {
                  latitude,
                  longitude,
                  sort: "nearest" as const,
                  ...(radiusKm !== null ? { radiusKm } : {}),
                }
              : {}),
          };
        })
        .then((query) => apiClient.maintenanceTasks.browseOpen(query))
        .then((result) => {
          setTasks(result.data ?? []);
          setError(null);
        })
        .catch((err: unknown) => {
          setTasks([]);
          setError(err instanceof Error ? err.message : "Không tải được danh sách công việc.");
        }),
    [applied],
  );

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  React.useEffect(() => {
    apiClient.staffMarketplace
      .getMe()
      .then(setProfile)
      .catch(() => setProfile(null));
    apiClient.maintenanceTasks
      .getMyApplications()
      .then(setMyApplications)
      .catch(() => setMyApplications([]));
  }, []);

  /**
   * 🆕 Batch 3 — việc ĐÃ GIAO cho chính thợ này. `getAssigned` không nhận id
   * thợ: server lấy từ token, nên không thể xem việc của người khác.
   */
  const loadAssigned = React.useCallback(
    () =>
      apiClient.maintenanceTasks
        .getAssigned()
        .then(setAssignedTasks)
        .catch(() => setAssignedTasks([])),
    [],
  );

  React.useEffect(() => {
    void loadAssigned();
  }, [loadAssigned]);

  const handleError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError) {
      setError(err.errors?.length ? err.errors.map((item) => `${item.field}: ${item.message}`).join(" • ") : err.message);
      return;
    }
    setError(err instanceof Error ? err.message : fallback);
  };

  const apply = async (taskId: string) => {
    setBusyId(taskId);
    setError(null);
    setMessage(null);
    try {
      const rawPrice = applyPrices[taskId] ?? "";
      let proposedAmount: number | undefined;
      if (rawPrice.trim() !== "") {
        const parsed = parseDecimalInput(rawPrice);
        if (parsed === null || parsed <= 0) {
          throw new Error("Giá đề nghị không hợp lệ. Vui lòng nhập số lớn hơn 0 (tối đa 2 chữ số thập phân).");
        }
        proposedAmount = parsed;
      }
      const application = await apiClient.maintenanceTasks.apply(taskId, {
        ...(proposedAmount !== undefined ? { proposedAmount } : {}),
      });
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, myApplication: { id: application.id, status: application.status } }
            : task,
        ),
      );
      setMyApplications((prev) => [application, ...prev.filter((item) => item.taskId !== taskId)]);
      setMessage("Đã gửi đơn ứng tuyển. Chờ chủ trọ phản hồi.");
    } catch (err) {
      handleError(err, "Không gửi được đơn ứng tuyển.");
    } finally {
      setBusyId(null);
    }
  };

  const withdraw = async (taskId: string) => {
    setBusyId(taskId);
    setError(null);
    setMessage(null);
    try {
      const application = await apiClient.maintenanceTasks.withdraw(taskId);
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, myApplication: { id: application.id, status: application.status } }
            : task,
        ),
      );
      setMyApplications((prev) =>
        prev.map((item) => (item.taskId === taskId ? { ...item, status: application.status } : item)),
      );
      setMessage("Đã rút đơn ứng tuyển.");
    } catch (err) {
      handleError(err, "Không rút được đơn ứng tuyển.");
    } finally {
      setBusyId(null);
    }
  };

  /** 🆕 Batch 3 — bắt đầu làm việc (server kiểm tra KYC trong transaction). */
  const startWork = async (taskId: string) => {
    setBusyId(taskId);
    setError(null);
    setMessage(null);
    try {
      const updated = await apiClient.maintenanceTasks.startWork(taskId);
      setAssignedTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task)),
      );
      setMessage("Đã bắt đầu công việc. Gửi nghiệm thu khi hoàn thành để chủ trọ xác nhận.");
    } catch (err) {
      handleError(err, "Không bắt đầu được công việc.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleCompletionForm = (taskId: string) => {
    setCompletionTaskId((current) => (current === taskId ? null : taskId));
    setCompletionNote("");
    setCompletionFiles([]);
    setError(null);
    setMessage(null);
  };

  /**
   * 🆕 Batch 3 — gửi nghiệm thu kèm ảnh. Chỉ gửi TỆP: server tự upload lên
   * Cloudinary riêng tư rồi cấp đường dẫn có token, nên client không thể chèn
   * URL ảnh lạ.
   */
  const submitCompletion = async (taskId: string) => {
    const note = completionNote.trim();
    if (!note && completionFiles.length === 0) {
      setError("Cần ghi chú hoặc ít nhất một ảnh nghiệm thu.");
      return;
    }
    setBusyId(taskId);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      if (note) formData.append("note", note);
      for (const file of completionFiles) formData.append("images", file);
      const updated = await apiClient.maintenanceTasks.submitCompletion(taskId, formData);
      setAssignedTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, ...updated } : task)),
      );
      setCompletionTaskId(null);
      setCompletionNote("");
      setCompletionFiles([]);
      setMessage("Đã gửi nghiệm thu. Chờ chủ trọ xác nhận.");
    } catch (err) {
      handleError(err, "Không gửi được nghiệm thu.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Việc làm</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Công việc đang mở</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Danh sách chỉ gồm công việc còn mở từ các chủ trọ. Chỉ thợ đã xác minh CCCD mới ứng tuyển được.
        </p>
      </div>

      {!isKycApproved && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#fbf1dc] bg-[#fdf8ec] px-4 py-3 text-[13px] text-[#9a6a12]">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <span>
            Bạn cần được duyệt xác minh CCCD (KYC) trước khi ứng tuyển.{" "}
            <Link href="/staff/kyc" className="font-semibold underline">
              Nộp / kiểm tra hồ sơ KYC
            </Link>
          </span>
        </div>
      )}

      {isKycApproved && profile && profile.isAvailable === false && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#fbf1dc] bg-[#fdf8ec] px-4 py-3 text-[13px] text-[#9a6a12]">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Bạn đang tắt trạng thái nhận việc.{" "}
            <Link href="/staff/profile" className="font-semibold underline">
              Bật lại trong hồ sơ
            </Link>{" "}
            để ứng tuyển.
          </span>
        </div>
      )}

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

      {/* 🆕 Batch 3 — VIỆC ĐÃ GIAO: bắt đầu, gửi nghiệm thu, xem kết quả duyệt */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[18px] font-semibold text-[#203c37]">Việc của tôi</h2>
          <button
            type="button"
            onClick={() => void loadAssigned()}
            className="rounded-[8px] border border-[#e2e7e1] px-3 py-1.5 text-[12px] font-medium text-[#74817b] hover:bg-[#f7f6f2] cursor-pointer"
          >
            Làm mới
          </button>
        </div>

        {assignedTasks.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-5 text-center text-[13px] text-[#74817b]">
            Bạn chưa được giao công việc nào.
          </p>
        ) : (
          <div className="space-y-3">
            {assignedTasks.map((task) => {
              const isRejected = task.status === "IN_PROGRESS" && Boolean(task.completionReviewNote);
              return (
                <div
                  key={task.id}
                  className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/staff/tasks/${task.id}`} className="font-bold text-[16px] text-[#203c37] hover:text-[#15594f] hover:underline">{task.title}</Link>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f3] text-[#15594f]">
                          {translateTaskStatus(task.status)}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f6f2] text-[#74817b]">
                          {translateServiceCategory(task.category)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#74817b]">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3.5" />
                          {task.property?.name ? `${task.property.name} · ` : ""}
                          {task.address}
                          {task.room ? ` · Phòng ${task.room.roomNumber}` : ""}
                        </span>
                        {task.startedAt ? (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            Bắt đầu: {formatDateTime(task.startedAt)}
                          </span>
                        ) : null}
                      </div>
                      {task.images?.length ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {task.images.map((image) => {
                            const src = resolveMediaUrl(image.imageUrl);
                            if (!src) return null;
                            return (
                              <a key={image.id} href={src} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={`Ảnh hiện trạng: ${task.title}`}
                                  className="size-16 rounded-[8px] border border-[#e2e7e1] object-cover"
                                />
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.status === "ASSIGNED" && (
                        <button
                          type="button"
                          onClick={() => startWork(task.id)}
                          disabled={busyId === task.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                        >
                          <PlayCircle className="size-3.5" />
                          <span>Bắt đầu</span>
                        </button>
                      )}
                      {task.status === "IN_PROGRESS" && (
                        <button
                          type="button"
                          onClick={() => toggleCompletionForm(task.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] cursor-pointer"
                        >
                          <Send className="size-3.5" />
                          <span>{completionTaskId === task.id ? "Đóng" : "Gửi nghiệm thu"}</span>
                        </button>
                      )}
                      {task.status === "SUBMITTED" && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e7eefb] text-[#2a4d8f]">
                          Chờ chủ trọ xác nhận
                        </span>
                      )}
                      {task.status === "COMPLETED" && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                          Đã hoàn thành
                        </span>
                      )}
                    </div>
                  </div>

                  {isRejected && (
                    <div className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <span>
                        Chủ trọ yêu cầu làm lại: {task.completionReviewNote}
                        {task.completionAttempts ? ` (đã nộp ${task.completionAttempts} lần)` : ""}
                      </span>
                    </div>
                  )}

                  {task.completionSubmittedAt && (
                    <div className="rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] p-3 space-y-1.5">
                      <p className="text-[12px] text-[#74817b]">
                        Gửi nghiệm thu: {formatDateTime(task.completionSubmittedAt) ?? "—"}
                        {task.completionAttempts ? ` · lần ${task.completionAttempts}` : ""}
                      </p>
                      {task.completionNote ? (
                        <p className="text-[13px] text-[#203c37] whitespace-pre-line">
                          {task.completionNote}
                        </p>
                      ) : null}
                      {task.completionImages?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {task.completionImages.map((image) => {
                            const src = resolveMediaUrl(image.imageUrl);
                            if (!src) return null;
                            return (
                              <a key={image.id} href={src} target="_blank" rel="noreferrer">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={src}
                                  alt={`Ảnh nghiệm thu: ${task.title}`}
                                  className="size-16 rounded-[8px] border border-[#e2e7e1] object-cover"
                                />
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {task.status === "COMPLETED" && task.completionReviewNote ? (
                    <p className="text-[12px] text-[#15594f]">
                      Ghi chú của chủ trọ: {task.completionReviewNote}
                    </p>
                  ) : null}

                  {/* 🆕 Batch 3 — hai bên phải chốt giá trước khi thợ bắt đầu. */}
                  <PriceNegotiation taskId={task.id} taskStatus={task.status} viewerRole="STAFF" />
                  {/* 🆕 Batch 4 — chỉ hiện form khi công việc đã hoàn thành. */}
                  <TaskReview taskId={task.id} enabled={task.status === "COMPLETED"} counterpartLabel="chủ trọ" />

                  {completionTaskId === task.id && task.status === "IN_PROGRESS" && (
                    <div className="space-y-2 rounded-[10px] border border-[#e2e7e1] bg-[#fbfcfa] p-3">
                      <label className="block text-[12px] font-semibold text-[#203c37]">
                        Ghi chú nghiệm thu
                        <textarea
                          value={completionNote}
                          onChange={(event) => setCompletionNote(event.target.value)}
                          rows={3}
                          maxLength={2000}
                          placeholder="Đã xử lý những gì, tình trạng hiện tại…"
                          className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
                        />
                      </label>
                      <label className="block text-[12px] font-semibold text-[#203c37]">
                        Ảnh nghiệm thu (tối đa 5 ảnh, mỗi ảnh ≤ 5MB)
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) =>
                            setCompletionFiles(Array.from(event.target.files ?? []).slice(0, 5))
                          }
                          className="mt-1 w-full text-[12px] font-normal text-[#74817b]"
                        />
                      </label>
                      <p className="text-[11px] text-[#74817b]">
                        Ảnh được tải lên kho riêng tư; chỉ chủ trọ của công việc và bạn xem được.
                      </p>
                      <button
                        type="button"
                        onClick={() => submitCompletion(task.id)}
                        disabled={busyId === task.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                      >
                        <ImagePlus className="size-3.5" />
                        <span>Gửi cho chủ trọ</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>


      <form
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...filters });
        }}
        className="rounded-[12px] border border-[#e2e7e1] bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Tìm theo tiêu đề / địa chỉ
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="VD: máy lạnh"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Danh mục
            <select
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value as ServiceCategory | "" })}
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            >
              <option value="">Tất cả danh mục</option>
              {SERVICE_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {translateServiceCategory(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Mức độ khẩn cấp
            <select
              value={filters.urgency}
              onChange={(event) =>
                setFilters({ ...filters, urgency: event.target.value as "LOW" | "MEDIUM" | "HIGH" | "" })
              }
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            >
              <option value="">Tất cả</option>
              <option value="HIGH">Khẩn cấp</option>
              <option value="MEDIUM">Bình thường</option>
              <option value="LOW">Thấp</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Vĩ độ của bạn (để tính khoảng cách)
            <input
              value={filters.latitude}
              onChange={(event) => setFilters({ ...filters, latitude: event.target.value })}
              placeholder="21.0278"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Kinh độ của bạn
            <input
              value={filters.longitude}
              onChange={(event) => setFilters({ ...filters, longitude: event.target.value })}
              placeholder="105.8342"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Bán kính (km)
            <input
              value={filters.radiusKm}
              onChange={(event) => setFilters({ ...filters, radiusKm: event.target.value })}
              placeholder="10"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42] cursor-pointer"
          >
            <Filter className="size-4" />
            <span>Lọc công việc</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setApplied(DEFAULT_FILTERS);
            }}
            className="rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] font-medium text-[#74817b] hover:bg-[#f7f6f2] cursor-pointer"
          >
            Xoá bộ lọc
          </button>
        </div>
        <p className="text-[12px] text-[#74817b]">
          Nhập toạ độ để server sắp xếp theo khoảng cách thật. Không nhập thì danh sách xếp theo thời gian đăng.
        </p>
      </form>


      <div className="grid grid-cols-1 gap-4">
        {tasks.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-6 text-center text-[13px] text-[#74817b]">
            Không có công việc nào phù hợp bộ lọc.
          </p>
        )}

        {tasks.map((task) => {
          const myApplication = task.myApplication;
          const canWithdraw = myApplication?.status === "PENDING";
          const canApplyNow = canApply && !myApplication;
          const budgetMin = formatMoney(task.budgetMin);
          const budgetMax = formatMoney(task.budgetMax);
          const distance = formatDistance(task.distanceKm);
          return (
            <div key={task.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-2">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/staff/tasks/${task.id}`} className="font-bold text-[16px] text-[#203c37] hover:text-[#15594f] hover:underline">{task.title}</Link>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f1f5f3] text-[#15594f]">
                      {translateServiceCategory(task.category)}
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#fbf1dc] text-[#9a6a12]">
                      {translateUrgency(task.urgency)}
                    </span>
                    {myApplication ? (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e7eefb] text-[#2a4d8f]">
                        {translateApplicationStatus(myApplication.status)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-[#74817b] whitespace-pre-line">{task.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#74817b]">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {task.property?.name ? `${task.property.name} · ` : ""}
                      {task.address}
                      {distance ? ` · ${distance}` : ""}
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
                  </div>
                  {task.skills?.length ? (
                    <p className="text-[12px] text-[#74817b]">
                      Yêu cầu: {task.skills.map((skill) => translateServiceCategory(skill.category)).join(", ")}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canApplyNow && (
                    <>
                      <NumericInput
                        value={applyPrices[task.id] ?? ""}
                        onChange={(value) => setApplyPrices((prev) => ({ ...prev, [task.id]: value }))}
                        maxDecimals={2}
                        placeholder="Giá đề nghị (tuỳ chọn)"
                        ariaLabel="Giá đề nghị"
                        className="w-32 rounded-[7px] border border-[#dfe8e1] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#15594f]"
                      />
                      <button
                        type="button"
                        onClick={() => apply(task.id)}
                        disabled={busyId === task.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                      >
                        <BadgeCheck className="size-3.5" />
                        <span>Ứng tuyển</span>
                      </button>
                    </>
                  )}
                  {canWithdraw && (
                    <button
                      type="button"
                      onClick={() => withdraw(task.id)}
                      disabled={busyId === task.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-semibold text-[#74817b] hover:bg-[#f7f6f2] disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      <span>Rút đơn</span>
                    </button>
                  )}
                  {!myApplication && !canApply && (
                    <span className="text-[11px] text-[#74817b] max-w-[160px]">
                      Cần KYC đã duyệt và đang bật nhận việc
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>


      <section className="space-y-3">
        <h2 className="text-[18px] font-semibold text-[#203c37]">Đơn tôi đã gửi</h2>
        {myApplications.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-5 text-center text-[13px] text-[#74817b]">
            Bạn chưa ứng tuyển công việc nào.
          </p>
        ) : (
          <div className="space-y-2">
            {myApplications.map((application) => (
              <div
                key={application.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[#e2e7e1] bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#203c37]">
                    {application.task?.title ?? "Công việc"}
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    Gửi lúc {formatDateTime(application.createdAt) ?? "—"}
                    {application.task?.address ? ` · ${application.task.address}` : ""}
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f6f2] text-[#74817b]">
                  {translateApplicationStatus(application.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
