"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { AUTH_CHANGE_EVENT, getAuthToken, getCurrentUser } from "@/lib/auth";
import { refreshChatSocketAuth } from "@/lib/socket";
import { Conversation, Message, User } from "@/types/models";

interface ChatContextType {
  conversations: Conversation[];
  unreadCount: number;
  activeConversation: Conversation | null;
  activeTargetUser: Partial<User> | null;
  isMinimized: boolean;
  openChat: (
    conversationIdOrTarget: string | Conversation,
    targetUser?: Partial<User>
  ) => Promise<void>;
  closeChat: () => void;
  minimizeChat: () => void;
  restoreChat: () => void;
  refreshConversations: () => Promise<void>;
  markConversationAsRead: (conversationId: string) => Promise<void>;
}

const ChatContext = React.createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    React.useState<Conversation | null>(null);
  const [activeTargetUser, setActiveTargetUser] =
    React.useState<Partial<User> | null>(null);
  const [isMinimized, setIsMinimized] = React.useState(false);
  /**
   * `null` = chưa có phiên. Đây là "chìa khoá" cho cả việc tải hội thoại và mở
   * socket: ChatProvider nằm ở root layout nên được mount khi người dùng còn ở
   * /login, lúc đó chưa có token. Chỉ tải một lần lúc mount sẽ khiến chat rỗng
   * cho tới khi F5. `authUserId` được đồng bộ lại mỗi khi phiên thay đổi.
   */
  const [authUserId, setAuthUserId] = React.useState<string | null>(null);
  const authUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const syncAuth = () => {
      const user = getAuthToken() ? getCurrentUser() : null;
      const nextId = user?.id ?? null;
      if (authUserIdRef.current === nextId) return;

      // Đổi tài khoản/đăng xuất: bỏ dữ liệu của người cũ NGAY, không chờ API.
      authUserIdRef.current = nextId;
      setAuthUserId(nextId);
      setConversations([]);
      setActiveConversation(null);
      setActiveTargetUser(null);
      setIsMinimized(false);

      // Socket singleton giữ token của lần handshake đầu tiên. Ngắt để effect
      // realtime bên dưới kết nối lại bằng token mới (hoặc dừng hẳn khi logout).
      refreshChatSocketAuth().disconnect();
      if (nextId) refreshChatSocketAuth();
    };

    syncAuth();
    window.addEventListener(AUTH_CHANGE_EVENT, syncAuth);
    window.addEventListener("storage", syncAuth);
    window.addEventListener("focus", syncAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuth);
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("focus", syncAuth);
    };
  }, []);

  // Tải hội thoại mỗi khi danh tính đã xác thực thay đổi (đăng nhập / đổi tài khoản).
  React.useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const items = await apiClient.chats.getMyConversations();
        if (cancelled) return;
        setConversations(items ?? []);
      } catch {
        // 401/offline: giữ danh sách hiện tại, socket reconnect sẽ tải lại.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authUserId]);

  const refreshConversations = React.useCallback(async () => {
    const user = getCurrentUser();
    if (!user) return;
    try {
      const items = await apiClient.chats.getMyConversations();
      setConversations(items ?? []);
    } catch {
      // Ignore initial unauthenticated load
    }
  }, []);

  // Real-time socket events
  React.useEffect(() => {
    if (!authUserId) return;
    const user = getCurrentUser();
    if (!user) return;

    const socket = refreshChatSocketAuth();
    socket.connect();

    const handleNewMessage = (message: Message) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === message.conversationId);
        const isCurrentActive =
          activeConversation?.id === message.conversationId && !isMinimized;
        const isFromOther = message.senderId !== user.id;

        if (existing) {
          const updatedConv: Conversation = {
            ...existing,
            updatedAt: message.createdAt,
            messages: [message],
            unreadCount:
              isFromOther && !isCurrentActive
                ? (existing.unreadCount ?? 0) + 1
                : existing.unreadCount ?? 0,
          };
          return [
            updatedConv,
            ...prev.filter((c) => c.id !== message.conversationId),
          ];
        } else {
          // If conversation wasn't in list yet, refresh
          void refreshConversations();
          return prev;
        }
      });
    };

    socket.on("receive_message", handleNewMessage);

    return () => {
      socket.off("receive_message", handleNewMessage);
      // Deps đổi do mở/đóng cửa sổ chat -> giữ kết nối. Chỉ ngắt khi mất phiên.
      if (!getAuthToken()) socket.disconnect();
    };
  }, [activeConversation, authUserId, isMinimized, refreshConversations]);

  // Calculate total unread messages count
  const unreadCount = React.useMemo(() => {
    return conversations.reduce(
      (total, conv) => total + (conv.unreadCount ?? 0),
      0
    );
  }, [conversations]);

  const markConversationAsRead = React.useCallback(
    async (conversationId: string) => {
      try {
        await apiClient.chats.markAsRead(conversationId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          )
        );
      } catch {
        // Ignore
      }
    },
    []
  );

  const openChat = React.useCallback(
    async (
      conversationOrId: string | Conversation,
      fallbackTargetUser?: Partial<User>
    ) => {
      const user = getCurrentUser();
      let conv: Conversation | undefined;

      if (typeof conversationOrId === "object") {
        conv = conversationOrId;
      } else {
        conv = conversations.find((c) => c.id === conversationOrId);
        if (!conv) {
          // Fetch or check conversations
          try {
            const list = await apiClient.chats.getMyConversations();
            setConversations(list);
            conv = list.find((c) => c.id === conversationOrId);
          } catch {}
        }
      }

      if (conv) {
        setActiveConversation(conv);
        setIsMinimized(false);
        const targetMember = conv.members?.find(
          (m) => m.userId !== user?.id
        )?.user;
        setActiveTargetUser(targetMember ?? fallbackTargetUser ?? null);
        void markConversationAsRead(conv.id);
      } else if (
        typeof conversationOrId === "string" &&
        fallbackTargetUser?.id
      ) {
        // Conversation might need to be created
        try {
          const created = await apiClient.chats.getOrCreateConversationWithUser(
            fallbackTargetUser.id
          );
          setActiveConversation(created);
          setIsMinimized(false);
          setActiveTargetUser(fallbackTargetUser);
          void refreshConversations();
        } catch {}
      }
    },
    [conversations, markConversationAsRead, refreshConversations]
  );

  const closeChat = React.useCallback(() => {
    setActiveConversation(null);
    setActiveTargetUser(null);
    setIsMinimized(false);
  }, []);

  const minimizeChat = React.useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restoreChat = React.useCallback(() => {
    setIsMinimized(false);
    if (activeConversation) {
      void markConversationAsRead(activeConversation.id);
    }
  }, [activeConversation, markConversationAsRead]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        unreadCount,
        activeConversation,
        activeTargetUser,
        isMinimized,
        openChat,
        closeChat,
        minimizeChat,
        restoreChat,
        refreshConversations,
        markConversationAsRead,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = React.useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}