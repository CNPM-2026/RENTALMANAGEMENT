import * as React from "react";
import { Suspense } from "react";
import { StaffSidebar } from "@/components/staff/sidebar";
import { StaffTopbar } from "@/components/staff/topbar";

/**
 * Không gian của THỢ ĐỘC LẬP (role = STAFF).
 *
 * Cùng mô hình portal với chủ trọ/quản trị/khách thuê: sidebar cố định cho các
 * nhóm "Việc làm", "Hồ sơ & kỹ năng", "Xác minh CCCD", thông báo. Thợ không
 * thuộc bất kỳ chủ trọ nào nên không có menu quản lý tài sản/phòng/hợp đồng.
 */
export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#f7f6f2] text-[#203c37] font-sans antialiased">
      {/* Sidebar dùng usePathname() nên cần Suspense khi prerender (Next 16). */}
      <Suspense
        fallback={
          <aside className="w-[224px] shrink-0 min-h-screen bg-white border-r border-[#e2e7e1]" />
        }
      >
        <StaffSidebar />
      </Suspense>

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Topbar dùng usePathname() nên cần Suspense khi prerender (Next 16). */}
        <Suspense
          fallback={<header className="h-[72px] bg-white border-b border-[#e2e7e1] w-full" />}
        >
          <StaffTopbar />
        </Suspense>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
