"use client";

import { NotificationCenter } from "@/components/notifications/notification-center";

export default function LandlordNotificationsPage() {
  return (
    <NotificationCenter
      portal="landlord"
      title="Thông báo"
      subtitle="Duyệt tin, yêu cầu thuê, lịch hẹn, hoá đơn và công việc bảo trì."
    />
  );
}
