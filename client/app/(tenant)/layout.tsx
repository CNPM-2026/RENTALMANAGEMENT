"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PublicNavbar } from "@/components/tenant/public-navbar";
import { Footer } from "@/components/tenant/footer";
import { PortalSidebar } from "@/components/tenant/portal-sidebar";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getCurrentUser, clearAuthSession } from "@/lib/auth";

function TenantLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutModalOpen, setLogoutModalOpen] = React.useState(false);

  const currentPath = pathname ?? "";

  // Check if current route is part of tenant personal portal (/tenant/*)
  const isPortalRoute = currentPath.startsWith("/tenant");

  // User session state
  const [currentUser, setCurrentUser] = React.useState<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatar?: string;
  } | null>(null);

  React.useEffect(() => {
    const handle = requestAnimationFrame(() => {
      try {
        const user = getCurrentUser();
        if (user) {
          setCurrentUser({
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            avatar: user.avatarUrl ?? undefined,
          });
        }
      } catch {
        // LocalStorage access failure fallback
      }
    });

    return () => cancelAnimationFrame(handle);
  }, [isPortalRoute]);

  function handleConfirmLogout() {
    clearAuthSession();
    setCurrentUser(null);
    setLogoutModalOpen(false);
    router.push("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f6f2] text-[#203c37]">
      {/* 1. Global Public / Portal Top Navbar (h-[88px]) */}
      <PublicNavbar
        currentUser={currentUser}
        onLogout={() => setLogoutModalOpen(true)}
      />

      {/* 2. Main Body Shell */}
      {isPortalRoute ? (
        // Two-column layout for Tenant Portal (/tenant/*)
        <div className="flex-1 flex max-w-[1440px] w-full mx-auto">
          {/* 236px Fixed Portal Sidebar */}
          <PortalSidebar onLogout={() => setLogoutModalOpen(true)} />

          {/* Portal Workspace Content Area */}
          <main className="flex-1 min-w-0 p-6 lg:p-8 bg-[#f7f6f2] overflow-y-auto">
            {children}
          </main>
        </div>
      ) : (
        // Full-width layout for Public marketing pages (/, /rooms, /roommates, /about)
        <main className="flex-1 min-w-0 w-full">{children}</main>
      )}

      {/* 3. Global Footer (Rendered on public pages) */}
      {!isPortalRoute && <Footer />}

      {/* 4. Logout Confirmation Dialog (Frame 44:62558) */}
      <Modal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        title="Xác nhận đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản 5K-Rental Manager hiện tại?"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLogoutModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleConfirmLogout}
            >
              Đăng xuất
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#74817b]">
          Phiên làm việc hiện tại của bạn sẽ kết thúc. Bạn sẽ cần nhập lại email
          và mật khẩu để truy cập tiếp các dữ liệu cá nhân.
        </p>
      </Modal>
    </div>
  );
}

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#f7f6f2]">{children}</div>}>
      <TenantLayoutContent>{children}</TenantLayoutContent>
    </React.Suspense>
  );
}
