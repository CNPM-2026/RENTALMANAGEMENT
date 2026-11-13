"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  FileText,
  MessageSquare,
  Receipt,
  Scale,
  Star,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import {
  notificationBasePath,
  resolveNotificationTarget,
  type NotificationPortal,
} from "@/lib/notification-links";
import type { Notification, NotificationType } from "@/types/models";

interface NotificationDropdownProps {
  portal: NotificationPortal;
  buttonClassName?: string;
  iconClassName?: string;
  badgeMode?: "dot" | "count";
  title?: string;
}

const VISUALS: Record<string, { icon: typeof Bell; className: string }> = {
  POST_APPROVED: { icon: CheckCircle2, className: "bg-[#eaf2ed] text-[#15594f]" },
  POST_REJECTED: { icon: XCircle, className: "bg-[#fbeae6] text-[#a4422c]" },
  MESSAGE: { icon: MessageSquare, className: "bg-[#e0f2fe] text-[#075985]" },
  APPOINTMENT: { icon: CalendarDays, className: "bg-[#fbf1dc] text-[#9a6a12]" },
  INVOICE: { icon: Receipt, className: "bg-[#fef3c7] text-[#92400e]" },
  CONTRACT: { icon: FileText, className: "bg-[#eaf2ed] text-[#15594f]" },
  OCCUPANCY: { icon: Users, className: "bg-[#f2ede3] text-[#6b5a3e]" },
  TASK: { icon: Wrench, className: "bg-[#eaf2ed] text-[#15594f]" },
  OFFER: { icon: Receipt, className: "bg-[#fbf1dc] text-[#9a6a12]" },
  REVIEW: { icon: Star, className: "bg-[#fef3c7] text-[#92400e]" },
  DISPUTE: { icon: Scale, className: "bg-[#fbeae6] text-[#a4422c]" },
  COMMISSION: { icon: Receipt, className: "bg-[#eaf2ed] text-[#15594f]" },
  SYSTEM: { icon: Bell, className: "bg-[#f7f6f2] text-[#74817b]" },
};

function visualOf(type: NotificationType) {
  return VISUALS[type] ?? VISUALS.SYSTEM;
}

function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString("vi-VN");
}

/**
 * Dropdown thông báo dùng chung cho 4 portal.
 * Dữ liệu lấy từ server và cập nhật realtime qua kênh notification hiện có.
 */
export function NotificationDropdown({
  portal,
  buttonClassName = "relative size-9 rounded-full flex items-center justify-center text-[#74817b] hover:text-[#15594f] hover:bg-[#f7f6f2] transition-colors",
  iconClassName = "size-4.5",
  badgeMode = "count",
  title = "Thông báo",
}: NotificationDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const basePath = notificationBasePath(portal);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch {
      // Lần mở sau sẽ đồng bộ lại từ server.
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
      >
        <Bell className={iconClassName} />
        {unreadCount > 0 && badgeMode === "dot" && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#991b1b] ring-2 ring-white" />
        )}
        {unreadCount > 0 && badgeMode === "count" && (
          <span className="absolute -top-1 -right-1 min-w-[17px] rounded-full bg-[#991b1b] px-1 text-center text-[10px] font-bold leading-[17px] text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-[#e2e7e1] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#e2e7e1] px-4 py-3">
            <div>
              <p className="text-[14px] font-bold text-[#203c37]">Thông báo</p>
              <p className="text-[11px] text-[#74817b]">
                {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Bạn đã đọc tất cả"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15594f] hover:underline disabled:cursor-not-allowed disabled:text-[#a8b3ae]"
            >
              <CheckCheck className="size-3.5" /> Đọc tất cả
            </button>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto size-8 text-[#c3cbc7]" />
                <p className="mt-2 text-[13px] font-medium text-[#203c37]">Chưa có thông báo</p>
                <p className="mt-1 text-[11px] text-[#74817b]">Hoạt động mới sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              notifications.slice(0, 8).map((notification: Notification) => {
                const visual = visualOf(notification.type);
                const Icon = visual.icon;
                const target = resolveNotificationTarget(
                  portal,
                  notification.type,
                  notification.referenceId,
                ) ?? `${basePath}/${notification.id}`;
                return (
                  <Link
                    key={notification.id}
                    href={target}
                    onClick={() => {
                      setOpen(false);
                      if (!notification.isRead) void markAsRead(notification.id);
                    }}
                    className={`flex gap-3 border-b border-[#f1f3f2] px-4 py-3 transition-colors hover:bg-[#f7faf8] ${
                      notification.isRead ? "bg-white" : "bg-[#fbfdfc]"
                    }`}
                  >
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${visual.className}`}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2">
                        <span className="line-clamp-1 flex-1 text-[13px] font-semibold text-[#203c37]">
                          {notification.title}
                        </span>
                        {!notification.isRead && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#15594f]" />}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[#74817b]">
                        {notification.content}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#9aa5a0]">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>

          <Link
            href={basePath}
            onClick={() => setOpen(false)}
            className="block bg-[#f7faf8] px-4 py-2.5 text-center text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}

