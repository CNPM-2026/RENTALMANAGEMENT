"use client";

import { NotificationCenter } from "@/components/notifications/notification-center";

export default function TenantNotificationsPage() {
  return (
    <NotificationCenter
      portal="tenant"
      title="Thông báo"
      subtitle="Lịch xem phòng, yêu cầu thuê, hợp đồng, hoá đơn và số người ở."
    />
  );
}
