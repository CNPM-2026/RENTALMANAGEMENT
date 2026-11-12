import * as React from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";

/**
 * Không gian của THỢ ĐỘC LẬP (role = STAFF).
 *
 * Cố tình tách khỏi layout của chủ trọ: thợ không thuộc bất kỳ chủ trọ nào, nên
 * không có sidebar quản lý tài sản/phòng/hợp đồng.
 */
export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f7f6f2]">
      <header className="h-16 bg-white border-b border-[#e2e7e1] flex items-center justify-between gap-4 px-4 md:px-6">
        <Link href="/staff/profile" className="flex items-center gap-2.5">
          <span className="size-8 rounded-[8px] bg-[#15594f] text-white flex items-center justify-center">
            <Wrench className="size-4" />
          </span>
          <span className="text-[15px] font-semibold text-[#203c37]">Không gian thợ</span>
        </Link>

        <nav className="flex items-center gap-1.5 text-[13px]">
          <Link
            href="/staff/profile"
            className="px-3 py-1.5 rounded-[7px] font-semibold text-[#15594f] hover:bg-[#eaf2ed]"
          >
            Hồ sơ &amp; kỹ năng
          </Link>
          <Link
            href="/staff/kyc"
            className="px-3 py-1.5 rounded-[7px] text-[#74817b] hover:bg-[#f7f6f2] hover:text-[#203c37]"
          >
            Xác minh CCCD
          </Link>
          <Link
            href="/"
            className="px-3 py-1.5 rounded-[7px] text-[#74817b] hover:bg-[#f7f6f2] hover:text-[#203c37]"
          >
            Về trang chủ
          </Link>
        </nav>
      </header>

      <main className="p-4 md:p-6">
        <div className="max-w-[1100px] mx-auto">{children}</div>
      </main>
    </div>
  );
}