"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  Shield,
  FileCheck,
  CheckCircle2,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { clearAuthSession } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { Notification } from "@/types/models";

export function AdminTopbar() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const router = useRouter();

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notiOpen, setNotiOpen] = React.useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);

  // Load Admin notifications
  React.useEffect(() => {
    let isMounted = true;
    apiClient.notifications
      .getMy()
      .then((data: Notification[]) => {
        if (!isMounted) return;
        const list = data || [];
        setNotifications(list);
        setUnreadCount(list.filter((n: Notification) => !n.isRead).length);
      })
      .catch(() => {
        // Fallback default notification for admin
        if (isMounted) {
          setNotifications([
            {
              id: "admin-noti-1",
              userId: "admin",
              title: "Tin đăng mới chờ duyệt",
              content: "Chủ trọ vừa đăng bài mới. Vui lòng kiểm duyệt nội dung trước khi hiển thị.",
              type: "MESSAGE" as any,
              referenceId: "mod-1",
              isRead: false,
              createdAt: new Date().toISOString(),
            },
          ]);
          setUnreadCount(1);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  function handleNotificationClick(noti: Notification) {
    setNotiOpen(false);
    // Mark as read in background
    apiClient.notifications.markAsRead(noti.id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === noti.id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    // Redirect to the appropriate moderation page
    if (
      noti.title?.toLowerCase().includes("duyệt") ||
      noti.title?.toLowerCase().includes("tin đăng") ||
      noti.content?.toLowerCase().includes("duyệt")
    ) {
      router.push("/admin/moderation/listings");
    } else {
      router.push("/admin/moderation/listings");
    }
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

          {/* Admin Notification Bell with Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setNotiOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              title="Thông báo kiểm duyệt & Hệ thống"
              className="relative size-9 rounded-full flex items-center justify-center text-[#74817b] hover:text-[#15594f] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              <Bell className="size-4.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 size-2.5 bg-[#991b1b] rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            {/* Notification Dropdown */}
            {notiOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-[12px] border border-[#e2e7e1] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-[#e2e7e1] flex items-center justify-between bg-[#fbfbfa]">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-[#15594f]" />
                    <span className="text-[14px] font-bold text-[#203c37]">
                      Thông báo Admin
                    </span>
                  </div>
                  <Link
                    href="/admin/moderation/listings"
                    onClick={() => setNotiOpen(false)}
                    className="text-[12px] font-semibold text-[#15594f] hover:underline"
                  >
                    Trang duyệt tin
                  </Link>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#e2e7e1]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[13px] text-[#74817b]">
                      Không có thông báo mới.
                    </div>
                  ) : (
                    notifications.map((noti) => (
                      <div
                        key={noti.id}
                        onClick={() => handleNotificationClick(noti)}
                        className={`p-3.5 hover:bg-[#f7f6f2] cursor-pointer transition-colors text-left space-y-1 ${
                          !noti.isRead ? "bg-[#f0f9ff]/50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-[#203c37] flex items-center gap-1.5">
                            <FileCheck className="size-3.5 text-[#15594f] shrink-0" />
                            {noti.title}
                          </span>
                          {!noti.isRead && (
                            <span className="size-2 rounded-full bg-[#15594f] shrink-0" />
                          )}
                        </div>
                        <p className="text-[12px] text-[#556961] leading-relaxed line-clamp-2">
                          {noti.content}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-[#74817b]">
                            {new Date(noti.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} • {new Date(noti.createdAt).toLocaleDateString("vi-VN")}
                          </span>
                          <span className="text-[11px] font-semibold text-[#15594f] hover:underline inline-flex items-center gap-1">
                            Duyệt bài <ExternalLink className="size-2.5" />
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-[#fbfbfa] border-t border-[#e2e7e1] text-center">
                  <Link
                    href="/admin/moderation/listings"
                    onClick={() => setNotiOpen(false)}
                    className="block w-full py-1.5 rounded-[6px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] transition-colors"
                  >
                    Xem tất cả bài đăng chờ duyệt
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-[#e2e7e1]" />

          {/* Admin Profile Pill */}
          <div className="relative">
            <button
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotiOpen(false);
              }}
              className="flex items-center gap-2.5 p-1 rounded-[100px] hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              <div className="bg-[#15594f] text-white rounded-full size-[34px] text-[11px] font-bold flex items-center justify-center shadow-xs">
                AD
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-[13px] font-semibold text-[#203c37] leading-tight">
                  Quản trị viên Cấp cao
                </span>
                <span className="text-[10px] text-[#74817b] leading-tight">
                  Super Admin ⌄
                </span>
              </div>
              <ChevronDown className="size-3.5 text-[#74817b] hidden md:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-[10px] border border-[#e2e7e1] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-[#e2e7e1]">
                  <p className="text-[13px] font-semibold text-[#203c37]">
                    Quản trị viên Cấp cao
                  </p>
                  <p className="text-[11px] text-[#74817b]">
                    admin@5krental.vn
                  </p>
                </div>

                <Link
                  href="/admin/moderation/listings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <ClipboardList className="size-4 text-[#15594f]" />
                  <span>Kiểm duyệt tin đăng</span>
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
                  href="/admin/audit-logs"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#203c37] hover:bg-[#f7f6f2]"
                >
                  <Shield className="size-4 text-[#74817b]" />
                  <span>Nhật ký hoạt động</span>
                </Link>

                <div className="h-px bg-[#e2e7e1] my-1" />

                <button
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[12px] text-[#991b1b] hover:bg-[#fbeae6] transition-colors cursor-pointer text-left"
                >
                  <LogOut className="size-4" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Xác nhận đăng xuất quản trị"
        description="Bạn có chắc chắn muốn kết thúc phiên làm việc quản trị viên không?"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleLogout}
              className="bg-[#991b1b] hover:bg-[#7f1d1d] text-white"
            >
              Đăng xuất
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-[#74817b]">
          Các thay đổi chưa lưu trên bảng điều khiển sẽ không bị ảnh hưởng. Bạn có thể đăng nhập lại bất cứ lúc nào.
        </p>
      </Modal>
    </>
  );
}
