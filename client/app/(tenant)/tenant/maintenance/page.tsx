"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, Trash2, Wrench } from "lucide-react";
import { apiClient, ApiError, resolveMediaUrl } from "@/lib/api";
import {
  SERVICE_CATEGORY_OPTIONS,
  translateServiceCategory,
  translateStatus,
  translateTaskStatus,
  translateTriageStatus,
  translateUrgency,
} from "@/lib/labels";
import type {
  Contract,
  MaintenancePriority,
  MaintenanceRequest,
  ServiceCategory,
} from "@/types/models";

/**
 * BÁO CÁO SỰ CỐ CỦA KHÁCH THUÊ — bước 1 của luồng Batch 2.
 *
 * Trang này CHỈ tạo báo cáo. Khách thuê không thể tự đăng việc cho thợ: server
 * chỉ cho phép chủ trọ của cơ sở chuyển báo cáo thành công việc marketplace
 * (`POST /maintenance/:id/tasks`). Quan hệ thuê được server kiểm tra lại bằng
 * hợp đồng đang hoạt động — UI chỉ lọc ra các phòng như vậy cho dễ chọn.
 */
const EMPTY_FORM = {
  roomId: "",
  category: "GENERAL_MAINTENANCE" as ServiceCategory,
  title: "",
  description: "",
  priority: "MEDIUM" as MaintenancePriority,
};

const MAX_IMAGES = 5;

