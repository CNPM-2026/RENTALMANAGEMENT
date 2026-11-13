"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Maximize2, Minus, Send, X, MessageCircle } from "lucide-react";
import { useChat } from "@/context/chat-context";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { refreshChatSocketAuth } from "@/lib/socket";
import { Message } from "@/types/models";
import { Avatar } from "@/components/ui/avatar";

export function FloatingChatBox() {
  const router = useRouter();
  const {
    activeConversation,
    activeTargetUser,
    isMinimized,
    closeChat,
    minimizeChat,
    restoreChat,
    markConversationAsRead,
  } = useChat();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loadedConversationId, setLoadedConversationId] = React.useState<
    string | null
  >(null);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const currentUserId = getCurrentUser()?.id;

  const conversationId = activeConversation?.id;

  // Derived loading: true ngay khi đổi sang conversation mới cho đến khi fetch xong
  const loading = !!conversationId && loadedConversationId !== conversationId;

  // Auto scroll to bottom
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Load messages when active conversation changes
  React.useEffect(() => {
    if (!conversationId) return;

    let isMounted = true;

    apiClient.chats
      .getMessages(conversationId)
      .then((items) => {
        if (!isMounted) return;
        setMessages([...items].reverse());
        setLoadedConversationId(conversationId);
        setTimeout(() => scrollToBottom("auto"), 50);
      })
      .catch(() => {});

    const socket = refreshChatSocketAuth();
    socket.connect();
    socket.emit("join_conversation", conversationId);

    const handleMessage = (msg: Message) => {
      if (msg.conversationId === conversationId) {
        setMessages((prev) =>
          // Dedupe theo `id` (server là nguồn duy nhất) và theo `clientMessageId`
          // (phòng trường hợp server gửi lại bản ghi vừa tạo bằng HTTP).
          prev.some(
            (m) => m.id === msg.id ||
              (!!msg.clientMessageId && m.clientMessageId === msg.clientMessageId),
          )
            ? prev
            : [...prev, msg]
        );
        setTimeout(() => scrollToBottom("smooth"), 50);
        if (!isMinimized) {
          void markConversationAsRead(conversationId);
        }
      }
    };

    socket.on("receive_message", handleMessage);

    return () => {
      isMounted = false;
      socket.off("receive_message", handleMessage);
      socket.emit("leave_conversation", conversationId);
    };
  }, [conversationId, isMinimized, markConversationAsRead]);

  // Send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !conversationId || sending) return;

    setSending(true);
    try {
      // Chat chỉ gửi văn bản. `clientMessageId` giữ tính idempotent khi retry.
      const saved = await apiClient.chats.sendMessage(conversationId, {
        content,
        clientMessageId: `c_${crypto.randomUUID()}`,
      });
      setMessages((prev) =>
        prev.some((m) => m.id === saved.id || (!!saved.clientMessageId && m.clientMessageId === saved.clientMessageId))
          ? prev
          : [...prev, saved]
      );
      setInput("");
      setTimeout(() => scrollToBottom("smooth"), 50);
    } catch {
      // Lỗi gửi: giữ nguyên nội dung để người dùng thử lại.
    } finally {
      setSending(false);
    }
  };

  if (!activeConversation) return null;

  const targetName = activeTargetUser?.fullName ?? "Hội thoại";
  const targetAvatar = activeTargetUser?.avatarUrl;

  const fullInboxHref =
    getCurrentUser()?.role === "LANDLORD"
      ? `/landlord/messages?conversation=${encodeURIComponent(
          conversationId || ""
        )}`
      : `/tenant/messages?conversation=${encodeURIComponent(
          conversationId || ""
        )}`;

  // If Minimized: Show bottom dock pill (like Facebook minimized chat bubble)
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-4 sm:right-10 z-50 flex items-center gap-2 rounded-t-xl border border-b-0 border-[#d0dcd4] bg-white px-3.5 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.12)] cursor-pointer hover:bg-[#f7f6f2] transition-all">
        <div onClick={restoreChat} className="flex items-center gap-2.5">
          <div className="relative">
            <Avatar
              src={targetAvatar}
              alt={targetName}
              className="size-8 rounded-full object-cover"
            />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <span className="text-xs font-semibold text-[#203c37] max-w-[130px] truncate">
            {targetName}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            closeChat();
          }}
          className="size-6 rounded-full flex items-center justify-center text-[#74817b] hover:text-[#203c37] hover:bg-gray-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  // Expanded Floating Window
  return (
    <div className="fixed bottom-0 right-4 sm:right-10 z-50 flex flex-col w-[340px] sm:w-[360px] h-[460px] max-h-[85vh] rounded-t-2xl border border-b-0 border-[#d0dcd4] bg-white shadow-[0_-8px_30px_rgba(32,60,55,0.18)] overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Facebook-style Chat Header */}
      <header className="flex items-center justify-between border-b border-[#e8eee9] bg-white px-3.5 py-2.5 shrink-0 shadow-2xs">
        <div
          onClick={minimizeChat}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-85"
        >
          <div className="relative">
            <Avatar
              src={targetAvatar}
              alt={targetName}
              className="size-8.5 rounded-full object-cover border border-[#e2e7e1]"
            />
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-[#203c37] truncate leading-tight">
              {targetName}
            </h3>
            <p className="text-[10px] text-emerald-600 font-medium leading-none mt-0.5">
              Đang hoạt động
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-[#74817b]">
          <button
            type="button"
            title="Thu nhỏ"
            onClick={minimizeChat}
            className="size-7 rounded-full flex items-center justify-center hover:bg-[#f2f5f3] hover:text-[#203c37] transition-colors"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            title="Mở toàn màn hình"
            onClick={() => {
              closeChat();
              router.push(fullInboxHref);
            }}
            className="size-7 rounded-full flex items-center justify-center hover:bg-[#f2f5f3] hover:text-[#203c37] transition-colors"
          >
            <Maximize2 className="size-3.5" />
          </button>
          <button
            type="button"
            title="Đóng chat"
            onClick={closeChat}
            className="size-7 rounded-full flex items-center justify-center hover:bg-[#f2f5f3] hover:text-[#a4422c] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Message Stream Body */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8faf9] p-3 space-y-2.5 text-xs">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[#74817b] text-xs">
            Đang tải tin nhắn...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[#74817b] p-4">
            <MessageCircle className="size-8 text-[#b8c9bf] mb-2" />
            <p className="font-semibold text-[#203c37] text-xs">
              Bắt đầu cuộc trò chuyện
            </p>
            <p className="text-[11px] mt-0.5">
              Gửi lời chào tới {targetName} để trao đổi thông tin!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${
                  isMine ? "justify-end" : "justify-start"
                } items-end gap-1.5`}
              >
                {!isMine && (
                  <Avatar
                    src={targetAvatar}
                    alt={targetName}
                    className="size-5 rounded-full object-cover shrink-0 mb-0.5"
                  />
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 leading-relaxed shadow-2xs break-words ${
                    isMine
                      ? "rounded-br-xs bg-[#15594f] text-white"
                      : "rounded-bl-xs border border-[#e2e7e1] bg-white text-[#203c37]"
                  }`}
                >
                  {msg.content ? <p className="whitespace-pre-wrap">{msg.content}</p> : null}
                  <span
                    className={`block text-[9px] mt-0.5 text-right ${
                      isMine ? "text-white/70" : "text-[#74817b]"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Facebook-style Input Footer — chỉ gửi văn bản */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-1.5 border-t border-[#e8eee9] bg-white p-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          className="flex-1 rounded-full border border-[#dfe8e1] bg-[#f8faf9] px-3.5 py-2 text-xs text-[#203c37] outline-none placeholder:text-[#9aa8a0] focus:border-[#15594f] focus:bg-white transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="size-8.5 rounded-full bg-[#15594f] text-white flex items-center justify-center hover:bg-[#124b42] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
        >
          <Send className="size-3.5" />
        </button>
      </form>
    </div>
  );
}