"use client";

import { NotificationCenter } from "@/components/notifications/notification-center";

export default function AdminNotificationsPage() {
  return (
    <NotificationCenter
      portal="admin"
      title="Thông báo quản trị"
      subtitle="Kiểm duyệt tin đăng, KYC, báo cáo vi phạm và hoạt động hệ thống."
    />
  );
}
