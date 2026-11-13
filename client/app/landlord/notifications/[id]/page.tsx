"use client";

import * as React from "react";
import { NotificationDetail } from "@/components/notifications/notification-detail";

export default function LandlordNotificationDetailPage() {
  return (
    <React.Suspense
      fallback={<div className="py-12 text-center text-sm text-[#74817b]">Đang tải thông báo...</div>}
    >
      <NotificationDetail portal="landlord" />
    </React.Suspense>
  );
}