export default function TenantMaintenancePage() {
  const [items, setItems] = React.useState<MaintenanceRequest[]>([]);
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [images, setImages] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadItems = React.useCallback(() => {
    apiClient.maintenance.getMine().then(setItems).catch(() => setItems([]));
  }, []);

  React.useEffect(() => {
    loadItems();
    apiClient.contracts
      .getMyContracts()
      .then((rows) => setContracts((rows ?? []).filter((contract) => contract.status === "ACTIVE")))
      .catch(() => setContracts([]));
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

  const addImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES));
    event.target.value = "";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!form.roomId) {
      setError("Vui lòng chọn phòng đang thuê gặp sự cố.");
      return;
    }
    setIsSubmitting(true);
    try {
      // multipart: ảnh hiện trạng là tuỳ chọn, server tự upload và trả URL.
      const payload = new FormData();
      payload.append("roomId", form.roomId);
      payload.append("title", form.title.trim());
      payload.append("description", form.description.trim());
      payload.append("category", form.category);
      payload.append("priority", form.priority);
      images.forEach((image) => payload.append("images", image));

      const created = await apiClient.maintenance.create(payload);
      setItems((current) => [created, ...current]);
      setForm(EMPTY_FORM);
      setImages([]);
      setMessage("Đã gửi báo cáo sự cố. Chủ trọ sẽ xem xét và phản hồi.");
    } catch (err) {
      handleError(err, "Không gửi được báo cáo sự cố.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Hỗ trợ</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo sự cố phòng trọ</h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Gửi sự cố kèm ảnh hiện trạng cho chủ trọ. Bạn chỉ có thể báo sự cố cho phòng đang có hợp
          đồng thuê còn hiệu lực.
        </p>
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

      <form onSubmit={submit} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-[#15594f]">
          <Wrench className="size-4" />
          <h2 className="text-[15px] font-semibold text-[#203c37]">Sự cố mới</h2>
        </div>

        {contracts.length === 0 ? (
          <p className="text-[13px] text-[#74817b]">
            Bạn chưa có hợp đồng thuê đang hoạt động nào, nên chưa thể báo sự cố.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                required
                value={form.roomId}
                onChange={(event) => setForm({ ...form, roomId: event.target.value })}
                className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
              >
                <option value="">Chọn phòng đang thuê</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.roomId}>
                    Phòng {contract.room?.roomNumber ?? contract.roomId}
                    {contract.room?.property?.name ? ` — ${contract.room.property.name}` : ""}
                  </option>
                ))}
              </select>
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
            </div>

            <input
              required
              minLength={3}
              maxLength={200}
              placeholder="Tiêu đề sự cố (ví dụ: Rò rỉ nước dưới chậu rửa)"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />
            <textarea
              required
              minLength={10}
              maxLength={10000}
              rows={4}
              placeholder="Mô tả chi tiết hiện trạng, thời điểm phát hiện, mức độ ảnh hưởng..."
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full rounded border border-[#e2e7e1] p-2 text-sm"
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value as MaintenancePriority })}
                className="rounded border border-[#e2e7e1] p-2 text-sm"
              >
                <option value="LOW">{translateUrgency("LOW")}</option>
                <option value="MEDIUM">{translateUrgency("MEDIUM")}</option>
                <option value="HIGH">{translateUrgency("HIGH")}</option>
              </select>

              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] border border-[#e2e7e1] text-[13px] text-[#15594f] cursor-pointer hover:bg-[#f7f6f2]">
                <Camera className="size-4" />
                <span>
                  Ảnh hiện trạng ({images.length}/{MAX_IMAGES})
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={addImages}
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="ml-auto px-4 py-2 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? "Đang gửi..." : "Gửi báo cáo"}
              </button>
            </div>

            {images.length > 0 && (
              <ul className="space-y-1">
                {images.map((image, index) => (
                  <li
                    key={`${image.name}-${index}`}
                    className="flex items-center justify-between gap-2 text-[12px] text-[#74817b]"
                  >
                    <span className="truncate">{image.name}</span>
                    <button
                      type="button"
                      onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                      className="inline-flex items-center gap-1 text-[#a4422c] cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Bỏ</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </form>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-[#203c37]">Báo cáo của tôi</h2>
        {items.length === 0 ? (
          <p className="text-[13px] text-[#74817b]">Chưa có báo cáo nào.</p>
        ) : (
          items.map((item) => {
            const linkedTask = item.tasks?.[0] ?? null;
            const triageClass =
              item.triageStatus === "REVIEWED"
                ? "bg-[#eaf2ed] text-[#15594f]"
                : item.triageStatus === "NEEDS_INFO"
                ? "bg-[#fbf1dc] text-[#9a6a12]"
                : item.triageStatus === "REJECTED"
                ? "bg-[#fbeae6] text-[#a4422c]"
                : "bg-[#f7f6f2] text-[#74817b]";

            return (
              <article
                key={item.id}
                className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/tenant/maintenance/${item.id}`}
                    className="font-semibold text-[15px] text-[#203c37] hover:text-[#15594f] hover:underline"
                  >
                    {item.title}
                  </Link>
                  <span className="text-[11px] font-semibold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded-full">
                    Phòng {item.room?.roomNumber ?? "---"}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${triageClass}`}>
                    {translateTriageStatus(item.triageStatus)}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f7f6f2] text-[#74817b]">
                    {translateStatus(item.status)}
                  </span>
                </div>

                <p className="text-[13px] text-[#74817b]">{item.description}</p>

                <p className="text-[12px] text-[#74817b]">
                  {item.category ? translateServiceCategory(item.category) : "Chưa phân loại"} •{" "}
                  {translateUrgency(item.priority)}
                </p>

                {item.triageNote && (
                  <p className="text-[12px] text-[#203c37] bg-[#f7f6f2] rounded-[8px] px-3 py-2">
                    Phản hồi từ chủ trọ: {item.triageNote}
                  </p>
                )}

                {item.tasks?.length ? (
                  <p className="text-[12px] font-medium text-[#15594f]">
                    Đã chuyển thành việc cần thợ — {translateTaskStatus(linkedTask?.status)}
                  </p>
                ) : null}

                {item.images?.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {item.images.map((image) => (
                      <li key={image.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMediaUrl(image.imageUrl) ?? image.imageUrl}
                          alt="Ảnh hiện trạng"
                          className="size-20 rounded-[8px] object-cover border border-[#e2e7e1]"
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#74817b]">
                    Gửi lúc: {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </p>
                  <Link
                    href={`/tenant/maintenance/${item.id}`}
                    className="text-[12px] font-semibold text-[#15594f] hover:underline"
                  >
                    Xem chi tiết
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
