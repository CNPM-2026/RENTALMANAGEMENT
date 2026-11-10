"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageSquare,
  Receipt,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Notification, NotificationType } from "@/types/models";
import { formatDate } from "@/lib/utils";

type FilterTab = "ALL" | "POST" | "APPOINTMENT" | "CONTRACT" | "INVOICE" | "MESSAGE";

function getNotificationVisual(type: NotificationType) {
  switch (type) {
    case "POST_REJECTED":
      return {
        icon: XCircle,
        bg: "bg-[#fbeae6]",
        text: "text-[#a4422c]",
        border: "border-[#f6cbc1]",
        badge: "Bị từ chối",
      };
    case "POST_APPROVED":
      return {
        icon: CheckCircle2,
        bg: "bg-[#eaf2ed]",
        text: "text-[#15594f]",
        border: "border-[#cce1d5]",
        badge: "Đã duyệt",
      };
    case "MESSAGE":
      return {
        icon: MessageSquare,
        bg: "bg-[#e0f2fe]",
        text: "text-[#075985]",
        border: "border-[#bae6fd]",
        badge: "Tin nhắn",
      };
    case "APPOINTMENT":
      return {
        icon: Calendar,
        bg: "bg-[#fbf1dc]",
        text: "text-[#9a6a12]",
        border: "border-[#f4deb4]",
        badge: "Lịch xem phòng",
      };
    case "INVOICE":
      return {
        icon: Receipt,
        bg: "bg-[#fef3c7]",
        text: "text-[#92400e]",
        border: "border-[#fde68a]",
        badge: "Hóa đơn",
      };
    case "CONTRACT":
      return {
        icon: FileText,
        bg: "bg-[#eaf2ed]",
        text: "text-[#15594f]",
        border: "border-[#cce1d5]",
        badge: "Hợp đồng",
      };
    default:
      return {
        icon: Bell,
        bg: "bg-[#f7f6f2]",
        text: "text-[#74817b]",
        border: "border-[#e2e7e1]",
        badge: "Hệ thống",
      };
  }
}

function getDirectTarget(type: NotificationType, referenceId?: string | null) {
  if (type === "POST_REJECTED" || type === "POST_APPROVED") {
    return referenceId ? `/landlord/listings/${referenceId}` : "/landlord/listings";
  }
  if (type === "MESSAGE") {
    return referenceId ? `/landlord/messages?conversation=${encodeURIComponent(referenceId)}` : "/landlord/messages";
  }
  if (type === "APPOINTMENT") return "/landlord/calendar";
  if (type === "INVOICE") return "/landlord/invoices";
  if (type === "CONTRACT") {
    return referenceId ? `/tenant/contracts/${referenceId}` : "/landlord/contracts";
  }
  return "/landlord/rental-requests";
}

