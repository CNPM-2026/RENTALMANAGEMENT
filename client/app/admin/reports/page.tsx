"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Flag, MessageCircle, Trash2, Ban, Paperclip } from "lucide-react";
import { apiClient, resolveMediaUrl } from "@/lib/api";
import { translateDisputeCategory, translateDisputeStatus } from "@/lib/labels";
import type { Report, ReportStatus } from "@/types/models";

const STATUS_TABS: Array<{ value: ReportStatus | "ALL"; label: string }> = [
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "UNDER_REVIEW", label: "Đang xem xét" },
  { value: "RESOLVED", label: "Đã giải quyết" },
  { value: "REJECTED", label: "Đã bác bỏ" },
  { value: "ALL", label: "Tất cả" },
];

/**
 * Hàng đợi TRANH CHẤP của admin (Batch 4).
 *
 * - Server yêu cầu KẾT LUẬN (`resolution`) khi RESOLVED/REJECTED; nút xử lý ở đây
 *   luôn gửi kèm nội dung admin nhập, không có "đóng im lặng".
 * - Khoá tài khoản là hành động RIÊNG, không tự động xảy ra khi giải quyết tranh chấp.
 * - CAS phía server: báo cáo đã được admin khác xử lý → 409, danh sách được tải lại.
 */
