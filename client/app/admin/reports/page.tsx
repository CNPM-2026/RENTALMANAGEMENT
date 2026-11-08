"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, MessageCircle, Trash2, Ban, CircleOff } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Report } from "@/types/models";

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = React.useState<Report[]>([]);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.reports.getAll({ status: "PENDING" }).then(setReports).catch(() => setReports([]));
  }, []);

  async function messageOwner(report: Report) {
    const ownerId = report.target?.author?.id;
    if (!ownerId) return;
    setProcessingId(report.id);
    try {
      const conversation = await apiClient.chats.getOrCreateConversation({ targetUserId: ownerId });
      router.push(`/admin/messages?conversation=${conversation.id}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể mở cuộc trò chuyện.");
      setProcessingId(null);
    }
  }

  const handleAction = async (report: Report, action: "DELETE_POST" | "BAN_USER" | "IGNORE") => {
    setProcessingId(report.id);
    try {
      const targetUserId = report.targetType === "POST" ? report.target?.author?.id : report.targetId;
      if (action === "DELETE_POST" && report.targetType === "POST") {
        await apiClient.admin.deletePost(report.targetId);
      } else if (action === "BAN_USER" && targetUserId) {
        await apiClient.admin.updateUserStatus(targetUserId, false);
      }
      await apiClient.reports.resolve(report.id, { status: "RESOLVED" });
      setReports((prev) => prev.filter((item) => item.id !== report.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể xử lý báo cáo.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo Vi phạm & Khiếu nại</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Tiếp nhận phản ánh từ cộng đồng người thuê về thông tin sai lệch, lừa đảo.</p>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <AlertTriangle className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có báo cáo nào tồn đọng</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Hệ thống đang vận hành an toàn và minh bạch.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((rep) => (
            <div key={rep.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[16px] text-[#203c37]">{rep.reason}</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fbeae6] text-[#a4422c]">
                    {rep.targetType === "POST" ? "Vi phạm tin đăng" : "Vi phạm người dùng"}
                  </span>
                </div>
                <p className="text-[13px] text-[#74817b]">
                  Đối tượng: {rep.targetType === "POST" ? (rep.reason === "FAKE_LISTING" ? "Fake listing" : rep.target?.title ?? rep.targetId) : rep.target?.fullName ?? rep.target?.email ?? rep.targetId}
                </p>
                {rep.targetType === "POST" && rep.target?.author && (
                  <p className="text-[12px] text-[#74817b]">Chủ tin: {rep.target.author.fullName ?? rep.target.author.email}</p>
                )}
                <p className="text-[11px] text-[#74817b]">
                  Người báo cáo: {rep.reporter?.fullName ?? rep.reporterId} • {new Date(rep.createdAt).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="border-t border-[#e2e7e1] pt-4">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[#74817b]">
                  <span className="size-6 rounded-full bg-[#15594f] text-white flex items-center justify-center">1</span>
                  Kiểm tra báo cáo
                  <span className="h-px flex-1 bg-[#e2e7e1]" />
                  <span className="size-6 rounded-full border border-[#e2e7e1] flex items-center justify-center">2</span>
                  Chọn hướng xử lý
                  <span className="h-px flex-1 bg-[#e2e7e1]" />
                  <span className="size-6 rounded-full border border-[#e2e7e1] flex items-center justify-center">3</span>
                  Xác minh
                </div>
                <div className="flex flex-wrap gap-2">
                  {rep.targetType === "POST" && <a href={`/rooms/${rep.targetId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#15594f]"><Eye className="size-3.5" />Xem bài</a>}
                  {rep.targetType === "POST" && rep.target?.author?.id && <button disabled={processingId === rep.id} onClick={() => void messageOwner(rep)} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#15594f] disabled:opacity-50"><MessageCircle className="size-3.5" />Nhắn chủ cho thuê</button>}
                  {rep.targetType === "POST" && <button disabled={processingId === rep.id} onClick={() => void handleAction(rep, "DELETE_POST")} className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#a4422c] px-3 py-2 text-[12px] font-semibold text-white"><Trash2 className="size-3.5" />Xóa bài</button>}
                  {(rep.targetType === "POST" || rep.targetType === "USER") && <button disabled={processingId === rep.id} onClick={() => void handleAction(rep, "BAN_USER")} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#a4422c] px-3 py-2 text-[12px] font-semibold text-[#a4422c]"><Ban className="size-3.5" />Ban tài khoản</button>}
                  <button disabled={processingId === rep.id} onClick={() => void handleAction(rep, "IGNORE")} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#74817b]"><CircleOff className="size-3.5" />Không làm gì</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
