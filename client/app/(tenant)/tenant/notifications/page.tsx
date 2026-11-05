"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Calendar,
  FileText,
  Receipt,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Notification, NotificationType } from "@/types/models";
import { formatDate } from "@/lib/utils";

type FilterTab = "ALL" | NotificationType;

export default function TenantNotificationsPage() {
  const [activeTab, setActiveTab] = React.useState<FilterTab>("ALL");
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);

  // Load notifications from API
  React.useEffect(() => {
    async function fetchNotifications() {
      setIsLoading(true);
      try {
        const data = await apiClient.notifications.getMy();
        setNotifications(data || []);
      } catch {
        setError("Không tải được thông báo. Vui lòng thử lại.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  async function handleMarkAsRead(id: string) {
    try {
      await apiClient.notifications.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch {
      setError("Không thể cập nhật trạng thái thông báo.");
    }
  }

  async function handleMarkAllAsRead() {
    setIsMarkingAll(true);
    try {
      await apiClient.notifications.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      setError("Không thể đánh dấu tất cả thông báo.");
    } finally {
      setIsMarkingAll(false);
    }
  }

  // Filter items by category
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "ALL") return true;
    return item.type === activeTab;
  });

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  function renderNotificationIcon(type: NotificationType) {
    switch (type) {
      case "APPOINTMENT":
        return (
          <div className="size-[42px] rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center shrink-0">
            <Calendar className="size-5" />
          </div>
        );
      case "INVOICE":
        return (
          <div className="size-[42px] rounded-full bg-[#fef3c7] text-[#92400e] flex items-center justify-center shrink-0">
            <Receipt className="size-5" />
          </div>
        );
      case "CONTRACT":
        return (
          <div className="size-[42px] rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center shrink-0">
            <FileText className="size-5" />
          </div>
        );
      case "MESSAGE":
        return (
          <div className="size-[42px] rounded-full bg-[#e0f2fe] text-[#075985] flex items-center justify-center shrink-0">
            <MessageSquare className="size-5" />
          </div>
        );
      default:
        return (
          <div className="size-[42px] rounded-full bg-[#f2ede3] text-[#74817b] flex items-center justify-center shrink-0">
            <Bell className="size-5" />
          </div>
        );
    }
  }

  function getActionLink(type: NotificationType, refId?: string | null): string {
    switch (type) {
      case "APPOINTMENT":
        return "/tenant/appointments";
      case "CONTRACT":
        return refId ? `/tenant/contracts/${refId}` : "/tenant/contracts";
      case "INVOICE":
        return "/tenant/invoices";
      case "MESSAGE":
        return refId ? `/tenant/messages?conversation=${encodeURIComponent(refId)}` : "/tenant/messages";
      default:
        return "/tenant/notifications";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="text-[12px] text-[#74817b] flex items-center gap-1.5 mb-2">
          <Link href="/" className="hover:text-[#203c37]">Trang chủ</Link>
          <span>/</span>
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-[#203c37] font-semibold">Thông báo</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold text-[#203c37] tracking-tight">
              Trung tâm thông báo
            </h1>
            <p className="text-[14px] text-[#74817b] mt-1">
              Theo dõi biến động lịch hẹn, hóa đơn thanh toán, hợp đồng và tin nhắn mới.
            </p>
          </div>
          {error && <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">{error}</div>}

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="h-[38px] px-4 rounded-[8px] border border-[#e2e7e1] bg-white hover:bg-[#f7f6f2] text-[#15594f] text-[13px] font-semibold flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <CheckCheck className="size-4" />
              <span>Đánh dấu tất cả đã đọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex border-b border-[#e2e7e1] gap-2 overflow-x-auto no-scrollbar">
        {[
          { key: "ALL", label: `Tất cả (${notifications.length})` },
          { key: "APPOINTMENT", label: "Lịch xem phòng" },
          { key: "INVOICE", label: "Thanh toán & Hóa đơn" },
          { key: "CONTRACT", label: "Hợp đồng" },
          { key: "MESSAGE", label: "Tin nhắn" },
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

      {/* Notification List Container */}
      <div className="bg-white rounded-[12px] border border-[#e2e7e1] shadow-sm divide-y divide-[#e2e7e1] overflow-hidden">
        {isLoading && <div className="p-10 text-center text-sm text-[#74817b]">Đang tải thông báo...</div>}
        {!isLoading && filteredNotifications.length > 0 ? (
          filteredNotifications.map((item) => (
            <div
              key={item.id}
              onClick={() => handleMarkAsRead(item.id)}
              className={`p-5 flex items-start gap-4 transition-colors hover:bg-[#f7f6f2]/80 cursor-pointer ${
                !item.isRead ? "bg-[#eaf2ed]/20" : ""
              }`}
            >
              {renderNotificationIcon(item.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`text-[15px] ${!item.isRead ? "font-bold text-[#203c37]" : "font-semibold text-[#203c37]"}`}>
                    {item.title}
                  </h3>
                  {!item.isRead && (
                    <span className="size-2 rounded-full bg-[#15594f] shrink-0" aria-label="Chưa đọc" />
                  )}
                </div>

                <p className="text-[13px] text-[#74817b] leading-relaxed">
                  {item.content}
                </p>

                <div className="mt-2.5 flex items-center justify-between text-[12px] text-[#74817b]">
                  <span>{formatDate(item.createdAt, "datetime")}</span>

                  <Link
                    href={getActionLink(item.type, item.referenceId)}
                    className="inline-flex items-center gap-1 font-semibold text-[#15594f] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Xem chi tiết</span>
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : !isLoading ? (
          /* Empty State */
          <div className="py-16 text-center space-y-3">
            <div className="size-14 rounded-full bg-[#f2ede3] text-[#74817b] flex items-center justify-center mx-auto">
              <Bell className="size-7" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#203c37]">
              Không có thông báo nào
            </h3>
            <p className="text-[13px] text-[#74817b] max-w-sm mx-auto">
              Khi có lịch hẹn mới, hóa đơn tiền phòng hoặc tin nhắn từ chủ trọ, thông báo sẽ hiển thị tại đây.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
