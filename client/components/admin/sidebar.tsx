"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  Building,
  Home,
  FileText,
  FileWarning,
  Activity,
  Users,
  ShieldCheck,
  BadgeCheck,
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  Filter,
  LifeBuoy,
  Scale,
  UserCog,
  Key,
  History,
  Settings,
  Sparkles,
  ListChecks,
  Search,
  User,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";

  // 4 Governance Groups from Figma Frame 67:4298, 67:268, 67:2 and survey_3
  const adminGroups = [
    {
      title: "THỐNG KÊ TOÀN DIỆN",
      items: [
        { label: "Tổng quan nền tảng", href: "/admin/dashboard", icon: LayoutDashboard },
        { label: "Thống kê người dùng", href: "/admin/stats/users", icon: UserCheck },
        { label: "Thống kê chủ trọ", href: "/admin/stats/landlords", icon: Building },
        { label: "Thống kê BĐS & phòng", href: "/admin/stats/properties", icon: Home },
        { label: "Thống kê tin đăng", href: "/admin/stats/listings", icon: FileText },
        { label: "Hoạt động hệ thống", href: "/admin/stats/system", icon: Activity },
      ],
    },
    {
      title: "QUẢN LÝ TÀI KHOẢN & KYC",
      items: [
        { label: "Quản lý người dùng", href: "/admin/users", icon: Users },
        { label: "Quản lý chủ trọ", href: "/admin/landlords", icon: ShieldCheck },
        { label: "Hồ sơ xác minh KYC", href: "/admin/landlords/kyc", icon: BadgeCheck },
      ],
    },
    {
      title: "KIỂM DUYỆT & TRANH CHẤP",
      items: [
        { label: "Kiểm duyệt tin đăng", href: "/admin/moderation/listings", icon: ClipboardCheck },
        { label: "Quản lý báo cáo vi phạm", href: "/admin/reports", icon: AlertTriangle },
        { label: "Điều tra tin giả & lừa đảo", href: "/admin/fraud", icon: ShieldAlert },
        { label: "Quản lý nội dung cấm", href: "/admin/content-filter", icon: Filter },
        { label: "Quản lý yêu cầu hỗ trợ", href: "/admin/support", icon: LifeBuoy },
        { label: "Quản lý khiếu nại", href: "/admin/disputes", icon: Scale },
        { label: "Duyệt chấm dứt HĐ", href: "/admin/contracts", icon: FileWarning },
      ],
    },
    {
      title: "QUẢN TRỊ HỆ THỐNG",
      items: [
        { label: "Nhân viên quản trị", href: "/admin/staff", icon: UserCog },
        { label: "Phân quyền RBAC", href: "/admin/roles", icon: Key },
        { label: "Nhật ký hoạt động", href: "/admin/audit-logs", icon: History },
        { label: "Cấu hình hệ thống", href: "/admin/settings", icon: Settings },
        { label: "Tiện ích phòng", href: "/admin/amenities", icon: Sparkles },
        { label: "Câu hỏi ở ghép", href: "/admin/lifestyle-questions", icon: ListChecks },
      ],
    },
    {
      title: "DÙNG CHUNG",
      items: [
        { label: "Thông báo quản trị", href: "/admin/notifications", icon: Bell },
        { label: "Tìm phòng", href: "/rooms", icon: Search },
        { label: "Tìm bạn ở ghép", href: "/roommates", icon: Users },
        { label: "Hồ sơ cá nhân", href: "/tenant/profile", icon: User },
        { label: "Báo cáo vi phạm", href: "/tenant/safety/report", icon: ShieldAlert },
      ],
    },
  ];

  return (
    <aside className="w-[224px] shrink-0 min-h-screen bg-white border-r border-[#e2e7e1] flex flex-col justify-between py-6 px-3">
      <div className="space-y-4">
        {/* Brand Block */}
        <div className="px-2 pb-1">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="size-[34px] rounded-[8px] bg-[#15594f] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              AD
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[18px] text-[#15594f] tracking-tight leading-none">
                5K-Rental
              </span>
              <span className="text-[10px] font-bold text-[#991b1b] uppercase tracking-wider mt-0.5">
                Cổng quản trị
              </span>
            </div>
          </Link>
        </div>

        {/* Platform Context Card */}
        <div className="bg-[#f7f6f2] rounded-[8px] p-2.5 border border-[#e2e7e1]/60 mx-1">
          <p className="text-[10px] font-semibold text-[#74817b] uppercase tracking-wider">
            NỀN TẢNG QUẢN TRỊ
          </p>
          <p className="text-[12px] font-semibold text-[#203c37] mt-0.5">
            Hệ thống trung tâm
          </p>
        </div>

        {/* 4 Governance Groups Navigation */}
        <nav className="space-y-4 pt-1 max-h-[calc(100vh-270px)] overflow-y-auto pr-1">
          {adminGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-[#74817b]">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const isActive =
                    currentPath === item.href ||
                    (item.href !== "/admin/dashboard" &&
                      currentPath.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors",
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
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Environment Badge (Figma survey_3 handoff) */}
      <div className="mt-4 pt-3 border-t border-[#e2e7e1]/60 px-1">
        <div className="bg-[#f7f6f2] rounded-[8px] p-2.5 border border-[#e2e7e1] space-y-1">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#15594f] animate-pulse" />
            <p className="text-[11px] font-semibold text-[#203c37]">
              Hệ thống đang hoạt động
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[#74817b]">
            <span>Phiên bản: v2.4.1</span>
            <span className="text-[#15594f] font-semibold">Ổn định</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
