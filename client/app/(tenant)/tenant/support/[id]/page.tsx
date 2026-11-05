"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  HelpCircle,
  Clock,
  Send,
  Paperclip,
  CheckCircle2,
  FileImage,
  User,
  ShieldCheck,
  ChevronLeft,
  XCircle,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { apiClient } from "@/lib/api";
import { SupportTicket } from "@/types/models";

interface ThreadMessage {
  id: string;
  senderName: string;
  senderRole: "TENANT" | "SUPPORT" | "LANDLORD";
  avatarUrl?: string;
  time: string;
  content: string;
  attachments?: string[];
}

function TenantTicketDetailContent() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params?.id as string;
  const [ticket, setTicket] = React.useState<SupportTicket | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [closeModalOpen, setCloseModalOpen] = React.useState(false);
  const [ticketStatus, setTicketStatus] = React.useState<"PROCESSING" | "RESOLVED">("PROCESSING");
  const [replyText, setReplyText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [thread, setThread] = React.useState<ThreadMessage[]>([]);

  React.useEffect(() => {
    apiClient.support.getById(ticketId).then((loaded) => {
      setTicket(loaded);
      setTicketStatus(loaded.status === "RESOLVED" || loaded.status === "CLOSED" ? "RESOLVED" : "PROCESSING");
      setThread([
        { id: `${loaded.id}-description`, senderName: loaded.user?.fullName ?? "Người thuê", senderRole: "TENANT", time: new Date(loaded.createdAt).toLocaleString("vi-VN"), content: loaded.description },
        ...(loaded.adminReply ? [{ id: `${loaded.id}-reply`, senderName: "Bộ phận hỗ trợ", senderRole: "SUPPORT" as const, time: new Date(loaded.updatedAt).toLocaleString("vi-VN"), content: loaded.adminReply }] : []),
      ]);
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Không tải được yêu cầu hỗ trợ."));
  }, [ticketId]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (!ticket) return;
    setIsSubmitting(true);
    apiClient.support.update(ticket.id, { adminReply: replyText.trim() })
      .then((updated) => {
        setTicket(updated);
        setThread((prev) => [...prev, { id: `${updated.id}-${Date.now()}`, senderName: updated.user?.fullName ?? "Người thuê", senderRole: "TENANT", time: "Vừa xong", content: replyText.trim() }]);
        setReplyText("");
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Không thể gửi phản hồi."))
      .finally(() => setIsSubmitting(false));
  };

  const handleConfirmClose = () => {
    if (!ticket) return;
    apiClient.support.update(ticket.id, { status: "RESOLVED" }).then((updated) => {
      setTicket(updated);
      setTicketStatus("RESOLVED");
      setCloseModalOpen(false);
    }).catch((error) => setLoadError(error instanceof Error ? error.message : "Không thể đóng yêu cầu."));
  };

  return (
    <div className="space-y-6 max-w-[1204px]">
      {loadError && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
        <Link href="/tenant/support" className="hover:text-[#15594f] flex items-center gap-1 transition-colors">
          <ChevronLeft className="size-4" />
          Quay lại danh sách yêu cầu
        </Link>
        <span>/</span>
        <span className="text-[#203c37] font-medium">#{ticketId}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[13px] font-bold text-[#15594f] bg-[#eaf2ed] px-2.5 py-0.5 rounded-[4px]">
              #{ticketId}
            </span>
            <h1 className="text-[22px] font-bold text-[#203c37] tracking-tight">
              {ticket?.subject ?? "Yêu cầu hỗ trợ"}
            </h1>
          </div>
          <p className="text-[13px] text-[#74817b] mt-1">
            {ticket?.roomId ? `Phòng: ${ticket.roomId} • ` : ""}Danh mục: {ticket?.category ?? "Chưa phân loại"}
          </p>
        </div>

        <Badge variant={ticketStatus === "PROCESSING" ? "info" : "success"} size="md">
          {ticketStatus === "PROCESSING" ? "Đang xử lý sự cố" : "Đã hoàn thành"}
        </Badge>
      </div>

      {/* 2-Column Split: Conversation Left + Ticket Status Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Response Thread (Figma 44:66721 - 788px) */}
        <div className="lg:col-span-8 space-y-5">
          {thread.map((item) => (
            <Card
              key={item.id}
              className={`border rounded-[12px] p-5 shadow-sm space-y-3 ${
                item.senderRole === "SUPPORT"
                  ? "bg-[#eaf2ed]/40 border-[#15594f]/30"
                  : "bg-white border-[#e2e7e1]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#e2e7e1]/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="size-7 rounded-full bg-[#15594f] text-white flex items-center justify-center text-[11px] font-bold">
                    {item.senderRole === "SUPPORT" ? "KT" : "LN"}
                  </div>
                  <strong className="text-[14px] text-[#203c37]">{item.senderName}</strong>
                </div>
                <span className="text-[12px] text-[#74817b]">{item.time}</span>
              </div>

              <p className="text-[14px] text-[#203c37] leading-relaxed">{item.content}</p>

              {/* Attachments */}
              {item.attachments && item.attachments.length > 0 && (
                <div className="pt-2">
                  {item.attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-white border border-[#e2e7e1] text-[12px] text-[#15594f]"
                    >
                      <FileImage className="size-4" />
                      <span>{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}

          {/* Reply Box (Figma 44:66744) */}
          {ticketStatus === "PROCESSING" ? (
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm space-y-3">
              <h4 className="text-[15px] font-bold text-[#203c37]">Gửi phản hồi bổ sung</h4>
              <form onSubmit={handleSendReply} className="space-y-3">
                <textarea
                  rows={4}
                  placeholder="Nhập thông tin phản hồi bổ sung cho kỹ thuật viên..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full p-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
                  required
                />
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" size="sm" leftIcon={<Paperclip className="size-4" />}>
                    Đính kèm tệp
                  </Button>
                  <Button type="submit" variant="primary" size="sm" leftIcon={<Send className="size-4" />}>
                    Gửi phản hồi
                  </Button>
                </div>
              </form>
            </Card>
          ) : (
            <div className="bg-[#eaf2ed] border border-[#15594f]/20 rounded-[12px] p-4 text-center text-[13px] text-[#15594f] font-semibold">
              Phiếu hỗ trợ này đã được đóng và giải quyết thành công.
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Ticket Meta & Actions (Figma 44:66757 - 320px) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm space-y-4">
            <h3 className="text-[16px] font-bold text-[#203c37]">Thông tin phiếu hỗ trợ</h3>

            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between py-1 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Mã phiếu:</span>
                <strong className="text-[#15594f]">#{ticketId}</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Trạng thái:</span>
                <span className="font-semibold text-sky-700">
                  {ticketStatus === "PROCESSING" ? "Đang xử lý" : "Đã hoàn thành"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Phụ trách xử lý:</span>
                <strong className="text-[#203c37]">Trần Văn Bình (Kỹ thuật)</strong>
              </div>
              <div className="flex justify-between py-1 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Thời gian gửi:</span>
                <span className="text-[#203c37]">10:15 08/10/2026</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#74817b]">SĐT liên hệ:</span>
                <span className="text-[#203c37]">0987.654.321</span>
              </div>
            </div>

            {ticketStatus === "PROCESSING" && (
              <div className="pt-2 space-y-2">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full text-[#15594f] hover:bg-[#eaf2ed]"
                  onClick={() => setCloseModalOpen(true)}
                  leftIcon={<CheckCircle2 className="size-4" />}
                >
                  Đóng yêu cầu hỗ trợ
                </Button>
              </div>
            )}
          </Card>

          <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[12px] p-4 text-[12px] text-[#203c37] space-y-1.5">
            <strong className="block text-[#15594f]">Lưu ý từ ban quản lý:</strong>
            <p className="text-[#74817b]">
              Sau khi kỹ thuật viên xử lý xong tại phòng, bạn vui lòng kiểm tra kỹ thiết bị trước khi nhấn &ldquo;Đóng yêu cầu hỗ trợ&rdquo; để hệ thống lưu vào lịch sử bảo trì.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Đóng ticket */}
      <Modal
        isOpen={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        title="Xác nhận hoàn tất và đóng yêu cầu"
        description="Bạn có chắc chắn rằng sự cố điều hòa phòng 302 đã được khắc phục hoàn toàn?"
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCloseModalOpen(false)}>
              Chưa, để sau
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmClose}>
              Xác nhận đã khắc phục
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#74817b]">
          Sau khi đóng phiếu, trạng thái sự cố sẽ chuyển thành &ldquo;Đã giải quyết&rdquo;. Nếu sự cố tái diễn, bạn có thể mở lại hoặc tạo phiếu mới.
        </p>
      </Modal>
    </div>
  );
}

export default function TenantTicketDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải chi tiết yêu cầu...
        </div>
      }
    >
      <TenantTicketDetailContent />
    </React.Suspense>
  );
}