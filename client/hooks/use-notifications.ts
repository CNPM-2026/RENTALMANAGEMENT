"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { refreshChatSocketAuth } from "@/lib/socket";
import { Notification } from "@/types/models";

export function useNotifications(enabled = true) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);

  React.useEffect(() => {
    let active = true;
    if (!enabled) return () => {
      active = false;
    };

    apiClient.notifications.getMy().then((items) => {
      if (active) setNotifications(items);
    }).catch(() => undefined);

    const socket = refreshChatSocketAuth();
    const onNotification = (notification: Notification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 20));
    };
    socket.connect();
    socket.on("new_notification", onNotification);

    return () => {
      active = false;
      socket.off("new_notification", onNotification);
    };
  }, [enabled]);

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.isRead).length,
  };
}
