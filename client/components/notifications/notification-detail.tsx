"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bell, ChevronRight, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { refreshNotificationUnreadCount } from "@/hooks/use-notifications";
import { formatDate } from "@/lib/utils";
import type { Notification } from "@/types/models";
import {
  notificationActionLabel,
  notificationBasePath,
  resolveNotificationTarget,
  type NotificationPortal,
} from "@/lib/notification-links";

interface NotificationDetailProps {
  portal: NotificationPortal;
}

/**
 * Trang nội dung một thông báo (dùng chung cho 4 portal).
 *
 * Khác với danh sách: ở đây luôn hiển thị đầy đủ nội dung, và nút hành động chỉ
 * hiện khi `resolveNotificationTarget` tìm được trang đích thật.
 */
export function NotificationDetail({ portal }: NotificationDetailProps) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const basePath = notificationBasePath(portal);
  const [notification, setNotification] = React.useState<Notification | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const id = params?.id;

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    apiClient.notifications
      .getById(id)
      .then(async (item) => {
        if (!active) return;
        setNotification(item);
        if (!item.isRead) {
          await apiClient.notifications.markAsRead(item.id).catch(() => undefined);
          // Trang chi tiết là một component khác với chuông topbar -> đồng bộ store.
          void refreshNotificationUnreadCount();
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không tìm thấy thông báo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const target = notification
    ? resolveNotificationTarget(portal, notification.type, notification.referenceId)
    : null;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => router.push(basePath)}
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
      >
        <ArrowLeft className="size-4" />
        Quay lại danh sách thông báo
      </button>

      {loading ? (
        <div className="flex items-center gap-2 rounded-[12px] border border-[#e2e7e1] bg-white p-8 text-sm text-[#74817b]">
          <Loader2 className="size-4 animate-spin" /> Đang tải thông báo...
        </div>
      ) : error || !notification ? (
        <div className="rounded-[12px] border border-[#f6cbc1] bg-[#fbeae6] p-6 text-sm text-[#a4422c]">
          {error ?? "Không tìm thấy thông báo."}
        </div>
      ) : (
        <article className="space-y-5 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#eaf2ed] text-[#15594f]">
              <Bell className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#74817b]">
                Thông báo hệ thống
              </p>
              <h1 className="mt-1 text-[22px] font-semibold text-[#203c37]">{notification.title}</h1>
              <p className="mt-1 text-[12px] text-[#74817b]">
                {formatDate(notification.createdAt, "datetime")}
              </p>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#3f4f49]">
            {notification.content}
          </p>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#e2e7e1] pt-5">
            <Link
              href={basePath}
              className="rounded-[8px] border border-[#d9e3dc] px-4 py-2 text-[13px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
            >
              Về danh sách
            </Link>
            {target && (
              <Link
                href={target}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42]"
              >
                {notificationActionLabel(notification.type)}
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
