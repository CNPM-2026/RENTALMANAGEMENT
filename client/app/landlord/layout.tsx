import * as React from "react";
import { Suspense } from "react";
import { LandlordSidebar } from "@/components/landlord/sidebar";
import { LandlordTopbar } from "@/components/landlord/topbar";

export default function LandlordLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col md:flex-row">
      {/* Sidebar được bọc Suspense để tránh crash khi dùng usePathname() lúc prerender */}
      <Suspense fallback={<aside className="w-64 bg-white border-r border-[#e2e7e1] h-screen hidden md:block animate-pulse" />}>
        <LandlordSidebar />
      </Suspense>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar được bọc Suspense */}
        <Suspense fallback={<header className="h-16 bg-white border-b border-[#e2e7e1] w-full animate-pulse" />}>
          <LandlordTopbar />
        </Suspense>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}