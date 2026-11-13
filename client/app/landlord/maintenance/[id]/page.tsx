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
  User,
  Wrench,
} from "lucide-react";
import { apiClient, resolveMediaUrl } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
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
 * CHI TIẾT SỰ CỐ — phía chủ trọ.
 *
 * Trang danh sách giữ các thao tác tiếp nhận/tạo việc; trang này là bản đọc đầy
 * đủ (mô tả, ảnh có token, khách thuê, công việc đã tạo) để mở từ thông báo hoặc
 * chia sẻ link nội bộ. Quyền đọc do server lọc theo `landlordId` của token.
 */
export default function LandlordMaintenanceDetailPage() {
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
          onClick={() => router.push("/landlord/maintenance")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
        >
          <ArrowLeft className="size-4" /> Về danh sách sự cố
        </button>
      </div>
    );
  }

  const roomLabel = issue.room?.roomNumber ? `Phòng ${issue.room.roomNumber}` : "Chưa xác định phòng";
  const propertyLabel = issue.room?.property?.name ?? null;
  const isResolved = issue.status === "COMPLETED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.push("/landlord/maintenance")}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
        >
          <ArrowLeft className="size-4" /> Về danh sách sự cố
        </button>
        <Link
          href="/landlord/maintenance"
          className="text-[12px] font-semibold text-[#15594f] hover:underline"
        >
          Tiếp nhận / tạo việc cho thợ
        </Link>
      </div>

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
              <CheckCircle2 className="size-4" /> Đã xử lý xong
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
              <User className="size-3.5" /> Khách thuê
            </dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-[#203c37]">
              <Avatar
                src={issue.tenant?.avatarUrl}
                alt={issue.tenant?.fullName ?? "Khách thuê"}
                className="size-7 shrink-0 rounded-full border border-[#e2e7e1] object-cover"
              />
              <span>{issue.tenant?.fullName ?? "---"}</span>
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
          <p className="font-semibold">Phản hồi đã gửi khách thuê</p>
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
                    className="h-32 w-40 rounded-[8px] border border-[#e2e7e1] object-cover"
                  />
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#203c37]">
          <Wrench className="size-4" /> Công việc cần thợ
        </h2>
        {issue.tasks?.length ? (
          <ul className="mt-3 space-y-2">
            {issue.tasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#e2e7e1] bg-[#f8faf7] px-4 py-3 text-[13px]"
              >
                <Link
                  href={`/landlord/maintenance-tasks/${task.id}`}
                  className="font-medium text-[#15594f] hover:underline"
                >
                  {task.title}
                </Link>
                <span className="rounded-full bg-[#eaf2ed] px-2.5 py-1 text-[11px] font-semibold text-[#15594f]">
                  {translateTaskStatus(task.status)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-[#74817b]">
            Chưa có công việc nào được tạo từ sự cố này.{" "}
            <Link href="/landlord/maintenance" className="font-semibold text-[#15594f] hover:underline">
              Tiếp nhận và tạo việc cho thợ
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
