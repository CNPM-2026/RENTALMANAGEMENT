"use client";

import { NotificationCenter } from "@/components/notifications/notification-center";

export default function StaffNotificationsPage() {
  return (
    <NotificationCenter
      portal="staff"
      title="Thông báo công việc"
      subtitle="Việc mới, kết quả ứng tuyển, thương lượng giá và nghiệm thu."
    />
  );
}
