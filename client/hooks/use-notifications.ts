"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AUTH_CHANGE_EVENT, getAuthToken } from "@/lib/auth";
import { refreshChatSocketAuth } from "@/lib/socket";
import { Notification } from "@/types/models";

/**
 * Badge thông báo dùng CHUNG cho mọi component trong một tab.
 *
 * Trước đây `unreadCount` là state riêng của từng `useNotifications()`: trang
 * thông báo đánh dấu đã đọc chỉ cập nhật state của chính nó, còn chuông ở
 * topbar (instance khác) vẫn giữ số cũ cho tới khi F5. Store nhỏ dưới đây phát
 * cùng một giá trị tới mọi instance đang mount; server vẫn là nguồn sự thật.
 */
let sharedUnreadCount = 0;
const unreadListeners = new Set<(count: number) => void>();

function publishUnreadCount(count: number) {
  sharedUnreadCount = Math.max(0, Math.trunc(count));
  for (const listener of unreadListeners) listener(sharedUnreadCount);
}

/** Đặt badge từ một phản hồi server (hoặc 0 khi đã đọc tất cả). */
export function setNotificationUnreadCount(count: number): void {
  publishUnreadCount(count);
}

/** Cộng/trừ tạm thời; dùng khi server không trả số mới. */
export function adjustNotificationUnreadCount(delta: number): void {
  publishUnreadCount(sharedUnreadCount + delta);
}

/** Đọc lại số chưa đọc từ server và phát cho mọi chuông đang mount. */
export async function refreshNotificationUnreadCount(): Promise<number | null> {
  try {
    const result = await apiClient.notifications.getUnreadCount();
    const count = result.unreadCount ?? 0;
    setNotificationUnreadCount(count);
    return count;
  } catch {
    return null;
  }
}

/**
 * Badge + danh sách thông báo (Batch 6).
 *
 * `unreadCount` lấy từ server (`/notifications/unread-count`) thay vì đếm trên
 * 20 item gần nhất, và được ĐỒNG BỘ LẠI mỗi khi socket kết nối lại: thông báo
 * phát sinh trong lúc mất mạng không bị "mất badge" vĩnh viễn.
 */
export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCountState] = React.useState(sharedUnreadCount);

  React.useEffect(() => {
    const listener = (count: number) => setUnreadCountState(count);
    unreadListeners.add(listener);
    // Đồng bộ ngay sau khi mount: instance mới phải thấy số hiện tại, không chờ
    // lần fetch/socket kế tiếp.
    listener(sharedUnreadCount);
    return () => {
      unreadListeners.delete(listener);
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) return;

    let active = true;

    const loadAll = () => {
      apiClient.notifications.getMy()
        .then((items) => {
          if (active) setNotifications(items ?? []);
        })
        .catch(() => undefined);

      // Store dùng chung nên không cần `active`: instance khác vẫn cần số này.
      void refreshNotificationUnreadCount();
    };

    loadAll();

    const socket = refreshChatSocketAuth();
    const onNotification = (notification: Notification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 20));
      if (!notification.isRead) {
        // Mọi instance đều nhận cùng event; hỏi lại server một lần thay vì mỗi
        // instance tự +1 (sẽ nhân số lần đếm trên store dùng chung).
        void refreshNotificationUnreadCount();
      }
    };
    const onReconnect = () => loadAll();
    const onAuthChange = () => {
      if (!getAuthToken()) setNotificationUnreadCount(0);
    };

    socket.connect();
    socket.on("new_notification", onNotification);
    socket.on("connect", onReconnect);
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);

    return () => {
      active = false;
      socket.off("new_notification", onNotification);
      socket.off("connect", onReconnect);
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    };
  }, [enabled]);

  const markAsRead = React.useCallback(async (id: string) => {
    await apiClient.notifications.markAsRead(id);
    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
    );
    void refreshNotificationUnreadCount();
  }, []);

  const markAllAsRead = React.useCallback(async () => {
    await apiClient.notifications.markAllAsRead();
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? readAt })));
    setNotificationUnreadCount(0);
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