export default function LandlordNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<FilterTab>("ALL");

  React.useEffect(() => {
    apiClient.notifications
      .getMy()
      .then(setItems)
      .catch(() => setError("Không tải được thông báo."))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    try {
      await apiClient.notifications.markAsRead(id);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } catch {
      setError("Không thể cập nhật trạng thái thông báo.");
    }
  }

  async function markAll() {
    try {
      await apiClient.notifications.markAllAsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      setError("Không thể đánh dấu tất cả thông báo.");
    }
  }

  const filteredItems = items.filter((item) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "POST") return item.type === "POST_REJECTED" || item.type === "POST_APPROVED";
    return item.type === activeTab;
  });

  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="mt-1 text-[28px] font-semibold text-[#203c37]">Trung tâm thông báo</h1>
          <p className="mt-1 text-[14px] text-[#74817b]">
            Theo dõi trạng thái duyệt bài đăng, lịch xem phòng, hợp đồng và hóa đơn mới.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAll}
            className="inline-flex items-center gap-2 rounded-[8px] border border-[#e2e7e1] bg-white px-4 py-2 text-[13px] font-semibold text-[#15594f] hover:bg-[#f7f6f2] transition-colors cursor-pointer self-start sm:self-auto"
          >
            <CheckCheck className="size-4" />
            <span>Đánh dấu tất cả đã đọc</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-sm text-[#a4422c]">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-[#e2e7e1] gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: "ALL", label: `Tất cả (${items.length})` },
          {
            key: "POST",
            label: `Tin đăng (${items.filter((i) => i.type === "POST_REJECTED" || i.type === "POST_APPROVED").length})`,
          },
          {
            key: "APPOINTMENT",
            label: `Lịch hẹn (${items.filter((i) => i.type === "APPOINTMENT").length})`,
          },
          {
            key: "CONTRACT",
            label: `Hợp đồng (${items.filter((i) => i.type === "CONTRACT").length})`,
          },
          {
            key: "INVOICE",
            label: `Hóa đơn (${items.filter((i) => i.type === "INVOICE").length})`,
          },
          {
            key: "MESSAGE",
            label: `Tin nhắn (${items.filter((i) => i.type === "MESSAGE").length})`,
          },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as FilterTab)}
              className={`pb-3 px-3 text-[14px] font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? "border-[#15594f] text-[#15594f] font-semibold"
                  : "border-transparent text-[#74817b] hover:text-[#203c37]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      <div className="overflow-hidden rounded-[12px] border border-[#e2e7e1] bg-white shadow-sm divide-y divide-[#eef3ef]">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#74817b]">Đang tải thông báo...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-14 text-center">
            <Bell className="mx-auto size-10 text-[#9bb5a8]" />
            <p className="mt-3 font-semibold text-[#203c37]">Không có thông báo nào</p>
            <p className="mt-1 text-sm text-[#74817b]">
              Thông báo về duyệt tin, lịch hẹn và thanh toán sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const visual = getNotificationVisual(item.type);
            const VisualIcon = visual.icon;
            const directTarget = getDirectTarget(item.type, item.referenceId);

            return (
              <div
                key={item.id}
                onClick={() => {
                  markRead(item.id);
                  router.push(`/landlord/notifications/${item.id}`);
                }}
                className={`flex items-start gap-4 p-5 transition-colors hover:bg-[#f7f6f2]/80 cursor-pointer ${
                  !item.isRead ? "bg-[#eaf2ed]/25" : ""
                }`}
              >
                <div
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full ${visual.bg} ${visual.text}`}
                >
                  <VisualIcon className="size-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${visual.bg} ${visual.text}`}
                    >
                      {visual.badge}
                    </span>
                    <h2
                      className={`text-[15px] ${
                        !item.isRead ? "font-bold text-[#203c37]" : "font-semibold text-[#203c37]"
                      }`}
                    >
                      {item.title}
                    </h2>
                    {!item.isRead && <span className="size-2 rounded-full bg-[#15594f]" />}
                  </div>

                  <p className="mt-1 text-sm leading-6 text-[#5c6964]">{item.content}</p>

                  <div className="mt-2.5 flex items-center justify-between text-xs text-[#74817b]">
                    <span>{formatDate(item.createdAt, "datetime")}</span>

                    <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/landlord/notifications/${item.id}`}
                        className="text-xs text-[#74817b] hover:text-[#203c37] hover:underline"
                      >
                        Chi tiết thông báo
                      </Link>

                      <Link
                        href={directTarget}
                        className={`inline-flex items-center gap-1 font-semibold hover:underline ${
                          item.type === "POST_REJECTED" ? "text-[#a4422c]" : "text-[#15594f]"
                        }`}
                      >
                        <span>
                          {item.type === "POST_REJECTED"
                            ? "Xem bài viết bị từ chối"
                            : item.type === "POST_APPROVED"
                            ? "Xem bài viết đã duyệt"
                            : "Xem chi tiết"}
                        </span>
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
