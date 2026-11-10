"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, Check, X, Eye, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Post } from "@/types/models";
import { Modal } from "@/components/ui/modal";

export default function AdminListingModerationPage() {
  const [pendingPosts, setPendingPosts] = React.useState<Post[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Rejection modal state
  const [rejectingPostId, setRejectingPostId] = React.useState<string | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

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

  const handleModerate = async (id: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    try {
      setErrorMessage(null);
      await apiClient.admin.moderatePost(id, { status, reason });
      setRejectingPostId(null);
      setRejectReason("");
      loadPending();
    } catch {
      setErrorMessage("Không thể xử lý tin đăng. Vui lòng thử lại.");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Kiểm duyệt Tin đăng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Xét duyệt nội dung, hình ảnh và giá cả các bài đăng tìm khách thuê mới.</p>
      </div>
      {errorMessage && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}

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
                  href={`/rooms/${post.id}`}
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
                  onClick={() => {
                    setRejectingPostId(post.id);
                    setRejectReason("");
                  }}
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

      {/* Reject Reason Modal */}
      <Modal
        isOpen={Boolean(rejectingPostId)}
        onClose={() => setRejectingPostId(null)}
        title="Từ chối duyệt bài đăng"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#74817b]">
            Vui lòng nhập hoặc chọn lý do từ chối bài đăng này để thông báo cho người đăng.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {[
              "Hình ảnh không rõ ràng / mờ",
              "Giá phòng hoặc thông tin chưa chính xác",
              "Nội dung mô tả không đầy đủ",
              "Vi phạm tiêu chuẩn cộng đồng",
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRejectReason(preset)}
                className="rounded-md border border-[#e2e7e1] bg-[#f7f6f2] px-2.5 py-1 text-xs text-[#203c37] hover:border-[#15594f] transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Nhập lý do chi tiết..."
            className="w-full rounded-lg border border-[#e2e7e1] p-2.5 text-xs outline-none focus:border-[#a4422c]"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-[#e2e7e1]">
            <button
              type="button"
              onClick={() => setRejectingPostId(null)}
              className="rounded-lg border border-[#e2e7e1] px-4 py-2 text-xs font-semibold text-[#74817b] hover:bg-[#f7f6f2]"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={isRejecting}
              onClick={() => {
                if (rejectingPostId) {
                  setIsRejecting(true);
                  handleModerate(rejectingPostId, "REJECTED", rejectReason.trim() || undefined);
                }
              }}
              className="rounded-lg bg-[#a4422c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#883522] disabled:opacity-50 cursor-pointer"
            >
              {isRejecting ? "Đang xử lý..." : "Xác nhận từ chối"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
