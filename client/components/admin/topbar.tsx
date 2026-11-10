"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, ChevronDown, Settings, LogOut, Shield, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { clearAuthSession, getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { translateRole } from "@/lib/labels";
import { useNotifications } from "@/hooks/use-notifications";
import { TopbarChatButton } from "@/components/chat/topbar-chat-button";

export function AdminTopbar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const router = useRouter();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentUser, setCurrentUser] = React.useState<ReturnType<typeof getCurrentUser>>(null);
  const { unreadCount } = useNotifications(Boolean(currentUser));

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const displayName = currentUser?.fullName?.trim() || "Quản trị viên";
  const roleLabel = translateRole(currentUser?.role);

  function getBreadcrumb() {
    if (currentPath.includes("dashboard")) return "Tổng quan nền tảng";
    if (currentPath.includes("stats/users")) return "Thống kê người dùng";
    if (currentPath.includes("stats/landlords")) return "Thống kê chủ trọ";
    if (currentPath.includes("stats/properties")) return "Thống kê BĐS & phòng";
    if (currentPath.includes("stats/listings")) return "Thống kê tin đăng";
    if (currentPath.includes("stats/system")) return "Hoạt động hệ thống";
    if (currentPath.includes("users")) return "Quản lý người dùng";
    if (currentPath.includes("landlords/kyc")) return "Hồ sơ xác minh KYC";
    if (currentPath.includes("landlords")) return "Quản lý chủ trọ";
    if (currentPath.includes("moderation")) return "Kiểm duyệt tin đăng";
    if (currentPath.includes("reports")) return "Báo cáo vi phạm";
    if (currentPath.includes("fraud")) return "Điều tra tin giả & lừa đảo";
    if (currentPath.includes("content-filter")) return "Quản lý nội dung cấm";
    if (currentPath.includes("support")) return "Yêu cầu hỗ trợ";
    if (currentPath.includes("disputes")) return "Quản lý khiếu nại";
    if (currentPath.includes("staff")) return "Nhân viên quản trị";
    if (currentPath.includes("roles")) return "Phân quyền RBAC";
    if (currentPath.includes("audit-logs")) return "Nhật ký hoạt động (Audit Trail)";
    if (currentPath.includes("settings")) return "Cấu hình hệ thống";
    return "Bảng điều khiển quản trị";
  }

  function handleLogout() {
    clearAuthSession();
    setLogoutModalOpen(false);
    router.push("/login");
  }

  return (
    <>
      <header className="sticky top-0 z-30 w-full h-[72px] bg-white border-b border-[#e2e7e1] px-6 lg:px-8 flex items-center justify-between shrink-0">
        {/* Left: Breadcrumbs */}
        <div className="flex items-center gap-2 text-[12px] text-[#74817b]">
          <Link
            href="/admin/dashboard"
            className="hover:text-[#15594f] transition-colors"
          >
            Quản trị
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#203c37]">{getBreadcrumb()}</span>
        </div>

        {/* Center/Right: Quick Search & Admin Pill */}
        <div className="flex items-center gap-4">
          {/* Global Quick Search Input */}
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 size-4 text-[#74817b] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm user, chủ trọ, phòng..."
              className="w-56 lg:w-72 h-[38px] pl-9 pr-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:bg-white transition-all"
            />
          </div>
          <Link
            href="/rooms"
            className="hidden sm:flex items-center gap-1.5 text-[12px] font-medium text-[#74817b] hover:text-[#15594f] transition-colors"
          >
            <UserRound className="size-4" />
            <span>Khu người thuê</span>
          </Link>

          {/* Chat Shortcut (Next to Notification Bell) */}
          <TopbarChatButton />

          {/* Security Alert Bell */}
          <Link
            href="/admin/reports"
            title="Cảnh báo an toàn & Vi phạm"
            className="relative size-9 rounded-full flex items-center justify-center text-[#74817b] hover:text-[#991b1b] hover:bg-[#f7f6f2] transition-colors"
          >
            <Bell className="size-4.5" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 size-2 bg-[#991b1b] rounded-full ring-2 ring-white" />}
          </Link>

          <div className="h-5 w-px bg-[#e2e7e1]" />

          {/* Admin Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex items-center gap-2.5 p-1 rounded-[100px] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              <Avatar src={currentUser?.avatarUrl} alt={displayName} className="size-[34px] rounded-full object-cover shadow-xs" />
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[13px] font-semibold text-[#203c37] leading-tight">
                  {displayName}
                </span>
                <span className="text-[10px] text-[#74817b] leading-tight">
                  {roleLabel} ⌄
                </span>
              </div>
              <ChevronDown className="size-3.5 text-[#74817b] hidden md:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-[10px] border border-[#e2e7e1] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#e2e7e1]">
                  <p className="text-[13px] font-semibold text-[#203c37]">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-[#74817b]">
                    {currentUser?.email || "admin.test@rental.local"}
                  </p>
                </div>

                <Link
                  href="/admin/dashboard"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
                >
                  <Shield className="size-4" />
                  <span>Không gian quản trị</span>
                </Link>

                <Link
                  href="/rooms"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Search className="size-4 text-[#74817b]" />
                  <span>Tìm phòng & đọc bài</span>
                </Link>

                <Link
                  href="/admin/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Settings className="size-4 text-[#74817b]" />
                  <span>Cấu hình hệ thống</span>
                </Link>

                <Link
                  href="/tenant/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Settings className="size-4 text-[#74817b]" />
                  <span>Hồ sơ cá nhân</span>
                </Link>

                <Link
                  href="/admin/audit-logs"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Shield className="size-4 text-[#74817b]" />
                  <span>Nhật ký bảo mật</span>
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
        description={`Bạn có chắc chắn muốn kết thúc phiên làm việc của ${displayName}?`}
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
          Mọi hành động tác nghiệp trên bảng điều khiển Quản trị đều được ghi nhật
          ký an toàn. Vui lòng đảm bảo bạn đã lưu mọi thay đổi cấu hình.
        </p>
      </Modal>
    </>
  );
}
