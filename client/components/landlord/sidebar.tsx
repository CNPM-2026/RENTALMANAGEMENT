"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  DoorOpen,
  FileText,
  Inbox,
  Calendar,
  Users,
  FileCheck,
  Zap,
  Receipt,
  BarChart3,
  Wrench,
  UserCog,
  ClipboardList,
  MessageSquare,
  ChevronDown,
  ExternalLink,
  Search,
  User,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { useLandlordAccess } from "@/context/landlord-access-context";
import { landlordRuleForPath, type LandlordRouteRule } from "@/lib/landlord-permissions";
import { Property } from "@/types/models";

const ALLOWED_FOR_MEMBER = (rule: LandlordRouteRule, permissions: string[]) =>
  rule === null || (rule !== "LANDLORD_ONLY" && permissions.includes(rule));

export function LandlordSidebar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const { isLandlord, permissions } = useLandlordAccess();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string | null>(null);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = React.useState(false);

  const canSeeProperties = isLandlord || permissions.includes("PROPERTIES_ROOMS");
  React.useEffect(() => {
    // Nhân viên không có quyền PROPERTIES_ROOMS không gọi endpoint này — tránh
    // 403 làm client chuyển sang /403 ngay khi vừa mở dashboard.
    if (!canSeeProperties) return;
    apiClient.properties.getMyProperties()
      .then((items) => {
        setProperties(items ?? []);
        setSelectedPropertyId((current) => current ?? items?.[0]?.id ?? null);
      })
      .catch(() => setProperties([]));
  }, [canSeeProperties]);

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);

  // 4 Business Groups from Figma Frame 50:4401 and survey_3
  const navGroups = [
    {
      title: "KHÔNG GIAN",
      items: [
        { label: "Tổng quan", href: "/landlord/dashboard", icon: LayoutDashboard },
        { label: "Bất động sản & cơ sở", href: "/landlord/properties", icon: Building2 },
        { label: "Tòa nhà · Tầng · Phòng", href: "/landlord/rooms", icon: DoorOpen },
        { label: "Tin đăng", href: "/landlord/listings", icon: FileText },
      ],
    },
    {
      title: "CHO THUÊ",
      items: [
        { label: "Yêu cầu thuê phòng", href: "/landlord/rental-requests", icon: Inbox },
        { label: "Lịch xem phòng", href: "/landlord/calendar", icon: Calendar },
        { label: "Khách thuê", href: "/landlord/tenants", icon: Users },
        { label: "Xác minh số người ở", href: "/landlord/occupancy", icon: Users },
        { label: "Hợp đồng & đặt cọc", href: "/landlord/contracts", icon: FileCheck },
      ],
    },
    {
      title: "TÀI CHÍNH",
      items: [
        { label: "Điện nước & dịch vụ", href: "/landlord/utilities", icon: Zap },
        { label: "Hóa đơn & thanh toán", href: "/landlord/invoices", icon: Receipt },
        { label: "Báo cáo kinh doanh", href: "/landlord/reports", icon: BarChart3 },
      ],
    },
    {
      title: "VẬN HÀNH",
      items: [
        { label: "Chợ công việc bảo trì", href: "/landlord/maintenance-tasks", icon: ClipboardList },
        { label: "Tìm thợ theo kỹ năng", href: "/landlord/staff-marketplace", icon: Users },
        { label: "Sửa chữa & bảo trì", href: "/landlord/maintenance", icon: Wrench },
        { label: "Nhân viên & phân quyền", href: "/landlord/staff", icon: UserCog },
        { label: "Tin nhắn & thông báo", href: "/landlord/messages", icon: MessageSquare },
      ],
    },
    {
      title: "DÙNG CHUNG",
      items: [
        { label: "Tìm phòng", href: "/rooms", icon: Search },
        { label: "Tìm bạn ở ghép", href: "/roommates", icon: Users },
        { label: "Hồ sơ cá nhân", href: "/tenant/profile", icon: User },
        { label: "Kiểm duyệt KYC", href: "/landlord/kyc", icon: ShieldCheck },
        { label: "Báo cáo vi phạm", href: "/tenant/safety/report", icon: ShieldAlert },
      ],
    },
  ];

  return (
    <aside className="w-[224px] shrink-0 min-h-screen bg-white border-r border-[#e2e7e1] flex flex-col justify-between py-6 px-3">
      <div className="space-y-4">
        {/* Brand Block */}
        <div className="px-2 pb-2">
          <Link href="/landlord/dashboard" className="flex items-center gap-2.5">
            <div className="size-[34px] rounded-[8px] bg-[#15594f] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              5K
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[20px] text-[#15594f] tracking-tight leading-none">
                5K-Rental
              </span>
              <span className="text-[10px] font-semibold text-[#74817b] uppercase tracking-wider mt-0.5">
                Chủ trọ Manager
              </span>
            </div>
          </Link>
        </div>

        {/* Property Selector Dropdown Card (Matches Figma steps/65/output.txt verbatim) */}
        <div className="relative px-1">
          <button
            onClick={() => setPropertyDropdownOpen((prev) => !prev)}
            className="w-full bg-[#f7f6f2] hover:bg-[#f2ede3] rounded-[8px] p-3 text-left border border-[#e2e7e1]/60 transition-colors cursor-pointer"
          >
            <p className="text-[#74817b] text-[10px] font-semibold uppercase tracking-wider">
              KHÔNG GIAN CHỦ TRỌ
            </p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[#203c37] text-[13px] font-semibold truncate">
                {selectedProperty?.name ?? "Chưa có cơ sở"}
              </p>
              <ChevronDown className="size-3.5 text-[#74817b] shrink-0 ml-1" />
            </div>
          </button>

          {propertyDropdownOpen && (
            <div className="absolute left-1 right-1 mt-1 bg-white border border-[#e2e7e1] rounded-[8px] shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              {properties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => {
                    setSelectedPropertyId(property.id);
                    setPropertyDropdownOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[12px] truncate hover:bg-[#f7f6f2] transition-colors cursor-pointer",
                    selectedPropertyId === property.id
                      ? "text-[#15594f] font-semibold bg-[#eaf2ed]"
                      : "text-[#203c37]"
                  )}
                >
                  {property.name} ({property._count?.rooms ?? 0} phòng)
                </button>
              ))}
              {properties.length === 0 && (
                <p className="px-3 py-2 text-[12px] text-[#74817b]">Chưa có cơ sở nào</p>
              )}
            </div>
          )}
        </div>

        {/* 4 Business Groups Navigation */}
        <nav className="space-y-4 pt-1">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <p className="px-3 text-[10px] font-semibold tracking-wider uppercase text-[#74817b]">
                {group.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {group.items
                  .filter(
                    (item) =>
                      isLandlord || ALLOWED_FOR_MEMBER(landlordRuleForPath(item.href), permissions),
                  )
                  .map((item) => {
                  // So khớp theo SEGMENT: `/landlord/maintenance` không được
                  // sáng đèn khi đang ở `/landlord/maintenance-tasks`.
                  const isActive =
                    currentPath === item.href ||
                    (item.href !== "/landlord/dashboard" && currentPath.startsWith(`${item.href}/`));

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
                          "size-4 shrink-0",
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

      {/* Bottom Support Widget (Figma Frame 50:4401: bg #f2ede3, rounded 8px) */}
      <div className="mt-6 pt-4 border-t border-[#e2e7e1]/60 px-1">
        <div className="bg-[#f2ede3] rounded-[8px] p-3 border border-[#e2e7e1]">
          <p className="text-[11px] font-semibold text-[#203c37]">
            5K-Rental Manager
          </p>
          <p className="text-[10px] text-[#74817b] mt-0.5">
            Luôn sẵn sàng hỗ trợ chủ trọ 24/7
          </p>
          <Link
            href="/landlord/support"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15594f] hover:underline mt-2"
          >
            <span>Trung tâm hỗ trợ</span>
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
