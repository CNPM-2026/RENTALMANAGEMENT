"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  ChevronDown,
  ClipboardList,
  Home,
  LogOut,
  UserCog,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser, logout } from "@/lib/auth";
import { translateRole } from "@/lib/labels";
import { NotificationDropdown } from "@/components/notifications/notification-dropdown";
import { TopbarChatButton } from "@/components/chat/topbar-chat-button";

export function StaffTopbar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<ReturnType<typeof getCurrentUser>>(null);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const displayName = currentUser?.fullName?.trim() || "Thợ";
  const roleLabel = translateRole(currentUser?.role);

  function getBreadcrumb() {
    if (currentPath.startsWith("/staff/kyc")) return "Xác minh CCCD";
    if (currentPath.startsWith("/staff/notifications")) return "Thông báo công việc";
    if (currentPath.startsWith("/staff/tasks")) return "Việc làm & ứng tuyển";
    if (currentPath.startsWith("/staff/profile")) return "Hồ sơ & kỹ năng";
    return "Không gian thợ";
  }

  function handleLogout() {
    setLogoutModalOpen(false);
    void logout();
  }

  return (
    <>
      <header className="sticky top-0 z-30 w-full h-[72px] bg-white border-b border-[#e2e7e1] px-6 lg:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-[12px] text-[#74817b]">
          <Link href="/staff/profile" className="hover:text-[#15594f] transition-colors">
            Không gian thợ
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#203c37]">{getBreadcrumb()}</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium text-[#74817b] hover:text-[#15594f] transition-colors"
          >
            <Home className="size-4" />
            <span>Về trang chủ</span>
          </Link>

          {/* Tin nhắn trực tiếp — cùng vị trí với các portal khác */}
          <TopbarChatButton />

          <NotificationDropdown
            portal="staff"
            title="Thông báo công việc"
            badgeMode="dot"
            iconClassName="size-4.5"
          />

          <div className="h-5 w-px bg-[#e2e7e1]" />

          <div className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-[100px] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              <Avatar
                src={currentUser?.avatarUrl}
                alt={displayName}
                className="size-[34px] rounded-full object-cover shadow-xs"
              />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[13px] font-semibold text-[#203c37] leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[#74817b] leading-tight">{roleLabel} ⌄</span>
              </div>
              <ChevronDown className="size-3.5 text-[#74817b] hidden md:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-[10px] border border-[#e2e7e1] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#e2e7e1]">
                  <p className="text-[13px] font-semibold text-[#203c37]">{displayName}</p>
                  <p className="text-[11px] text-[#74817b] truncate">
                    {currentUser?.email || "Chưa cập nhật email"}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#15594f]">
                    {roleLabel}
                  </p>
                </div>

                <Link
                  href="/staff/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
                >
                  <UserCog className="size-4" />
                  <span>Hồ sơ &amp; kỹ năng</span>
                </Link>

                <Link
                  href="/staff/tasks"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <ClipboardList className="size-4 text-[#74817b]" />
                  <span>Việc làm &amp; ứng tuyển</span>
                </Link>

                <Link
                  href="/staff/kyc"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <BadgeCheck className="size-4 text-[#74817b]" />
                  <span>Xác minh CCCD</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Home className="size-4 text-[#74817b]" />
                  <span>Về trang chủ</span>
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

      <Modal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Xác nhận đăng xuất"
        description={`Bạn có chắc chắn muốn kết thúc phiên làm việc của ${displayName}?`}
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setLogoutModalOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" size="sm" onClick={handleLogout}>
              Đăng xuất
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#74817b]">
          Bạn sẽ cần đăng nhập lại để tiếp tục nhận việc và cập nhật hồ sơ.
        </p>
      </Modal>
    </>
  );
}
