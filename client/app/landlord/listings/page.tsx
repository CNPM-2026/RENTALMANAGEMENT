"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileText, Eye, CheckCircle2, Clock, XCircle, Search, Edit } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Post, PostStatus } from "@/types/models";

const STATUS_MAP: Record<PostStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Chờ duyệt", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
  APPROVED: { label: "Đang hiển thị", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  REJECTED: { label: "Từ chối", bg: "bg-[#fbeae6]", text: "text-[#a4422c]" },
  CLOSED: { label: "Đã đóng", bg: "bg-[#f7f6f2]", text: "text-[#74817b]" },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordListingsPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    apiClient.posts
      .getMyPosts()
      .then((data) => setPosts(data ?? []))
      .catch(() => setPosts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Tin đăng cho thuê</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý các bài đăng tìm khách thuê phòng trên nền tảng 5K-Rental Manager.</p>
        </div>
        <button
          onClick={() => alert("Mở form đăng tin mới")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Đăng tin mới</span>
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm bài đăng theo tiêu đề..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <FileText className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có bài đăng nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Đăng tin để tiếp cận hàng ngàn người đang tìm phòng trọ.</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                  <th className="py-3 px-4">Tiêu đề bài đăng</th>
                  <th className="py-3 px-4">Giá thuê</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Ngày đăng</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
                {filtered.map((post) => {
                  const st = STATUS_MAP[post.status] || STATUS_MAP.PENDING;
                  return (
                    <tr key={post.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium">
                        <Link href={`/rooms/${post.roomId}`} className="hover:text-[#15594f] hover:underline">
                          {post.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#15594f]">
                        {formatCurrency(post.room?.priceMonthly || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#74817b]">
                        {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/rooms/${post.roomId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15594f] hover:underline"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem tin</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
