import * as React from "react";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f7f6f2] text-[#203c37] font-sans antialiased">
      {/* Sidebar dùng usePathname() nên cần Suspense khi prerender (Next 16). */}
      <Suspense fallback={<aside className="w-[224px] shrink-0 min-h-screen bg-white border-r border-[#e2e7e1] hidden md:block" />}>
        <AdminSidebar />
      </Suspense>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* 72px Topbar */}
        <Suspense fallback={<header className="h-[72px] bg-white border-b border-[#e2e7e1] w-full" />}>
          <AdminTopbar />
        </Suspense>

        {/* Dynamic Screen Viewport Area */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
