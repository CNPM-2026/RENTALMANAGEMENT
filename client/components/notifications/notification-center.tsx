"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
  XCircle,
  Scale,
  Star,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  refreshNotificationUnreadCount,
  setNotificationUnreadCount,
} from "@/hooks/use-notifications";
import { formatDate } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/models";
import {
  notificationActionLabel,
  notificationBasePath,
  resolveNotificationTarget,
  type NotificationPortal,
} from "@/lib/notification-links";

type FilterKey = "ALL" | "TASK" | "APPOINTMENT" | "INVOICE" | "CONTRACT" | "SYSTEM";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "TASK", label: "Công việc" },
  { key: "APPOINTMENT", label: "Lịch hẹn" },
  { key: "INVOICE", label: "Hoá đơn" },
  { key: "CONTRACT", label: "Hợp đồng" },
  { key: "SYSTEM", label: "Hệ thống" },
];

function visualOf(type: NotificationType) {
  switch (type) {
    case "POST_REJECTED":
      return { icon: XCircle, bg: "bg-[#fbeae6]", text: "text-[#a4422c]", badge: "Bị từ chối" };
    case "POST_APPROVED":
      return { icon: CheckCircle2, bg: "bg-[#eaf2ed]", text: "text-[#15594f]", badge: "Đã duyệt" };
    case "MESSAGE":
      return { icon: MessageSquare, bg: "bg-[#e0f2fe]", text: "text-[#075985]", badge: "Tin nhắn" };
    case "APPOINTMENT":
      return { icon: Calendar, bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]", badge: "Lịch xem phòng" };
    case "INVOICE":
      return { icon: Receipt, bg: "bg-[#fef3c7]", text: "text-[#92400e]", badge: "Hoá đơn" };
    case "CONTRACT":
      return { icon: FileText, bg: "bg-[#eaf2ed]", text: "text-[#15594f]", badge: "Hợp đồng" };
    case "OCCUPANCY":
      return { icon: Users, bg: "bg-[#f2ede3]", text: "text-[#6b5a3e]", badge: "Số người ở" };
    case "TASK":
      return { icon: Wrench, bg: "bg-[#eaf2ed]", text: "text-[#15594f]", badge: "Công việc" };
    case "OFFER":
      return { icon: Receipt, bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]", badge: "Thương lượng giá" };
    case "REVIEW":
      return { icon: Star, bg: "bg-[#fef3c7]", text: "text-[#92400e]", badge: "Đánh giá" };
    case "DISPUTE":
      return { icon: Scale, bg: "bg-[#fbeae6]", text: "text-[#a4422c]", badge: "Tranh chấp" };
    case "COMMISSION":
      return { icon: Receipt, bg: "bg-[#eaf2ed]", text: "text-[#15594f]", badge: "Hoa hồng" };
    default:
      return { icon: Bell, bg: "bg-[#f7f6f2]", text: "text-[#74817b]", badge: "Hệ thống" };
  }
}

function matchesFilter(item: Notification, filter: FilterKey) {
  if (filter === "ALL") return true;
  if (filter === "TASK") return ["TASK", "OFFER", "REVIEW", "DISPUTE"].includes(item.type);
  if (filter === "SYSTEM") {
    return ["SYSTEM", "POST_APPROVED", "POST_REJECTED", "COMMISSION", "OCCUPANCY"].includes(item.type);
  }
  return item.type === filter;
}

interface NotificationCenterProps {
  portal: NotificationPortal;
  title?: string;
  subtitle?: string;
}

/**
 * Trang thông báo dùng chung cho cả 4 portal (admin / landlord / tenant / staff).
 *
 * Mỗi thông báo có HAI hành động tách biệt:
 *  - "Chi tiết thông báo" → trang nội dung của chính thông báo;
 *  - "Xem chi tiết" → thẳng tới đối tượng liên quan (công việc, hoá đơn...),
 *    tính bằng `resolveNotificationTarget` để không bao giờ trỏ 404.
 */
