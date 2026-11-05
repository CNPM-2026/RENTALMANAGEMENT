"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Building2,
  Users,
  Send,
  Paperclip,
  Smile,
  Phone,
  MoreVertical,
  CalendarCheck,
  Home,
  CheckCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  isMe: boolean;
}

interface ChatThread {
  id: string;
  targetId: string;
  name: string;
  role: "LANDLORD" | "ROOMMATE";
  avatarUrl: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  online: boolean;
  relatedRoom?: {
    id: string;
    title: string;
    price: string;
    address: string;
    imageUrl: string;
  };
  appointmentSnippet?: {
    time: string;
    status: string;
  };
}

function TenantDirectMessagesContent() {
  const searchParams = useSearchParams();
  const initialUserParam = searchParams?.get("user");

  // State
  const [filterRole, setFilterRole] = React.useState<"ALL" | "LANDLORD" | "ROOMMATE">("ALL");
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [activeThreadId, setActiveThreadId] = React.useState<string>("thread-1");
  const [inputMessage, setInputMessage] = React.useState("");

  const [threads, setThreads] = React.useState<ChatThread[]>([
    {
      id: "thread-1",
      targetId: "landlord-1",
      name: "Nguyễn Minh An (Chủ trọ)",
      role: "LANDLORD",
      avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80",
      lastMessage: "Chào em, 15h thứ Bảy tuần này qua xem phòng 302 nhé!",
      lastMessageTime: "14:35",
      unreadCount: 1,
      online: true,
      relatedRoom: {
        id: "room-banmai-302",
        title: "Studio Ban Mai - Phòng 302 (35m²)",
        price: "4.500.000 đ/tháng",
        address: "124/8 Sư Vạn Hạnh, Phường 12, Quận 10",
        imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=300&auto=format&fit=crop&q=80",
      },
      appointmentSnippet: {
        time: "15:00 Thứ Bảy, 12/10/2026",
        status: "Đã xác nhận",
      },
    },
    {
      id: "thread-2",
      targetId: "roommate-1",
      name: "Nguyễn Hoàng Nam (Ở ghép)",
      role: "ROOMMATE",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      lastMessage: "Mình cũng hay nấu cơm tối ở nhà, chia đôi tiền gia vị tiện lắm.",
      lastMessageTime: "11:20",
      unreadCount: 0,
      online: false,
      relatedRoom: {
        id: "room-match-10",
        title: "Căn hộ 2PN Sunrise - Quận 10",
        price: "3.800.000 đ/người",
        address: "Quận 10, TP.HCM",
        imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=300&auto=format&fit=crop&q=80",
      },
    },
    {
      id: "thread-3",
      targetId: "roommate-2",
      name: "Trần Mai Phương (Ở ghép)",
      role: "ROOMMATE",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
      lastMessage: "Bé mèo của mình ngoan lắm, cuối tuần bạn ghé chơi thử nha!",
      lastMessageTime: "Hôm qua",
      unreadCount: 0,
      online: true,
    },
  ]);

  const [messages, setMessages] = React.useState<Record<string, ChatMessage[]>>({
    "thread-1": [
      {
        id: "m-1",
        senderId: "me",
        senderName: "Linh Nguyễn",
        text: "Dạ em chào anh An, em thấy phòng 302 bên mình còn trống trên 5K-Rental Manager. Em muốn hẹn anh xem phòng vào cuối tuần được không ạ?",
        time: "14:10",
        isMe: true,
      },
      {
        id: "m-2",
        senderId: "landlord-1",
        senderName: "Nguyễn Minh An",
        text: "Chào Linh, phòng 302 hiện đang sẵn sàng, nội thất đầy đủ y như hình chụp trên app nhé em.",
        time: "14:22",
        isMe: false,
      },
      {
        id: "m-3",
        senderId: "landlord-1",
        senderName: "Nguyễn Minh An",
        text: "Chào em, 15h thứ Bảy tuần này qua xem phòng 302 nhé!",
        time: "14:35",
        isMe: false,
      },
    ],
    "thread-2": [
      {
        id: "m-201",
        senderId: "roommate-1",
        senderName: "Nguyễn Hoàng Nam",
        text: "Chào Linh, cảm ơn bạn đã đồng ý lời mời kết nối nhé!",
        time: "11:05",
        isMe: false,
      },
      {
        id: "m-202",
        senderId: "me",
        senderName: "Linh Nguyễn",
        text: "Chào Nam! Mình thấy điểm tương thích của hai đứa tới 96%, cùng muốn ở Quận 10.",
        time: "11:15",
        isMe: true,
      },
      {
        id: "m-203",
        senderId: "roommate-1",
        senderName: "Nguyễn Hoàng Nam",
        text: "Mình cũng hay nấu cơm tối ở nhà, chia đôi tiền gia vị tiện lắm.",
        time: "11:20",
        isMe: false,
      },
    ],
  });

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const activeMessages = messages[activeThreadId] || [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderId: "me",
      senderName: "Linh Nguyễn",
      text: inputMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMe: true,
    };

    setMessages((prev) => ({
      ...prev,
      [activeThreadId]: [...(prev[activeThreadId] || []), newMsg],
    }));

    // Update last message in thread
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId ? { ...t, lastMessage: inputMessage.trim(), lastMessageTime: "Vừa xong" } : t
      )
    );

    setInputMessage("");
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col space-y-4 max-w-[1204px]">
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">Tin nhắn trực tiếp</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Trao đổi thông tin với chủ trọ và các bạn cùng phòng hợp gu trên hệ thống 5K-Rental Manager.
        </p>
      </div>

      <Card className="flex-1 border border-[#e2e7e1] bg-white rounded-[12px] shadow-sm overflow-hidden flex flex-col md:flex-row">
        {/* LEFT DRAWER: Conversations List (320px) */}
        <div className="w-full md:w-[320px] border-r border-[#e2e7e1] flex flex-col bg-[#ffffff] shrink-0">
          {/* Search Box */}
          <div className="p-3.5 border-b border-[#e2e7e1]">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-[#74817b]" />
              <input
                type="text"
                placeholder="Tìm cuộc trò chuyện..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full h-[38px] pl-9 pr-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] focus:bg-white outline-none"
              />
            </div>
          </div>

          {/* Filter Chips (Figma 44:64102) */}
          <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-[#e2e7e1] bg-[#f7f6f2]/50">
            <button
              onClick={() => setFilterRole("ALL")}
              className={`px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer transition-colors ${
                filterRole === "ALL" ? "bg-[#15594f] text-white" : "bg-white text-[#74817b] border border-[#e2e7e1]"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilterRole("LANDLORD")}
              className={`px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer transition-colors ${
                filterRole === "LANDLORD" ? "bg-[#15594f] text-white" : "bg-white text-[#74817b] border border-[#e2e7e1]"
              }`}
            >
              Chủ trọ
            </button>
            <button
              onClick={() => setFilterRole("ROOMMATE")}
              className={`px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer transition-colors ${
                filterRole === "ROOMMATE" ? "bg-[#15594f] text-white" : "bg-white text-[#74817b] border border-[#e2e7e1]"
              }`}
            >
              Ở ghép
            </button>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#e2e7e1]/60">
            {threads
              .filter((t) => (filterRole === "ALL" ? true : t.role === filterRole))
              .map((thread) => {
                const isActive = thread.id === activeThreadId;

                return (
                  <div
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isActive ? "bg-[#eaf2ed]/70 border-l-4 border-[#15594f]" : "hover:bg-[#f7f6f2]"
                    }`}
                  >
                    <div className="relative size-11 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#e2e7e1]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thread.avatarUrl} alt={thread.name} className="size-full object-cover" />
                      {thread.online && (
                        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-bold text-[#203c37] truncate">{thread.name}</h4>
                        <span className="text-[11px] text-[#74817b] shrink-0">{thread.lastMessageTime}</span>
                      </div>
                      <p className="text-[12px] text-[#74817b] truncate mt-0.5">{thread.lastMessage}</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* RIGHT PANE: Active Conversation Window (Figma 44:64131) */}
        <div className="flex-1 flex flex-col bg-[#f7f6f2]/30 min-w-0">
          {/* Active Chat Header (Figma 44:64132) */}
          <div className="p-3.5 px-5 bg-white border-b border-[#e2e7e1] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative size-10 rounded-full overflow-hidden bg-[#eaf2ed] border border-[#e2e7e1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeThread.avatarUrl} alt={activeThread.name} className="size-full object-cover" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-[#203c37] flex items-center gap-2">
                  {activeThread.name}
                  <Badge variant={activeThread.role === "LANDLORD" ? "info" : "success"} size="sm">
                    {activeThread.role === "LANDLORD" ? "Chủ trọ" : "Ở ghép"}
                  </Badge>
                </h3>
                <span className="text-[12px] text-emerald-600 font-medium">Đang trực tuyến</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[#74817b]">
              <Button variant="ghost" size="icon" title="Gọi thoại">
                <Phone className="size-4.5" />
              </Button>
            </div>
          </div>

          {/* Related Room Snippet Banner (Figma 44:64140) */}
          {activeThread.relatedRoom && (
            <div className="mx-4 mt-3 bg-white border border-[#e2e7e1] rounded-[8px] p-3 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-12 rounded-[6px] overflow-hidden bg-[#f7f6f2] shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeThread.relatedRoom.imageUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-[#203c37] truncate">{activeThread.relatedRoom.title}</h4>
                  <p className="text-[12px] text-[#15594f] font-semibold">{activeThread.relatedRoom.price}</p>
                </div>
              </div>
              <Link href={`/rooms/${activeThread.relatedRoom.id}`}>
                <Button variant="outline" size="sm">Xem phòng</Button>
              </Link>
            </div>
          )}

          {/* Pinned Viewing Appointment Snippet (Figma 44:64164) */}
          {activeThread.appointmentSnippet && (
            <div className="mx-4 mt-2 bg-[#eaf2ed] border border-[#15594f]/20 rounded-[8px] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarCheck className="size-5 text-[#15594f]" />
                <div className="text-[12px] text-[#203c37]">
                  <strong>Lịch xem phòng:</strong> {activeThread.appointmentSnippet.time}
                </div>
              </div>
              <Badge variant="success" size="sm">{activeThread.appointmentSnippet.status}</Badge>
            </div>
          )}

          {/* Message Stream */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3">
            {activeMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-[12px] text-[14px] leading-relaxed shadow-xs ${
                    msg.isMe
                      ? "bg-[#15594f] text-white rounded-tr-[2px]"
                      : "bg-white text-[#203c37] border border-[#e2e7e1] rounded-tl-[2px]"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[11px] text-[#74817b] mt-1 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Input Bar (Figma 44:64171) */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#e2e7e1] flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" title="Đính kèm tệp">
              <Paperclip className="size-4.5 text-[#74817b]" />
            </Button>
            <input
              type="text"
              placeholder="Nhập tin nhắn trao đổi trên 5K-Rental Manager..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 h-[42px] px-3.5 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:bg-white outline-none"
            />
            <Button type="submit" variant="primary" size="md" leftIcon={<Send className="size-4" />}>
              Gửi
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

export default function TenantDirectMessagesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-[750px] bg-white rounded-[12px] border border-[#e2e7e1] flex items-center justify-center text-[#74817b]">
          Đang tải tin nhắn...
        </div>
      }
    >
      <TenantDirectMessagesContent />
    </React.Suspense>
  );
}