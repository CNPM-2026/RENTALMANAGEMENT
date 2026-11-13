"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

interface NotificationBellLinkProps {
  href: string;
  label: string;
}

/** Chuông thông báo có badge chưa đọc, dùng ở các layout không phải tenant/landlord. */
export function NotificationBellLink({ href, label }: NotificationBellLinkProps) {
  const { unreadCount } = useNotifications();
  return (
    <Link
      href={href}
      title={label}
      className="relative flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-[13px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
    >
      <Bell className="size-4" />
      <span>{label}</span>
      {unreadCount > 0 && (
        <span className="ml-0.5 rounded-full bg-[#991b1b] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </Link>
  );
}
