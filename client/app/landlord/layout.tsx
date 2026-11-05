import * as React from "react";
import { LandlordSidebar } from "@/components/landlord/sidebar";
import { LandlordTopbar } from "@/components/landlord/topbar";

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f7f6f2] text-[#203c37] font-sans antialiased">
      {/* Fixed 224px Landlord Sidebar */}
      <LandlordSidebar />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* 72px Topbar */}
        <LandlordTopbar />

        {/* Dynamic Screen Viewport Area */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
