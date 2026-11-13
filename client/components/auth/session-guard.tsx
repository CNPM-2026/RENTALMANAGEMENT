"use client";

import * as React from "react";
import {
  SESSION_KEY,
  clearAuthSession,
  getAuthToken,
  getSessionExpiresAt,
  isSessionExpired,
} from "@/lib/auth";

/**
 * Đồng hồ phiên đăng nhập — tối đa 2 giờ.
 *
 * - Đặt một timer đúng bằng thời gian còn lại của phiên; hết giờ thì xoá sạch
 *   dữ liệu tài khoản trên thiết bị và `location.replace('/login?expired=1')`.
 * - Lắng nghe `storage` để nhiều tab cùng đăng xuất khi một tab đăng xuất; nghe
 *   `focus`/`visibilitychange` để tab bị treo (timer bị throttle) vẫn kiểm tra
 *   lại hạn phiên ngay khi được mở.
 * - Không phụ thuộc API: mất mạng vẫn tự đăng xuất đúng hạn.
 */
export function SessionGuard() {
  React.useEffect(() => {
    let timer: number | undefined;

    const expire = () => {
      clearAuthSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login?expired=1");
      }
    };

    const schedule = () => {
      if (timer) window.clearTimeout(timer);
      if (!getAuthToken()) return;
      if (isSessionExpired()) {
        expire();
        return;
      }
      const expiresAt = getSessionExpiresAt();
      if (expiresAt === null) return;
      // setTimeout nhận số nguyên 32-bit; kẹp lại để không tràn.
      const delay = Math.max(0, Math.min(expiresAt - Date.now(), 2_147_483_647));
      timer = window.setTimeout(expire, delay);
    };

    const onStorage = (event: StorageEvent) => {
      // Đăng xuất ở tab khác hoặc phiên mới được tạo ⇒ tính lại hạn.
      if (event.key === null || event.key === SESSION_KEY) schedule();
    };

    schedule();
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", schedule);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", schedule);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, []);

  return null;
}