export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = React.useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<ReportStatus | "ALL">("PENDING");
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [resolutions, setResolutions] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (status: ReportStatus | "ALL") => {
    try {
      const items = await apiClient.reports.getAll(status === "ALL" ? undefined : { status });
      setReports(items ?? []);
      setError(null);
    } catch (err) {
      setReports([]);
      setError(err instanceof Error ? err.message : "Không tải được danh sách báo cáo.");
    }
  }, []);

  React.useEffect(() => {
    // Tải danh sách theo bộ lọc; setState nằm trong callback async (không đồng bộ
    // trong thân effect) để tránh render dây chuyền.
    let active = true;
    apiClient.reports
      .getAll(statusFilter === "ALL" ? undefined : { status: statusFilter })
      .then((items) => {
        if (!active) return;
        setReports(items ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReports([]);
        setError(err instanceof Error ? err.message : "Không tải được danh sách báo cáo.");
      });
    return () => {
      active = false;
    };
  }, [statusFilter]);

  async function messageOwner(report: Report) {
    const ownerId = report.target?.author?.id;
    if (!ownerId) return;
    setProcessingId(report.id);
    try {
      const conversation = await apiClient.chats.getOrCreateConversation({ targetUserId: ownerId });
      router.push(`/admin/messages?conversation=${conversation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể mở cuộc trò chuyện.");
      setProcessingId(null);
    }
  }

  const resolve = async (report: Report, status: ReportStatus) => {
    const resolution = (resolutions[report.id] ?? "").trim();
    if ((status === "RESOLVED" || status === "REJECTED") && resolution.length < 10) {
      setError("Cần nêu kết luận ít nhất 10 ký tự trước khi giải quyết hoặc bác bỏ.");
      return;
    }
    setProcessingId(report.id);
    setError(null);
    try {
      await apiClient.reports.resolve(report.id, {
        status,
        ...(resolution ? { resolution } : {}),
      });
      setReports((prev) =>
        statusFilter === "ALL"
          ? prev.map((item) => (item.id === report.id ? { ...item, status, resolution } : item))
          : prev.filter((item) => item.id !== report.id),
      );
      setResolutions((prev) => ({ ...prev, [report.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xử lý báo cáo.");
      void load(statusFilter);
    } finally {
      setProcessingId(null);
    }
  };

  const deleteTargetPost = async (report: Report) => {
    // Kiểm tra kết luận TRƯỚC khi xoá bài: tránh trường hợp bài đã bị xoá nhưng
    // hồ sơ không đóng được vì thiếu kết luận (server bắt buộc `resolution`).
    const resolution = (resolutions[report.id] ?? "").trim();
    if (resolution.length < 10) {
      setError("Cần nêu kết luận ít nhất 10 ký tự trước khi xoá bài và đóng hồ sơ.");
      return;
    }
    setProcessingId(report.id);
    try {
      await apiClient.admin.deletePost(report.targetId);
      await resolve(report, "RESOLVED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xoá bài đăng.");
    } finally {
      setProcessingId(null);
    }
  };

  const banTargetUser = async (report: Report) => {
    const targetUserId = report.targetType === "POST" ? report.target?.author?.id : report.targetId;
    if (!targetUserId) return;
    setProcessingId(report.id);
    try {
      await apiClient.admin.updateUserStatus(targetUserId, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khoá tài khoản.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Báo cáo Vi phạm & Tranh chấp</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Báo cáo tin đăng, người dùng và tranh chấp công việc bảo trì. Kết luận là bắt buộc khi đóng hồ sơ.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer ${
              statusFilter === tab.value
                ? "bg-[#15594f] text-white"
                : "border border-[#e2e7e1] bg-white text-[#74817b] hover:bg-[#f5f8f6]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {reports.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <AlertTriangle className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có báo cáo nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Không có hồ sơ ở trạng thái đã chọn.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((rep) => {
            const resolution = resolutions[rep.id] ?? "";
            const busy = processingId === rep.id;
            return (
              <div key={rep.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-[15px] text-[#203c37]">
                      <Flag className="size-4 text-[#a4422c]" />
                      {translateDisputeCategory(rep.category)}
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#fbeae6] text-[#a4422c]">
                      {translateDisputeStatus(rep.status)}
                    </span>
                    <span className="text-[11px] text-[#74817b]">
                      Đối tượng: {rep.targetType === "TASK" ? "công việc" : rep.targetType === "POST" ? "tin đăng" : rep.targetType === "ROOM" ? "phòng" : "người dùng"}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#203c37] whitespace-pre-line">{rep.reason}</p>
                  <p className="text-[12px] text-[#74817b]">
                    {rep.task
                      ? `Công việc: ${rep.task.title}`
                      : rep.targetType === "POST"
                        ? `Tin đăng: ${rep.target?.title ?? rep.targetId}`
                        : rep.target?.fullName ?? rep.target?.email ?? rep.targetId}
                  </p>
                  <p className="text-[11px] text-[#74817b]">
                    Người báo cáo: {rep.reporter?.fullName ?? rep.reporterId} • {new Date(rep.createdAt).toLocaleString("vi-VN")}
                  </p>
                  {rep.resolution && (
                    <p className="text-[12px] text-[#15594f]">
                      Kết luận{rep.resolvedBy?.fullName ? ` (${rep.resolvedBy.fullName})` : ""}: {rep.resolution}
                    </p>
                  )}
                </div>



                {rep.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {rep.attachments.map((attachment) => {
                      const url = resolveMediaUrl(attachment.url);
                      if (!url) return null;
                      return (
                        <a
                          key={attachment.id}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-[6px] border border-[#e2e7e1] px-2 py-1 text-[11px] text-[#15594f] hover:bg-[#f5f8f6]"
                        >
                          <Paperclip className="size-3" /> Bằng chứng
                        </a>
                      );
                    })}
                  </div>
                ) : null}

                <div className="border-t border-[#e2e7e1] pt-3 space-y-2">
                  <textarea
                    value={resolution}
                    onChange={(event) => setResolutions((prev) => ({ ...prev, [rep.id]: event.target.value }))}
                    rows={2}
                    maxLength={2000}
                    placeholder="Kết luận xử lý (bắt buộc khi giải quyết/bác bỏ, ít nhất 10 ký tự)"
                    className="w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] outline-none focus:border-[#15594f]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {rep.task && (
                      <a href={`/admin/support?task=${rep.task.id}`} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#15594f]">
                        <Eye className="size-3.5" />Xem công việc
                      </a>
                    )}
                    {rep.targetType === "POST" && (
                      <a href={`/rooms/${rep.targetId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#15594f]">
                        <Eye className="size-3.5" />Xem bài
                      </a>
                    )}
                    {rep.targetType === "POST" && rep.target?.author?.id && (
                      <button disabled={busy} onClick={() => void messageOwner(rep)} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#15594f] disabled:opacity-50 cursor-pointer">
                        <MessageCircle className="size-3.5" />Nhắn chủ tin
                      </button>
                    )}
                    {rep.status === "PENDING" && (
                      <button disabled={busy} onClick={() => void resolve(rep, "UNDER_REVIEW")} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#2a4d8f] disabled:opacity-50 cursor-pointer">
                        Nhận xử lý
                      </button>
                    )}
                    {rep.status !== "RESOLVED" && rep.status !== "REJECTED" && (
                      <>
                        <button disabled={busy} onClick={() => void resolve(rep, "RESOLVED")} className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#15594f] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50 cursor-pointer">
                          Giải quyết
                        </button>
                        <button disabled={busy} onClick={() => void resolve(rep, "REJECTED")} className="inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-2 text-[12px] font-semibold text-[#74817b] disabled:opacity-50 cursor-pointer">
                          Bác bỏ
                        </button>
                      </>
                    )}
                    {rep.targetType === "POST" && (
                      <button disabled={busy} onClick={() => void deleteTargetPost(rep)} className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#a4422c] px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50 cursor-pointer">
                        <Trash2 className="size-3.5" />Xoá bài & kết luận
                      </button>
                    )}
                    <button disabled={busy} onClick={() => void banTargetUser(rep)} className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#a4422c] px-3 py-2 text-[12px] font-semibold text-[#a4422c] disabled:opacity-50 cursor-pointer">
                      <Ban className="size-3.5" />Khoá tài khoản
                    </button>
                  </div>
                  <p className="text-[11px] text-[#74817b]">
                    Khoá tài khoản là hành động riêng và không tự động xảy ra khi kết luận tranh chấp.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
