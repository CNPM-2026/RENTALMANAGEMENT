import { io, Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/auth";
import { getBaseOriginUrl } from "@/lib/api";

let socket: Socket | null = null;

export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(getBaseOriginUrl(), {
      autoConnect: false,
      transports: ["websocket"],
      auth: { token: getAuthToken() },
    });
  }
  return socket;
}

export function refreshChatSocketAuth(): Socket {
  const instance = getChatSocket();
  instance.auth = { token: getAuthToken() };
  return instance;
}
