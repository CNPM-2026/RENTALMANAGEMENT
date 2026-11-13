"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  DoorOpen,
  Eye,
  ImageIcon,
  Send,
  Wrench,
  XCircle,
} from "lucide-react";
import { apiClient, ApiError, resolveMediaUrl } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import {
  SERVICE_CATEGORY_OPTIONS,
  TRIAGE_STATUS_OPTIONS,
  translateServiceCategory,
  translateStatus,
  translateTaskStatus,
  translateTriageStatus,
  translateUrgency,
} from "@/lib/labels";
import type {
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceTriageStatus,
  ServiceCategory,
} from "@/types/models";

/**
 * SỰ CỐ KHÁCH THUÊ BÁO CÁO — phía chủ trọ (Batch 2, điều chỉnh luồng).
 *
 * Luồng đúng: khách thuê báo sự cố → chủ trọ TIẾP NHẬN (đã xem xét / cần bổ
 * sung thông tin / từ chối) → chủ trọ TẠO CÔNG VIỆC CẦN THỢ từ chính sự cố đó.
 * Chủ trọ KHÔNG tạo phiếu sự cố (đó là quyền của khách thuê) và KHÔNG tự đăng
 * việc ngoài sự cố ở trang này — việc cần thợ luôn bắt nguồn từ báo cáo.
 *
 * Toàn bộ kiểm tra quyền sở hữu, chống đăng trùng và prefill nằm ở server; UI
 * chỉ hiển thị và gọi API.
 */
const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  category: "GENERAL_MAINTENANCE" as ServiceCategory,
  urgency: "MEDIUM" as MaintenancePriority,
  budgetMin: "",
  budgetMax: "",
  preferredStartAt: "",
  preferredEndAt: "",
  additionalInstructions: "",
};

/** Rỗng -> null (KHÔNG phải 0); chấp nhận dấu phẩy thập phân kiểu Việt Nam. */
function parseOptionalNumber(raw: string, label: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`${label} không hợp lệ: "${trimmed}" không phải là số.`);
  return value;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("vi-VN");
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateTimeAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalDateTimeInput(date);
}

function triageClass(status: MaintenanceTriageStatus) {
  if (status === "REVIEWED") return "bg-[#eaf2ed] text-[#15594f]";
  if (status === "NEEDS_INFO") return "bg-[#fbf1dc] text-[#9a6a12]";
  if (status === "REJECTED") return "bg-[#fbeae6] text-[#a4422c]";
  return "bg-[#f7f6f2] text-[#74817b]";
}