export function NotificationCenter({ portal, title, subtitle }: NotificationCenterProps) {
  const router = useRouter();
  const basePath = notificationBasePath(portal);
  const [items, setItems] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterKey>("ALL");
  const [markingAll, setMarkingAll] = React.useState(false);

  const load = React.useCallback(() => {
    // Trạng thái tải ban đầu là `true`; không setState đồng bộ trong effect.
    apiClient.notifications
      .getMy()
      .then((data) => {
        setItems(data ?? []);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không tải được thông báo."),
      )
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    try {
      await apiClient.notifications.markAsRead(id);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
      // Đọc lại số chưa đọc từ server để MỌI chuông đang mount cùng giảm.
      void refreshNotificationUnreadCount();
    } catch {
      // Lỗi đánh dấu chỉ ảnh hưởng badge — không chặn điều hướng.
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await apiClient.notifications.markAllAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setNotificationUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đánh dấu được tất cả thông báo.");
    } finally {
      setMarkingAll(false);
    }
  };

  const filtered = items.filter((item) => matchesFilter(item, filter));
  const unreadCount = items.filter((item) => !item.isRead).length;

  const openTarget = async (item: Notification) => {
    await markRead(item.id);
    const target = resolveNotificationTarget(portal, item.type, item.referenceId);
    router.push(target ?? `${basePath}/${item.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[12px] text-[#74817b]">Trung tâm thông báo</p>
          <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">
            {title ?? "Thông báo"}
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-[#991b1b] px-2 py-0.5 align-middle text-[11px] font-bold text-white">
                {unreadCount} chưa đọc
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-[14px] text-[#74817b]">
            {subtitle ?? "Thông báo về công việc, lịch hẹn, hoá đơn và hệ thống."}
          </p>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={markingAll || unreadCount === 0}
          className="inline-flex items-center gap-2 self-start rounded-[8px] border border-[#d9e3dc] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#15594f] transition hover:bg-[#eaf2ed] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="size-4" />
          {markingAll ? "Đang xử lý..." : "Đánh dấu tất cả đã đọc"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
              filter === entry.key
                ? "bg-[#15594f] text-white"
                : "border border-[#e2e7e1] bg-white text-[#74817b] hover:bg-[#f7f6f2]"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#f6cbc1] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="divide-y divide-[#e2e7e1] overflow-hidden rounded-[12px] border border-[#e2e7e1] bg-white shadow-xs">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-[#74817b]">Đang tải thông báo...</p>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f2ede3] text-[#74817b]">
              <Bell className="size-7" />
            </div>
            <p className="mt-3 font-semibold text-[#203c37]">Không có thông báo nào</p>
            <p className="mt-1 text-sm text-[#74817b]">
              Thông báo mới sẽ xuất hiện tại đây ngay khi có hoạt động liên quan.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const visual = visualOf(item.type);
            const VisualIcon = visual.icon;
            const target = resolveNotificationTarget(portal, item.type, item.referenceId);
            return (
              <div
                key={item.id}
                onClick={() => void openTarget(item)}
                className={`flex cursor-pointer items-start gap-4 p-5 transition-colors hover:bg-[#f7f6f2]/80 ${
                  !item.isRead ? "bg-[#eaf2ed]/25" : ""
                }`}
              >
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-full ${visual.bg} ${visual.text}`}>
                  <VisualIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${visual.bg} ${visual.text}`}>
                      {visual.badge}
                    </span>
                    <h2 className={`text-[15px] ${!item.isRead ? "font-bold" : "font-semibold"} text-[#203c37]`}>
                      {item.title}
                    </h2>
                    {!item.isRead && <span className="size-2 rounded-full bg-[#15594f]" />}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#5c6964]">{item.content}</p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#74817b]">
                    <span>{formatDate(item.createdAt, "datetime")}</span>
                    <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
                      <Link
                        href={`${basePath}/${item.id}`}
                        className="text-xs text-[#74817b] hover:text-[#203c37] hover:underline"
                      >
                        Chi tiết thông báo
                      </Link>
                      <Link
                        href={target ?? `${basePath}/${item.id}`}
                        onClick={() => void markRead(item.id)}
                        className="inline-flex items-center gap-1 font-semibold text-[#15594f] hover:underline"
                      >
                        <span>{notificationActionLabel(item.type)}</span>
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

