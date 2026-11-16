"use client";

/**
 * Tiện ích đọc tham số focus do thông báo tạo ra (`?invoice=<id>`,
 * `?appointment=<id>`...) và cuộn tới phần tử tương ứng.
 *
 * Trang danh sách không cần route động cho từng bản ghi vẫn mở đúng bản ghi
 * người dùng bấm từ thông báo. Chỉ đọc `location.search` trong effect (không
 * dùng `useSearchParams`) để các trang hiện có không cần thêm Suspense boundary.
 */
export function readFocusParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get(key);
  return value && value.trim() ? value : null;
}

/** Cuộn tới `elementId` sau khi DOM đã render danh sách bất đồng bộ. */
export function scrollToFocus(elementId: string) {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    document.getElementById(elementId)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  });
}

/** Class dùng chung: chừa chỗ cho topbar và tô sáng bản ghi đang được focus. */
export const FOCUS_ROW_CLASS =
  "scroll-mt-24 transition-shadow target:border-[#15594f] target:ring-2 target:ring-[#15594f]/25";