export default function LandlordMaintenancePage() {
  const [items, setItems] = React.useState<MaintenanceRequest[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  /** Hộp thoại tiếp nhận: trạng thái + lý do (bắt buộc với NEEDS_INFO/REJECTED). */
  const [triage, setTriage] = React.useState<{ issueId: string; status: MaintenanceTriageStatus } | null>(
    null,
  );
  const [triageNote, setTriageNote] = React.useState("");

  /** Hộp thoại chuyển sự cố thành công việc cần thợ (prefill từ sự cố). */
  const [convertTarget, setConvertTarget] = React.useState<MaintenanceRequest | null>(null);
  const [form, setForm] = React.useState(EMPTY_TASK_FORM);
  const [skills, setSkills] = React.useState<ServiceCategory[]>([]);
  const [images, setImages] = React.useState<File[]>([]);
  const [minScheduleAt, setMinScheduleAt] = React.useState("");
  const [maxScheduleAt, setMaxScheduleAt] = React.useState("");

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMinScheduleAt(toLocalDateTimeInput(new Date()));
      setMaxScheduleAt(dateTimeAfterDays(365));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const loadItems = React.useCallback(() => {
    apiClient.maintenance.getMine().then(setItems).catch(() => setItems([]));
  }, []);

  React.useEffect(() => {
    loadItems();
  }, [loadItems]);

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

  /** Sự cố đã có công việc đang mở/đã giao chưa (server vẫn là nơi chặn cuối). */
  const activeTaskOf = (issue: MaintenanceRequest) =>
    issue.tasks?.find((task) => task.status === "OPEN" || task.status === "ASSIGNED") ?? null;

  const submitTriage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!triage) return;
    setError(null);
    setMessage(null);
    const needsNote = triage.status === "NEEDS_INFO" || triage.status === "REJECTED";
    if (needsNote && triageNote.trim().length < 3) {
      setError("Vui lòng nêu lý do (ít nhất 3 ký tự) để khách thuê biết cần làm gì.");
      return;
    }
    setBusyId(triage.issueId);
    try {
      const updated = await apiClient.maintenance.updateTriage(triage.issueId, {
        triageStatus: triage.status,
        triageNote: triageNote.trim() ? triageNote.trim() : null,
      });
      setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setMessage("Đã cập nhật trạng thái tiếp nhận sự cố.");
      setTriage(null);
      setTriageNote("");
    } catch (err) {
      handleError(err, "Không cập nhật được trạng thái tiếp nhận.");
    } finally {
      setBusyId(null);
    }
  };

  const markCompleted = async (id: string) => {
    setError(null);
    setMessage(null);
    setBusyId(id);
    try {
      const updated = await apiClient.maintenance.updateStatus(id, "COMPLETED");
      setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setMessage("Đã đánh dấu sự cố là xử lý xong.");
    } catch (err) {
      handleError(err, "Không cập nhật được trạng thái xử lý.");
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Mở form chuyển đổi: prefill tiêu đề/mô tả/danh mục/mức khẩn cấp từ sự cố.
   * Cơ sở, phòng, địa chỉ và ảnh hiện trạng do SERVER gắn từ chính sự cố nên form
   * không có các trường đó (không thể đăng việc ở nơi khác chỗ khách báo).
   */
  const openConvert = (issue: MaintenanceRequest) => {
    setError(null);
    setMessage(null);
    setConvertTarget(issue);
    setForm({
      ...EMPTY_TASK_FORM,
      title: issue.title,
      description: issue.description,
      category: issue.category ?? "GENERAL_MAINTENANCE",
      urgency: issue.priority,
    });
    setSkills(issue.category ? [issue.category] : []);
    setImages([]);
  };

  const toggleSkill = (category: ServiceCategory) =>
    setSkills((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );

  const submitConvert = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!convertTarget) return;
    setError(null);
    setMessage(null);
    try {
      const budgetMin = parseOptionalNumber(form.budgetMin, "Ngân sách tối thiểu");
      const budgetMax = parseOptionalNumber(form.budgetMax, "Ngân sách tối đa");
      if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
        throw new Error("Ngân sách tối đa phải lớn hơn hoặc bằng ngân sách tối thiểu.");
      }

      const payload = new FormData();
      // Chỉ gửi tiêu đề/mô tả khi chủ trọ THỰC SỰ sửa: nếu không gửi, server dùng
      // nguyên văn báo cáo của khách thuê (báo cáo có thể ngắn hơn giới hạn của
      // form công việc, và ta không muốn chặn việc chỉ vì lý do hình thức).
      const title = form.title.trim();
      const description = form.description.trim();
      if (title !== convertTarget.title.trim()) payload.append("title", title);
      if (description !== convertTarget.description.trim()) payload.append("description", description);
      payload.append("category", form.category);
      payload.append("urgency", form.urgency);
      // Mảng đi qua multipart dưới dạng JSON string — server chấp nhận cả
      // mảng/JSON/CSV và luôn dedupe trước khi ghi.
      if (skills.length) payload.append("skills", JSON.stringify(skills));
      if (budgetMin !== null) payload.append("budgetMin", String(budgetMin));
      if (budgetMax !== null) payload.append("budgetMax", String(budgetMax));
      if (form.preferredStartAt) payload.append("preferredStartAt", new Date(form.preferredStartAt).toISOString());
      if (form.preferredEndAt) payload.append("preferredEndAt", new Date(form.preferredEndAt).toISOString());
      if (form.additionalInstructions.trim()) {
        payload.append("additionalInstructions", form.additionalInstructions.trim());
      }
      images.forEach((image) => payload.append("images", image));

      setBusyId(convertTarget.id);
      await apiClient.maintenance.createTaskFromIssue(convertTarget.id, payload);
      setConvertTarget(null);
      setSkills([]);
      setImages([]);
      // Nạp lại để thấy ngay liên kết công việc vừa tạo (server trả về trong `tasks`).
      loadItems();
      setMessage("Đã tạo công việc cho thợ từ sự cố này.");
    } catch (err) {
      handleError(err, "Không tạo được công việc từ sự cố.");
    } finally {
      setBusyId(null);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Sửa chữa &amp; Bảo trì</h1>
          <p className="text-[14px] text-[#74817b] mt-1">
            Tiếp nhận sự cố khách thuê báo cáo, sau đó chuyển thành công việc để thợ đã xác minh ứng
            tuyển ở trang <span className="font-medium text-[#15594f]">Chợ công việc bảo trì</span>.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#eaf2ed] text-[12px] font-medium text-[#15594f] self-start">
          <Wrench className="size-4" />
          <span>{items.length} báo cáo</span>
        </div>
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

      {items.length === 0 ? (
        <p className="text-[13px] text-[#74817b]">
          Chưa có báo cáo sự cố nào từ khách thuê. Khách thuê gửi báo cáo ở mục “Báo cáo sự cố”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((issue) => {
            const activeTask = activeTaskOf(issue);
            const latestTask = issue.tasks?.[0] ?? null;
            const isBusy = busyId === issue.id;

            return (
              <div
                key={issue.id}
                className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/landlord/maintenance/${issue.id}`}
                    className="font-bold text-[16px] text-[#203c37] hover:text-[#15594f] hover:underline"
                  >
                    {issue.title}
                  </Link>
                  <span className="text-[12px] font-semibold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <DoorOpen className="size-3" />
                    Phòng {issue.room?.roomNumber ?? "---"}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${triageClass(issue.triageStatus)}`}
                  >
                    {translateTriageStatus(issue.triageStatus)}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f6f2] text-[#74817b]">
                    {translateStatus(issue.status)}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      issue.priority === "HIGH"
                        ? "bg-[#fbeae6] text-[#a4422c]"
                        : issue.priority === "MEDIUM"
                        ? "bg-[#fbf1dc] text-[#9a6a12]"
                        : "bg-[#f7f6f2] text-[#74817b]"
                    }`}
                  >
                    {translateUrgency(issue.priority)}
                  </span>
                </div>

                {issue.room?.property?.name && (
                  <p className="text-[12px] text-[#74817b]">
                    {issue.room.property.name} — {issue.room.property.address}
                  </p>
                )}

                <p className="text-[13px] text-[#74817b]">{issue.description}</p>

                <div className="flex items-center gap-2 text-[12px] text-[#74817b]">
                  <Avatar
                    src={issue.tenant?.avatarUrl}
                    alt={issue.tenant?.fullName ?? "Khách thuê"}
                    className="size-6 shrink-0 rounded-full border border-[#e2e7e1] object-cover"
                  />
                  <span>
                    Khách thuê: {issue.tenant?.fullName ?? "---"}
                    {issue.category ? ` • ${translateServiceCategory(issue.category)}` : ""}
                  </span>
                </div>

                {issue.triageNote && (
                  <p className="text-[12px] text-[#203c37] bg-[#f7f6f2] rounded-[8px] px-3 py-2">
                    Lý do đã gửi khách thuê: {issue.triageNote}
                  </p>
                )}

                {issue.images?.length ? (
                  <div className="space-y-1">
                    <p className="text-[12px] font-medium text-[#203c37] flex items-center gap-1">
                      <ImageIcon className="size-3.5" />
                      Ảnh hiện trạng ({issue.images.length})
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {issue.images.map((image) => (
                        <li key={image.id}>
                          <a
                            href={resolveMediaUrl(image.imageUrl) ?? image.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveMediaUrl(image.imageUrl) ?? image.imageUrl}
                              alt="Ảnh hiện trạng"
                              className="size-20 rounded-[8px] object-cover border border-[#e2e7e1]"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {latestTask && (
                  <p className="text-[12px] font-medium text-[#15594f]">
                    Việc cần thợ: {latestTask.title} — {translateTaskStatus(latestTask.status)}
                  </p>
                )}
                {issue.tasks?.length && !activeTask ? (
                  <p className="text-[12px] text-[#74817b]">
                    Công việc trước đã huỷ — có thể tạo lại công việc cho sự cố này.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setTriageNote(issue.triageNote ?? "");
                      setTriage({ issueId: issue.id, status: "REVIEWED" });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-medium text-[#15594f] hover:bg-[#f7f6f2] disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Đã xem xét</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setTriageNote(issue.triageNote ?? "");
                      setTriage({ issueId: issue.id, status: "NEEDS_INFO" });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-medium text-[#9a6a12] hover:bg-[#fbf1dc] disabled:opacity-60 cursor-pointer"
                  >
                    <Clock className="size-3.5" />
                    <span>Cần bổ sung</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setTriageNote(issue.triageNote ?? "");
                      setTriage({ issueId: issue.id, status: "REJECTED" });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-medium text-[#a4422c] hover:bg-[#fbeae6] disabled:opacity-60 cursor-pointer"
                  >
                    <XCircle className="size-3.5" />
                    <span>Từ chối</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || Boolean(activeTask) || issue.triageStatus === "REJECTED"}
                    onClick={() => openConvert(issue)}
                    title={
                      activeTask
                        ? "Sự cố đã có công việc đang mở hoặc đã giao cho thợ"
                        : issue.triageStatus === "REJECTED"
                        ? "Sự cố đã bị từ chối"
                        : "Tạo công việc cho thợ từ sự cố này"
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-medium hover:bg-[#124b42] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>Tạo việc cho thợ</span>
                  </button>

                  {issue.status !== "COMPLETED" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => markCompleted(issue.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#cfe3d8] text-[12px] font-medium text-[#15594f] hover:bg-[#eaf2ed] disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Đánh dấu đã xử lý</span>
                    </button>
                  )}

                  <Link
                    href={`/landlord/maintenance/${issue.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#e2e7e1] text-[12px] font-medium text-[#203c37] hover:bg-[#f7f6f2]"
                  >
                    <Eye className="size-3.5" />
                    <span>Xem chi tiết</span>
                  </Link>
                </div>

                <p className="text-[11px] text-[#74817b]">
                  Ghi nhận lúc: {formatDateTime(issue.createdAt)}
                  {issue.triageUpdatedAt ? ` • Tiếp nhận: ${formatDateTime(issue.triageUpdatedAt)}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {triage && (
        <Modal
          isOpen
          onClose={() => setTriage(null)}
          title={`Tiếp nhận sự cố — ${
            TRIAGE_STATUS_OPTIONS.find((option) => option.value === triage.status)?.label ?? ""
          }`}
        >
          <form onSubmit={submitTriage} className="space-y-3">
            <p className="text-[12px] text-[#74817b]">
              {triage.status === "REVIEWED"
                ? "Xác nhận bạn đã xem xét báo cáo này. Có thể ghi chú thêm cho khách thuê."
                : triage.status === "NEEDS_INFO"
                ? "Nêu rõ thông tin cần bổ sung (ảnh, thời điểm, hiện trạng…) để khách thuê gửi lại."
                : "Nêu lý do từ chối để khách thuê hiểu và không gửi lại sai nội dung."}
            </p>
            <textarea
              rows={4}
              maxLength={2000}
              placeholder="Lý do / ghi chú gửi khách thuê"
              value={triageNote}
              onChange={(event) => setTriageNote(event.target.value)}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setTriage(null)}
                className="px-3 py-2 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#74817b]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={busyId === triage.issueId}
                className="px-3 py-2 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium disabled:opacity-60"
              >
                Xác nhận
              </button>
            </div>
          </form>
        </Modal>
      )}

      {convertTarget && (
        <Modal isOpen onClose={() => setConvertTarget(null)} title="Tạo việc cho thợ từ sự cố">
          <form onSubmit={submitConvert} className="space-y-3">
            <div className="rounded-[8px] bg-[#f7f6f2] px-3 py-2 text-[12px] text-[#74817b]">
              Nơi làm việc lấy từ sự cố: Phòng {convertTarget.room?.roomNumber ?? "---"}
              {convertTarget.room?.property?.name ? ` — ${convertTarget.room.property.name}` : ""}. Ảnh
              hiện trạng của khách thuê được tự động đính kèm vào công việc.
            </div>

            <input
              maxLength={200}
              placeholder="Tiêu đề công việc"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />
            <textarea
              rows={4}
              maxLength={5000}
              placeholder="Mô tả công việc cần làm (tối thiểu 20 ký tự nếu bạn sửa lại)"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as ServiceCategory })}
                className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
              >
                {SERVICE_CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {translateServiceCategory(category)}
                  </option>
                ))}
              </select>
              <select
                value={form.urgency}
                onChange={(event) => setForm({ ...form, urgency: event.target.value as MaintenancePriority })}
                className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
              >
                <option value="LOW">{translateUrgency("LOW")}</option>
                <option value="MEDIUM">{translateUrgency("MEDIUM")}</option>
                <option value="HIGH">{translateUrgency("HIGH")}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                inputMode="numeric"
                placeholder="Ngân sách tối thiểu (đ)"
                value={form.budgetMin}
                onChange={(event) => setForm({ ...form, budgetMin: event.target.value })}
                className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
              />
              <input
                inputMode="numeric"
                placeholder="Ngân sách tối đa (đ)"
                value={form.budgetMax}
                onChange={(event) => setForm({ ...form, budgetMax: event.target.value })}
                className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[12px] text-[#74817b] space-y-1 block">
                <span>Bắt đầu mong muốn</span>
                <input
                  type="datetime-local"
                  value={form.preferredStartAt}
                  min={minScheduleAt}
                  max={maxScheduleAt}
                  onChange={(event) => setForm({ ...form, preferredStartAt: event.target.value })}
                  className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
                />
              </label>
              <label className="text-[12px] text-[#74817b] space-y-1 block">
                <span>Kết thúc mong muốn</span>
                <input
                  type="datetime-local"
                  value={form.preferredEndAt}
                  min={form.preferredStartAt || minScheduleAt}
                  max={maxScheduleAt}
                  onChange={(event) => setForm({ ...form, preferredEndAt: event.target.value })}
                  className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
                />
              </label>
            </div>

            <textarea
              rows={2}
              maxLength={2000}
              placeholder="Hướng dẫn thêm cho thợ (giờ vào, liên hệ, lưu ý…)"
              value={form.additionalInstructions}
              onChange={(event) => setForm({ ...form, additionalInstructions: event.target.value })}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />

            <div className="space-y-1">
              <p className="text-[12px] font-medium text-[#203c37]">Kỹ năng cần có</p>
              <div className="flex flex-wrap gap-2">
                {SERVICE_CATEGORY_OPTIONS.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleSkill(category)}
                    className={`px-2.5 py-1 rounded-full text-[12px] border cursor-pointer ${
                      skills.includes(category)
                        ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]"
                        : "border-[#e2e7e1] text-[#74817b]"
                    }`}
                  >
                    {translateServiceCategory(category)}
                  </button>
                ))}
              </div>
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border border-[#e2e7e1] text-[13px] text-[#15594f] cursor-pointer">
              <Camera className="size-4" />
              <span>Thêm ảnh cho thợ ({images.length}/5)</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  const picked = Array.from(event.target.files ?? []);
                  setImages((current) => [...current, ...picked].slice(0, 5));
                  event.target.value = "";
                }}
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvertTarget(null)}
                className="px-3 py-2 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#74817b]"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={busyId === convertTarget.id}
                className="px-3 py-2 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] disabled:opacity-60"
              >
                {busyId === convertTarget.id ? "Đang đăng..." : "Đăng việc cho thợ"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
