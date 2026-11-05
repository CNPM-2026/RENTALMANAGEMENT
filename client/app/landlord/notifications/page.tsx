"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Calendar, CheckCheck, ChevronRight, FileText, MessageSquare, Receipt } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Notification, NotificationType } from "@/types/models";
import { formatDate } from "@/lib/utils";

function icon(type: NotificationType) {
  const Icon = type === "MESSAGE" ? MessageSquare : type === "APPOINTMENT" ? Calendar : type === "INVOICE" ? Receipt : FileText;
  return <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eaf2ed] text-[#15594f]"><Icon className="size-5" /></div>;
}

function target(type: NotificationType, referenceId?: string | null) {
  if (type === "MESSAGE") return referenceId ? `/landlord/messages?conversation=${encodeURIComponent(referenceId)}` : "/landlord/messages";
  if (type === "APPOINTMENT") return "/landlord/calendar";
  if (type === "INVOICE") return "/landlord/invoices";
  return "/landlord/contracts";
}

export default function LandlordNotificationsPage() {
  const [items, setItems] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.notifications.getMy().then(setItems).catch(() => setError("Không tải được thông báo.")).finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    try {
      await apiClient.notifications.markAsRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, isRead: true } : item));
    } catch {
      setError("Không thể cập nhật trạng thái thông báo.");
    }
  }

  async function markAll() {
    try {
      await apiClient.notifications.markAllAsRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch {
      setError("Không thể đánh dấu tất cả thông báo.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-[12px] text-[#74817b]">Vận hành</p><h1 className="mt-1 text-[28px] font-semibold text-[#203c37]">Thông báo</h1><p className="mt-1 text-[14px] text-[#74817b]">Theo dõi lịch hẹn, hợp đồng và trao đổi mới.</p></div>
        {items.some((item) => !item.isRead) && <button onClick={markAll} className="inline-flex items-center gap-2 rounded-[8px] border border-[#e2e7e1] bg-white px-4 py-2 text-[13px] font-semibold text-[#15594f]"><CheckCheck className="size-4" />Đánh dấu đã đọc</button>}
      </div>
      {error && <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-sm text-[#a4422c]">{error}</div>}
      <div className="overflow-hidden rounded-[12px] border border-[#e2e7e1] bg-white shadow-sm">
        {loading ? <div className="p-10 text-center text-sm text-[#74817b]">Đang tải thông báo...</div> : items.length === 0 ? <div className="p-14 text-center"><Bell className="mx-auto size-10 text-[#9bb5a8]" /><p className="mt-3 font-semibold text-[#203c37]">Chưa có thông báo</p><p className="mt-1 text-sm text-[#74817b]">Thông báo mới sẽ xuất hiện tại đây.</p></div> : items.map((item) => (
          <div key={item.id} onClick={() => markRead(item.id)} className={`flex items-start gap-4 border-b border-[#eef3ef] p-5 last:border-0 ${!item.isRead ? "bg-[#eaf2ed]/30" : ""}`}>
            {icon(item.type)}
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-semibold text-[#203c37]">{item.title}</h2>{!item.isRead && <span className="size-2 rounded-full bg-[#15594f]" />}</div><p className="mt-1 text-sm leading-6 text-[#74817b]">{item.content}</p><div className="mt-2 flex items-center justify-between text-xs text-[#74817b]"><span>{formatDate(item.createdAt, "datetime")}</span><Link href={target(item.type, item.referenceId)} onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1 font-semibold text-[#15594f]">Xem chi tiết <ChevronRight className="size-3.5" /></Link></div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
