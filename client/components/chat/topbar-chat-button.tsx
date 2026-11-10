"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare, Search, MessageCircle, ExternalLink, ChevronRight } from "lucide-react";
import { useChat } from "@/context/chat-context";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

interface TopbarChatButtonProps {
  className?: string;
  iconClassName?: string;
}

export function TopbarChatButton({ className = "", iconClassName = "size-4.5" }: TopbarChatButtonProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { conversations, unreadCount, openChat } = useChat();

  const currentUserId = getCurrentUser()?.id;
  const userRole = getCurrentUser()?.role;

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  const visibleConversations = conversations.filter((c) => {
    const otherUser = c.members?.find((m) => m.userId !== currentUserId)?.user;
    return (otherUser?.fullName ?? "Hội thoại").toLowerCase().includes(search.toLowerCase());
  });

  const fullInboxHref =
    userRole === "LANDLORD" ? "/landlord/messages" : "/tenant/messages";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Topbar Chat Button with Red Unread Badge */}
      <button
        type="button"
        title="Tin nhắn & Trò chuyện"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className={`relative flex items-center justify-center transition-colors cursor-pointer text-[#74817b] hover:text-[#15594f] hover:bg-[#f7f6f2] rounded-full ${className || "size-9"}`}
      >
        <MessageSquare className={iconClassName} />

        {/* RED UNREAD BADGE */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white shadow-xs animate-in zoom-in-75">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook-style Messenger Dropdown Popover */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[360px] bg-white rounded-2xl border border-[#e2e7e1] shadow-[0_12px_40px_rgba(32,60,55,0.14)] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 pb-2 border-b border-[#eef3ef] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#203c37]">Đoạn chat</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-bold">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <Link
                href={fullInboxHref}
                onClick={() => setDropdownOpen(false)}
                className="text-xs font-semibold text-[#15594f] hover:underline flex items-center gap-0.5"
              >
                <span>Hộp thư</span>
                <ChevronRight className="size-3" />
              </Link>
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2 rounded-lg border border-[#e2e7e1] bg-[#f8faf9] px-2.5 py-1.5 text-xs text-[#203c37]">
              <Search className="size-3.5 text-[#74817b] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm tin nhắn..."
                className="w-full bg-transparent outline-none placeholder:text-[#9aa8a0]"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-[#f2f5f3]">
            {visibleConversations.length === 0 ? (
              <div className="py-10 text-center text-[#74817b] space-y-2">
                <MessageCircle className="size-8 mx-auto text-[#b8c9bf]" />
                <p className="text-xs font-medium">Chưa có cuộc trò chuyện nào</p>
              </div>
            ) : (
              visibleConversations.map((conv) => {
                const other = conv.members?.find((m) => m.userId !== currentUserId)?.user;
                const lastMsg = conv.messages?.[0];
                const hasUnread = (conv.unreadCount ?? 0) > 0;

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      setDropdownOpen(false);
                      void openChat(conv, other);
                    }}
                    className={`flex items-center gap-3 p-3 transition-colors hover:bg-[#f7f6f2] cursor-pointer ${
                      hasUnread ? "bg-[#eaf2ed]/30" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        src={other?.avatarUrl}
                        alt={other?.fullName ?? "Avatar"}
                        className="size-10 rounded-full object-cover border border-[#e2e7e1]"
                      />
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p
                          className={`text-xs truncate ${
                            hasUnread
                              ? "font-bold text-[#203c37]"
                              : "font-semibold text-[#203c37]"
                          }`}
                        >
                          {other?.fullName ?? "Người dùng"}
                        </p>
                        {lastMsg && (
                          <span className="text-[10px] text-[#74817b] shrink-0">
                            {formatDate(lastMsg.createdAt, "datetime").split(" ")[0]}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            hasUnread
                              ? "font-semibold text-[#15594f]"
                              : "text-[#74817b]"
                          }`}
                        >
                          {lastMsg ? lastMsg.content : "Bắt đầu cuộc trò chuyện"}
                        </p>
                        {hasUnread && (
                          <span className="size-2 rounded-full bg-red-600 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Footer */}
          <div className="p-2.5 border-t border-[#eef3ef] bg-[#f8faf9] text-center">
            <Link
              href={fullInboxHref}
              onClick={() => setDropdownOpen(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15594f] hover:underline"
            >
              <ExternalLink className="size-3" />
              <span>Mở toàn bộ trang Tin nhắn</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
