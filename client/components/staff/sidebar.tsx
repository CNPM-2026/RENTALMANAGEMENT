"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  ClipboardList,
  Home,
  LifeBuoy,
  UserCog,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Sidebar của KHÔNG GIAN THỢ (role = STAFF).
 *
 * Cùng mô hình với portal chủ trọ/quản trị/khách thuê: một không gian riêng,
 * điều hướng cố định bằng sidebar thay vì các tab rời trên header.
 */
export function StaffSidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const { unreadCount } = useNotifications();

  const groups = [
    {
      title: "CÔNG VIỆC",
      items: [
        { label: "Việc làm & ứng tuyển", href: "/staff/tasks", icon: ClipboardList },
        { label: "Hồ sơ & kỹ năng", href: "/staff/profile", icon: UserCog },
        { label: "Xác minh CCCD", href: "/staff/kyc", icon: BadgeCheck },
      ],
    },
    {
      title: "TÀI KHOẢN",
      items: [
        { label: "Thông báo công việc", href: "/staff/notifications", icon: Bell },
        { label: "Về trang chủ", href: "/", icon: Home },
      ],
    },
  ];

  return (
    <aside className="w-[224px] shrink-0 min-h-screen bg-white border-r border-[#e2e7e1] flex flex-col justify-between py-6 px-3">
      <div className="space-y-4">
        {/* Brand Block */}
        <div className="px-2 pb-1">
          <Link href="/staff/profile" className="flex items-center gap-2.5">
            <div className="size-[34px] rounded-[8px] bg-[#15594f] flex items-center justify-center text-white shadow-sm">
              <Wrench className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[18px] text-[#15594f] tracking-tight leading-none">
                5K-Rental
              </span>
              <span className="text-[10px] font-bold text-[#9a6a12] uppercase tracking-wider mt-0.5">
                Không gian thợ
              </span>
            </div>
          </Link>
        </div>

        {/* Context Card */}
        <div className="bg-[#f7f6f2] rounded-[8px] p-2.5 border border-[#e2e7e1]/60 mx-1">
          <p className="text-[10px] font-semibold text-[#74817b] uppercase tracking-wider">
            THỢ ĐỘC LẬP
          </p>
          <p className="text-[12px] font-semibold text-[#203c37] mt-0.5">
            Nhận việc từ chủ trọ
          </p>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-4 pt-1">
          {groups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-[#74817b]">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/"
                      ? currentPath === "/"
                      : currentPath === item.href || currentPath.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[12px] font-medium transition-colors",
                        isActive
                          ? "bg-[#eaf2ed] text-[#15594f] font-semibold shadow-xs"
                          : "text-[#74817b] hover:text-[#203c37] hover:bg-[#f7f6f2]"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "size-3.5 shrink-0",
                          isActive ? "text-[#15594f]" : "text-[#74817b]"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.href === "/staff/notifications" && unreadCount > 0 && (
                        <span className="ml-auto rounded-full bg-[#991b1b] px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Support Card */}
      <div className="mt-4 pt-3 border-t border-[#e2e7e1]/60 px-1">
        <div className="bg-[#f2ede3] rounded-[8px] p-3 border border-[#e2e7e1]">
          <div className="flex items-center gap-1.5 text-[#15594f]">
            <LifeBuoy className="size-4 shrink-0" />
            <p className="text-[11px] font-bold">Cần hỗ trợ?</p>
          </div>
          <p className="text-[11px] text-[#74817b] mt-1.5 leading-snug">
            Liên hệ trung tâm hỗ trợ nếu bạn gặp sự cố khi nhận việc hoặc xác minh.
          </p>
          <Link
            href="/tenant/support"
            className="inline-block mt-2 text-[10px] font-semibold text-[#15594f] hover:underline"
          >
            Trung tâm hỗ trợ →
          </Link>
        </div>
      </div>
    </aside>
  );
}
