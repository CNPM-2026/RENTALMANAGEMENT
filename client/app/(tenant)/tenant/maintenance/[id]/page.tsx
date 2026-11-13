"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ImageIcon,
  Loader2,
  MapPin,
  Wrench,
} from "lucide-react";
import { apiClient, resolveMediaUrl } from "@/lib/api";
import {
  translateServiceCategory,
  translateStatus,
  translateTaskStatus,
  translateTriageStatus,
  translateUrgency,
} from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { MaintenanceRequest } from "@/types/models";

/**
 * CHI TIẾT SỰ CỐ của khách thuê.
 *
 * Danh sách chỉ tóm tắt; trang này là nơi xem đầy đủ mô tả, ảnh hiện trạng (đường
 * dẫn có token do server cấp) và tiến độ xử lý: trạng thái tiếp nhận của chủ trọ,
 * phản hồi, cùng công việc thợ đã được tạo từ sự cố. Quyền đọc do server kiểm tra
 * (`tenantId` lấy từ token) — id trên URL không đủ để xem báo cáo người khác.
 */
function TenantMaintenanceDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const issueId = params?.id;

  const [issue, setIssue] = React.useState<MaintenanceRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!issueId) return;
    let active = true;
    apiClient.maintenance
      .getById(issueId)
      .then((item) => {
        if (active) setIssue(item);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Không tải được chi tiết sự cố.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[13px] text-[#74817b]">
        <Loader2 className="size-4 animate-spin" /> Đang tải chi tiết sự cố...
      </div>
    );
  }

  if (error || !issue) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-[8px] border border-[#f6cbc1] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error ?? "Không tìm thấy sự cố."}
        </div>
        <button
          type="button"
          onClick={() => router.push("/tenant/maintenance")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
        >
          <ArrowLeft className="size-4" /> Về danh sách báo cáo
        </button>
      </div>
    );
  }

  const roomLabel = issue.room?.roomNumber ? `Phòng ${issue.room.roomNumber}` : "Chưa xác định phòng";
  const propertyLabel = issue.room?.property?.name ?? issue.room?.property?.address ?? null;
  const latestTask = issue.tasks?.[0] ?? null;
  const isResolved = issue.status === "COMPLETED" || issue.triageStatus === "REVIEWED";

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push("/tenant/maintenance")}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
      >
        <ArrowLeft className="size-4" /> Về danh sách báo cáo
      </button>

      <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#74817b]">
              {issue.category ? translateServiceCategory(issue.category) : "Chưa phân loại"} · #
              {issue.id.slice(0, 8)}
            </p>
            <h1 className="mt-1 text-[24px] font-semibold text-[#203c37]">{issue.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 font-semibold text-[#15594f]">
                {translateTriageStatus(issue.triageStatus)}
              </span>
              <span className="rounded-full bg-[#f7f6f2] px-2.5 py-1 font-semibold text-[#74817b]">
                {translateStatus(issue.status)}
              </span>
              <span className="rounded-full bg-[#fbf1dc] px-2.5 py-1 font-semibold text-[#9a6a12]">
                {translateUrgency(issue.priority)}
              </span>
            </div>
          </div>
          {isResolved && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf2ed] px-3 py-1.5 text-[12px] font-semibold text-[#15594f]">
              <CheckCircle2 className="size-4" /> Đã được xử lý
            </span>
          )}
        </div>

        <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-[#3f4f49]">{issue.description}</p>

        <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-[#e2e7e1] pt-5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]">
              <MapPin className="size-3.5" /> Nơi xảy ra
            </dt>
            <dd className="mt-1 font-medium text-[#203c37]">
              {roomLabel}
              {propertyLabel ? ` · ${propertyLabel}` : ""}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]">
              <CalendarClock className="size-3.5" /> Gửi lúc
            </dt>
            <dd className="mt-1 font-medium text-[#203c37]">{formatDate(issue.createdAt, "datetime")}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]">
              <CalendarClock className="size-3.5" /> Cập nhật gần nhất
            </dt>
            <dd className="mt-1 font-medium text-[#203c37]">
              {issue.triageUpdatedAt
                ? formatDate(issue.triageUpdatedAt, "datetime")
                : formatDate(issue.updatedAt, "datetime")}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-[#74817b]">
              <CheckCircle2 className="size-3.5" /> Hoàn tất
            </dt>
            <dd className="mt-1 font-medium text-[#203c37]">
              {issue.resolvedAt ? formatDate(issue.resolvedAt, "datetime") : "Chưa hoàn tất"}
            </dd>
          </div>
        </dl>
      </section>

      {issue.triageNote && (
        <section className="rounded-[12px] border border-[#f4deb4] bg-[#fffaf0] p-5 text-[13px] text-[#9a6a12]">
          <p className="font-semibold">Phản hồi từ chủ trọ</p>
          <p className="mt-1 whitespace-pre-wrap">{issue.triageNote}</p>
        </section>
      )}

      {(issue.images?.length ?? 0) > 0 && (
        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#203c37]">
            <ImageIcon className="size-4" /> Ảnh hiện trạng ({issue.images?.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {issue.images?.map((image) => {
              const url = resolveMediaUrl(image.imageUrl) ?? image.imageUrl;
              return (
                <a key={image.id} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Ảnh hiện trạng sự cố"
                    className="h-28 w-36 rounded-[8px] border border-[#e2e7e1] object-cover"
                  />
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#203c37]">
          <Wrench className="size-4" /> Tiến độ xử lý
        </h2>
        {issue.tasks?.length ? (
          <ul className="mt-3 space-y-2">
            {issue.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#e2e7e1] bg-[#f8faf7] px-4 py-3 text-[13px]"
              >
                <span className="font-medium text-[#203c37]">{task.title}</span>
                <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 text-[11px] font-semibold text-[#15594f]">
                  {translateTaskStatus(task.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-[#74817b]">
            Chủ trọ chưa tạo công việc cho thợ. Bạn sẽ nhận thông báo khi sự cố được xử lý.
          </p>
        )}
        {latestTask && (
          <p className="mt-3 text-[12px] text-[#74817b]">
            Công việc gần nhất: {latestTask.title} · {translateTaskStatus(latestTask.status)}
          </p>
        )}
      </section>

      <p className="text-[12px] text-[#74817b]">
        Cần trao đổi thêm?{" "}
        <Link href="/tenant/messages" className="font-semibold text-[#15594f] hover:underline">
          Nhắn tin cho chủ trọ
        </Link>
        .
      </p>
    </div>
  );
}

export default function TenantMaintenanceDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[13px] text-[#74817b]">
          <Loader2 className="size-4 animate-spin" /> Đang tải chi tiết sự cố...
        </div>
      }
    >
      <TenantMaintenanceDetailContent />
    </React.Suspense>
  );
}
