"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, Check, X, Eye, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Post } from "@/types/models";

export default function AdminListingModerationPage() {
  const [pendingPosts, setPendingPosts] = React.useState<Post[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadPending = React.useCallback(() => {
    apiClient.admin
      .getPendingPosts()
      .then((posts) => setPendingPosts(posts ?? []))
      .catch(() => setPendingPosts([]))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadPending();
  }, [loadPending]);

  const handleModerate = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await apiClient.admin.moderatePost(id, { status });
      loadPending();
    } catch {
      alert("Xử lý thất bại");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Kiểm duyệt Tin đăng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Xét duyệt nội dung, hình ảnh và giá cả các bài đăng tìm khách thuê mới.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : pendingPosts.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <ClipboardCheck className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có tin chờ duyệt</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Tất cả bài đăng mới đều đã được xử lý.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map((post) => (
            <div
              key={post.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <h3 className="text-[16px] font-semibold text-[#203c37]">{post.title}</h3>
                <p className="text-[13px] text-[#74817b] line-clamp-2">{post.description}</p>
                <p className="text-[11px] text-[#74817b]">
                  Đăng bởi chủ trọ • Ngày gửi: {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/rooms/${post.roomId}`}
                  className="px-3 py-2 rounded-[8px] border border-[#e2e7e1] text-[#203c37] text-[12px] font-semibold hover:bg-[#f7f6f2] transition-colors"
                >
                  <Eye className="size-3.5 inline mr-1" />
                  Xem trước
                </Link>
                <button
                  onClick={() => handleModerate(post.id, "APPROVED")}
                  className="px-3.5 py-2 rounded-[8px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] cursor-pointer"
                >
                  <Check className="size-3.5 inline mr-1" />
                  Duyệt tin
                </button>
                <button
                  onClick={() => handleModerate(post.id, "REJECTED")}
                  className="px-3.5 py-2 rounded-[8px] border border-[#e2e7e1] text-[#a4422c] hover:bg-[#fbeae6] text-[12px] font-semibold cursor-pointer"
                >
                  <X className="size-3.5 inline mr-1" />
                  Từ chối
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
