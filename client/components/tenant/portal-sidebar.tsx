"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Calendar,
  Send,
  FileText,
  UserCheck,
  UserPlus,
  MessageSquare,
  HelpCircle,
  ShieldAlert,
  Bell,
  User,
  Settings,
  Lock,
  LogOut,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/use-notifications";

interface PortalSidebarProps {
  onLogout?: () => void;
}

export function PortalSidebar({ onLogout }: PortalSidebarProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const { unreadCount } = useNotifications();

  // 9 Functional Navigation Items (from Figma spec_miner_survey_3 handoff)
  const functionalItems = [
    { label: "Khám phá & Đã lưu", href: "/tenant/favorites", icon: Heart },
    { label: "Lịch xem phòng", href: "/tenant/appointments", icon: Calendar },
    { label: "Yêu cầu thuê", href: "/tenant/rental-requests", icon: Send },
    { label: "Hợp đồng của tôi", href: "/tenant/contracts", icon: FileText },
    // 🆕 Số người ở: tenant khai, chủ trọ xác minh; hoá đơn dùng số ĐÃ xác minh.
    { label: "Khai báo số người ở", href: "/tenant/occupancy", icon: UserCheck },
    // 🆕 Batch 2 — điểm bắt đầu của luồng marketplace: khách thuê báo sự cố,
    // chủ trọ tiếp nhận rồi chuyển thành việc cần thợ.
    { label: "Báo cáo sự cố", href: "/tenant/maintenance", icon: Wrench },
    {
      label: "Hồ sơ gu sống & Ở ghép",
      href: "/tenant/roommate-profile",
      icon: UserCheck,
    },
    {
      label: "Lời mời kết nối",
      href: "/tenant/roommate-invitations",
      icon: UserPlus,
    },
    { label: "Tin nhắn", href: "/tenant/messages", icon: MessageSquare },
    { label: "Trung tâm hỗ trợ", href: "/tenant/support", icon: HelpCircle },
    {
      label: "Trung tâm an toàn & Báo cáo",
      href: "/tenant/safety",
      icon: ShieldAlert,
    },
  ];

  // 5 Account Navigation Items (from Figma spec_miner_survey_3 handoff)
  const accountItems = [
    { label: "Thông báo", href: "/tenant/notifications", icon: Bell },
    { label: "Chỉnh sửa hồ sơ", href: "/tenant/profile", icon: User },
    {
      label: "Cài đặt & Quyền riêng tư",
      href: "/tenant/settings",
      icon: Settings,
    },
    { label: "Đổi mật khẩu", href: "/reset-password", icon: Lock },
  ];

  return (
    <aside className="w-[236px] shrink-0 min-h-[calc(100vh-88px)] bg-white border-r border-[#e2e7e1] flex flex-col justify-between py-6 px-3">
      <div className="space-y-6">
        {/* Section Header */}
        <div className="px-3">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-[#74817b]">
            TÀI KHOẢN CÁ NHÂN
          </p>
        </div>

        {/* 9 Functional Links */}
        <nav className="space-y-1">
          {functionalItems.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-[#eaf2ed] text-[#15594f] font-semibold"
                    : "text-[#74817b] hover:text-[#203c37] hover:bg-[#f7f6f2]"
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-[#15594f]" : "text-[#74817b]"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Divider (Figma: rounded-rectangle 184x1px #e2e7e1) */}
        <div className="h-px bg-[#e2e7e1] mx-2" />

        {/* 5 Account Links */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-[#74817b]">
            THIẾT LẬP
          </p>
          {accountItems.map((item) => {
            const isActive = currentPath === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-[#eaf2ed] text-[#15594f] font-semibold"
                    : "text-[#74817b] hover:text-[#203c37] hover:bg-[#f7f6f2]"
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-[#15594f]" : "text-[#74817b]"
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.href === "/tenant/notifications" && unreadCount > 0 && (
                  <span className="ml-auto rounded-full bg-[#991b1b] px-1.5 py-0.5 text-[10px] font-bold text-white">{unreadCount}</span>
                )}
              </Link>
            );
          })}

          {/* Logout Action */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] font-medium text-[#991b1b] hover:bg-[#fee2e2]/60 transition-colors cursor-pointer text-left"
          >
            <LogOut className="size-4 shrink-0 text-[#991b1b]" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Bottom Trust Card (Figma: Cam kết an tâm bg #f2ede3, rounded 8px) */}
      <div className="mt-6 pt-4 border-t border-[#e2e7e1]/60 px-1">
        <div className="bg-[#f2ede3] rounded-[8px] p-3 border border-[#e2e7e1]">
          <div className="flex items-center gap-1.5 text-[#15594f]">
            <ShieldCheck className="size-4 shrink-0" />
            <p className="text-[11px] font-bold">Cam kết an tâm</p>
          </div>
          <p className="text-[11px] text-[#74817b] mt-1.5 leading-snug">
            An tâm cùng 5K-Rental Manager — Bảo vệ quyền lợi người thuê 100%.
          </p>
          <Link
            href="/tenant/safety"
            className="inline-block mt-2 text-[10px] font-semibold text-[#15594f] hover:underline"
          >
            Tìm hiểu thêm →
          </Link>
        </div>
      </div>
    </aside>
  );
}
