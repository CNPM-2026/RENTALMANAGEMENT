"use client";

import * as React from "react";
import { MessageSquare, Send, Search, User, CheckCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Conversation, Message } from "@/types/models";

export default function LandlordMessagesPage() {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [inputText, setInputText] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    apiClient.chats
      .getMyConversations()
      .then((convs) => {
        setConversations(convs ?? []);
        if (convs && convs.length > 0) {
          setSelectedConversationId(convs[0].id);
        }
      })
      .catch(() => setConversations([]))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    if (!selectedConversationId) return;
    apiClient.chats
      .getMessages(selectedConversationId)
      .then((msgs) => setMessages(msgs ?? []))
      .catch(() => setMessages([]));
  }, [selectedConversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConversationId) return;
    const content = inputText;
    setInputText("");
    
    // Add optimistic message
    const tempMsg: Message = {
      id: String(Date.now()),
      conversationId: selectedConversationId,
      senderId: "landlord",
      messageType: "TEXT",
      content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Vận hành</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Tin nhắn & Trao đổi</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Trò chuyện trực tiếp với khách thuê và giải đáp thắc mắc.</p>
      </div>

      <div className="h-[600px] rounded-[12px] border border-[#e2e7e1] bg-white flex overflow-hidden shadow-xs">
        {/* Chat List Left Column */}
        <div className="w-[300px] border-r border-[#e2e7e1] flex flex-col bg-[#f7f6f2]/40">
          <div className="p-3 border-b border-[#e2e7e1]">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-[7px] border border-[#e2e7e1]">
              <Search className="size-3.5 text-[#74817b]" />
              <input
                type="text"
                placeholder="Tìm hội thoại..."
                className="w-full text-[12px] bg-transparent outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#eef3ef]">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-[#74817b]">
                <MessageSquare className="size-8 mx-auto mb-2 text-[#9bb5a8]" />
                Chưa có hội thoại nào
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversationId(conv.id)}
                  className={`w-full p-3 text-left flex items-start gap-3 transition-colors cursor-pointer ${
                    selectedConversationId === conv.id ? "bg-[#eaf2ed]" : "hover:bg-white"
                  }`}
                >
                  <div className="size-9 rounded-full bg-[#15594f] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    K
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#203c37] truncate">
                      Khách thuê phòng
                    </p>
                    <p className="text-[12px] text-[#74817b] truncate mt-0.5">
                      Nhấn để xem tin nhắn
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message Window Right Column */}
        <div className="flex-1 flex flex-col">
          <div className="p-3.5 border-b border-[#e2e7e1] flex items-center gap-3">
            <div className="size-8 rounded-full bg-[#15594f] text-white flex items-center justify-center font-bold text-xs">
              K
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[#203c37]">Khách thuê</p>
              <p className="text-[11px] text-[#15594f]">Đang trực tuyến</p>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f7f6f2]/20">
            {messages.length === 0 ? (
              <p className="text-center text-[13px] text-[#74817b] py-12">
                Bắt đầu cuộc trò chuyện với khách thuê...
              </p>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === "landlord";
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] p-3 rounded-[10px] text-[13px] ${
                        isMe
                          ? "bg-[#15594f] text-white rounded-br-xs"
                          : "bg-white text-[#203c37] border border-[#e2e7e1] rounded-bl-xs"
                      }`}
                    >
                      <p>{m.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? "text-white/70" : "text-[#74817b]"}`}>
                        {new Date(m.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-[#e2e7e1] flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập tin nhắn trả lời..."
              className="flex-1 text-[13px] px-3.5 py-2 rounded-[8px] border border-[#e2e7e1] outline-none focus:border-[#15594f]"
            />
            <button
              type="submit"
              className="p-2.5 rounded-[8px] bg-[#15594f] text-white hover:bg-[#124b42] transition-colors cursor-pointer"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
