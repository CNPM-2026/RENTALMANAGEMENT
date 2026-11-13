"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings, LogOut, HelpCircle, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getCurrentUser, logout } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { translateRole } from "@/lib/labels";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { TopbarChatButton } from "@/components/chat/topbar-chat-button";

export function LandlordTopbar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<ReturnType<typeof getCurrentUser>>(null);
  const roleLabel = translateRole(currentUser?.role);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  // Generate readable breadcrumb segment
  function getBreadcrumb() {
    if (currentPath.includes("dashboard")) return "Tổng quan";
    if (currentPath.includes("properties")) return "Bất động sản & cơ sở";
    if (currentPath.includes("rooms")) return "Tòa nhà · Tầng · Phòng";
    if (currentPath.includes("listings")) return "Quản lý tin đăng";
    if (currentPath.includes("rental-requests")) return "Yêu cầu thuê phòng";
    if (currentPath.includes("calendar")) return "Lịch xem phòng";
    if (currentPath.includes("tenants")) return "Danh bạ khách thuê";
    if (currentPath.includes("contracts")) return "Hợp đồng & đặt cọc";
    if (currentPath.includes("utilities")) return "Điện nước & dịch vụ";
    if (currentPath.includes("invoices")) return "Hóa đơn & thanh toán";
    if (currentPath.includes("reports")) return "Báo cáo kinh doanh";
    if (currentPath.includes("maintenance")) return "Sửa chữa & bảo trì";
    if (currentPath.includes("staff")) return "Nhân viên & phân quyền";
    if (currentPath.includes("messages")) return "Tin nhắn & thông báo";
    if (currentPath.includes("settings")) return "Cài đặt tài khoản";
    return "Không gian quản lý";
  }

  function handleLogout() {
    setLogoutModalOpen(false);
    // Xoá phiên + điều hướng tải lại toàn trang (không cần F5).
    void logout();
  }

  return (
    <>
      <header className="sticky top-0 z-30 w-full h-[72px] bg-white border-b border-[#e2e7e1] px-6 lg:px-8 flex items-center justify-between shrink-0">
        {/* Left: Breadcrumbs (Matches Figma 50:4401: text-[#74817b] text-[12px]) */}
        <div className="flex items-center gap-2 text-[12px] text-[#74817b]">
          <Link
            href="/landlord/dashboard"
            className="hover:text-[#15594f] transition-colors"
          >
            Chủ trọ
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#203c37]">{getBreadcrumb()}</span>
        </div>

        {/* Right: Controls & Profile Pill */}
        <div className="flex items-center gap-4">
          <Link
            href="/landlord/support"
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium text-[#74817b] hover:text-[#15594f] transition-colors"
          >
            <HelpCircle className="size-4" />
            <span>Trợ giúp</span>
          </Link>
          <Link
            href="/rooms"
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium text-[#74817b] hover:text-[#15594f] transition-colors"
          >
            <UserRound className="size-4" />
            <span>Khu người thuê</span>
          </Link>

          {/* Chat Messenger (Next to Notifications) */}
          <TopbarChatButton />

          {/* Notification dropdown */}
          <NotificationDropdown portal="landlord" badgeMode="dot" iconClassName="size-4.5" />

          <div className="h-5 w-px bg-[#e2e7e1]" />

          {/* Profile Pill (Matches Figma 50:4401: MA circle + Name + Role ⌄) */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-[100px] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              <Avatar src={currentUser?.avatarUrl} alt={currentUser?.fullName ?? "Chủ trọ"} className="size-[34px] rounded-full object-cover border border-[#e2e7e1]" />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[13px] font-semibold text-[#203c37] leading-tight">
                  {currentUser?.fullName ?? "Chủ trọ"}
                </span>
                <span className="text-[10px] text-[#74817b] leading-tight">
                  {roleLabel} ⌄
                </span>
              </div>
              <ChevronDown className="size-3.5 text-[#74817b] hidden md:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-[10px] border border-[#e2e7e1] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#e2e7e1]">
                  <p className="text-[13px] font-semibold text-[#203c37]">
                    {currentUser?.fullName ?? "Chủ trọ"}
                  </p>
                  <p className="text-[11px] text-[#74817b]">
                    {currentUser?.email ?? ""}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#15594f]">
                    {roleLabel}
                  </p>
                </div>

                <Link
                  href="/landlord/dashboard"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
                >
                  <Settings className="size-4" />
                  <span>Không gian chủ trọ</span>
                </Link>

                <Link
                  href="/rooms"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <HelpCircle className="size-4 text-[#74817b]" />
                  <span>Tìm phòng & đọc bài</span>
                </Link>

                <Link
                  href="/landlord/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Settings className="size-4 text-[#74817b]" />
                  <span>Cài đặt tài khoản</span>
                </Link>

                <Link
                  href="/tenant/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Settings className="size-4 text-[#74817b]" />
                  <span>Hồ sơ cá nhân</span>
                </Link>

                <div className="h-px bg-[#e2e7e1] my-1" />

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#991b1b] hover:bg-[#fee2e2]/60 cursor-pointer text-left"
                >
                  <LogOut className="size-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Dialog */}
      <Modal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Xác nhận đăng xuất"
        description="Bạn có muốn đăng xuất khỏi cổng quản lý chủ trọ 5K-Rental Manager?"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleLogout}
            >
              Đăng xuất
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#74817b]">
          Hệ thống sẽ lưu lại toàn bộ tiến trình quản lý hiện tại. Bạn có thể đăng
          nhập lại bất cứ lúc nào.
        </p>
      </Modal>
    </>
  );
}
