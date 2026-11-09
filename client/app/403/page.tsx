"use client";

import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] flex items-center justify-center px-6">
      <div className="max-w-md rounded-[16px] border border-[#e2e7e1] bg-white p-8 text-center shadow-sm">
        <p className="text-6xl font-extrabold text-[#15594f]">403</p>
        <h1 className="mt-4 text-2xl font-bold text-[#203c37]">Bạn không có quyền truy cập</h1>
        <p className="mt-2 text-sm text-[#74817b]">
          Tài khoản hiện tại không được phép thực hiện thao tác hoặc xem nội dung này.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-[8px] bg-[#15594f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124b42]">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
