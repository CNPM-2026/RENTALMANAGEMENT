"use client";

import * as React from "react";
import { AUTH_CHANGE_EVENT, getCurrentUser } from "@/lib/auth";
import type { Role } from "@/types/models";

/**
 * Role của tài khoản đang đăng nhập (session), KHÔNG phải role của route hiện tại.
 *
 * Dùng cho các link điều hướng dùng chung (thông báo, chat...): cùng một component
 * có thể được render ở nhiều portal/trang công khai, nhưng đích đến phải theo
 * đúng role lưu trong phiên đăng nhập.
 *
 * Trả `null` trong lần render đầu (SSR/hydration) và cập nhật ngay sau đó.
 */
export function useCurrentUserRole(): Role | null {
  const [role, setRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    const sync = () => setRole(getCurrentUser()?.role ?? null);
    const frame = window.requestAnimationFrame(sync);
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
    };
  }, []);

  return role;
}
