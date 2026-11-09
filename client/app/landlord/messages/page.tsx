"use client";

import * as React from "react";
import { MessageCircle, Search, Send } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getChatSocket, refreshChatSocketAuth } from "@/lib/socket";
import { Conversation, Message } from "@/types/models";
import { Avatar } from "@/components/ui/avatar";

export default function LandlordMessagesPage() {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const currentUserId = getCurrentUser()?.id;

  React.useEffect(() => {
    apiClient.chats.getMyConversations().then((items) => {
      setConversations(items);
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("conversation");
      const target = params.get("user");
      const requestedConversation = items.find((item) => item.id === requested || (target && item.members.length === 2 && item.members.some((member) => member.userId === target)));
      const latestConversation = items.find((item) => (item.messages?.length ?? 0) > 0) ?? items[0];
      setSelectedId(requestedConversation?.id ?? (target ? null : latestConversation?.id ?? null));
    }).catch(() => setError("Không tải được danh sách hội thoại."));
  }, []);

  React.useEffect(() => {
    if (!selectedId) return;
    setMessages([]);
    apiClient.chats.getMessages(selectedId).then((items) => setMessages([...items].reverse())).catch(() => setError("Không tải được tin nhắn."));
    const socket = refreshChatSocketAuth();
    const onMessage = (message: Message) => {
      if (message.conversationId === selectedId) setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
    };
    const onError = (message: string) => setError(message);
    socket.connect();
    socket.emit("join_conversation", selectedId);
    socket.on("receive_message", onMessage);
    socket.on("error_message", onError);
    return () => { socket.off("receive_message", onMessage); socket.off("error_message", onError); socket.emit("leave_conversation", selectedId); };
  }, [selectedId]);

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    getChatSocket().emit(
      "send_message",
      { conversationId: selectedId, content: input.trim(), messageType: "TEXT" },
      (result: { success: boolean; message?: string }) => {
        setSending(false);
        if (!result.success) {
          setError(result.message ?? "Không thể gửi tin nhắn.");
          return;
        }
        setError(null);
        setInput("");
      },
    );
  }

  const visible = conversations.filter((conversation) => {
    const member = conversation.members.find((item) => item.userId !== currentUserId)?.user;
    return (member?.fullName ?? "Hội thoại").toLowerCase().includes(query.toLowerCase());
  });
  const selected = conversations.find((item) => item.id === selectedId);
  const target = selected?.members.find((member) => member.userId !== currentUserId)?.user;

  return (
    <div className="space-y-5">
      <div><p className="text-[12px] text-[#74817b]">Vận hành</p><h1 className="mt-1 text-[28px] font-semibold text-[#203c37]">Tin nhắn</h1><p className="mt-1 text-[14px] text-[#74817b]">Trao đổi trực tiếp với khách thuê và người dùng.</p></div>
      {error && <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-sm text-[#a4422c]">{error}</div>}
      <div className="grid h-[min(680px,calc(100vh-190px))] min-h-[520px] grid-cols-1 overflow-hidden rounded-[16px] border border-[#dfe8e1] bg-white shadow-[0_12px_40px_rgba(32,60,55,0.08)] md:grid-cols-[300px_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-[#e8eee9] bg-[#fbfcfa] md:border-b-0 md:border-r">
          <div className="border-b border-[#e8eee9] p-4"><div className="flex items-center gap-2 rounded-[10px] border border-[#dfe8e1] bg-white px-3 py-2.5"><Search className="size-4 text-[#74817b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none placeholder:text-[#9aa8a0]" placeholder="Tìm cuộc trò chuyện" /></div></div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{visible.length === 0 ? <div className="p-6 text-center text-sm text-[#74817b]">Chưa có cuộc trò chuyện.</div> : visible.map((conversation) => { const member = conversation.members.find((item) => item.userId !== currentUserId)?.user; const active = selectedId === conversation.id; return <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`flex w-full items-center gap-3 rounded-[10px] p-3 text-left transition ${active ? "bg-[#e6f1eb]" : "hover:bg-[#f1f5f2]"}`}><Avatar src={member?.avatarUrl} alt={member?.fullName ?? "Hội thoại"} className="size-10 shrink-0 rounded-full object-cover" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#203c37]">{member?.fullName ?? "Hội thoại"}</p><p className="mt-0.5 truncate text-xs text-[#74817b]">{conversation.messages?.[0]?.content ?? "Chưa có tin nhắn"}</p></div></button>; })}</div>
        </aside>
        <section className="flex min-h-0 flex-col">
          <header className="flex items-center gap-3 border-b border-[#e8eee9] px-5 py-4"><Avatar src={target?.avatarUrl} alt={target?.fullName ?? "Hội thoại"} className="size-10 rounded-full object-cover" /><div><h2 className="font-semibold text-[#203c37]">{target?.fullName ?? "Chọn cuộc trò chuyện"}</h2><p className="text-xs text-[#74817b]">{selected ? "Đang trao đổi trực tuyến" : "Chọn một hội thoại để bắt đầu"}</p></div></header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfcfa] p-5">{!selectedId ? <div className="flex h-full flex-col items-center justify-center text-center text-[#74817b]"><MessageCircle className="size-12 text-[#b8c9bf]" /><p className="mt-3 font-semibold text-[#203c37]">Chọn một cuộc trò chuyện</p><p className="mt-1 text-sm">Tin nhắn của bạn sẽ hiển thị tại đây.</p></div> : messages.length === 0 ? <p className="py-10 text-center text-sm text-[#74817b]">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</p> : messages.map((message) => <div key={message.id} className={`flex ${message.senderId === currentUserId ? "justify-end" : "justify-start"}`}><div className={`max-w-[min(75%,520px)] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.senderId === currentUserId ? "rounded-br-md bg-[#15594f] text-white" : "rounded-bl-md border border-[#e2ebe4] bg-white text-[#203c37]"}`}><p className="whitespace-pre-wrap break-words">{message.content}</p><p className="mt-1 text-[10px] opacity-65">{new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p></div></div>)}</div>
          <form onSubmit={sendMessage} className="flex gap-3 border-t border-[#e8eee9] bg-white p-4"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={!selectedId || sending} className="min-w-0 flex-1 rounded-[10px] border border-[#dfe8e1] px-4 py-3 text-sm outline-none transition focus:border-[#15594f] focus:ring-2 focus:ring-[#15594f]/10 disabled:bg-[#f7f8f7]" placeholder="Nhập tin nhắn..." /><button disabled={!selectedId || !input.trim() || sending} className="flex size-11 shrink-0 items-center justify-center rounded-[10px] bg-[#15594f] text-white transition hover:bg-[#124b42] disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-4" /></button></form>
        </section>
      </div>
    </div>
  );
}
