/**
 * 5K-Rental Manager - Authentication Session & Token Storage Helper
 * Provides SSR-safe access to JWT access tokens, refresh tokens, and user profiles.
 */

import { Role, User } from '@/types/models';

export const TOKEN_KEY = '5k_access_token';
export const REFRESH_TOKEN_KEY = '5k_refresh_token';
export const USER_KEY = '5k_user_profile';
/**
 * Thời điểm HẾT HẠN TUYỆT ĐỐI của phiên (epoch ms). Đăng nhập tối đa 2 giờ —
 * khớp với `REFRESH_TOKEN_TTL_MS` ở server, nơi refresh token cũng không được
 * gia hạn thêm sau mỗi lần rotate.
 */
export const SESSION_KEY = '5k_session_expires_at';
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * Sự kiện nội bộ phát mỗi khi phiên đăng nhập thay đổi (đăng nhập / đăng xuất).
 *
 * Các provider sống ở root layout (chat, badge thông báo) được mount TRƯỚC khi
 * người dùng đăng nhập. Nếu chúng chỉ đọc localStorage một lần lúc mount thì
 * phải F5 mới thấy dữ liệu. Lắng nghe sự kiện này cho phép chúng tải lại ngay
 * sau khi `setAuthSession`/`clearAuthSession` chạy.
 */
export const AUTH_CHANGE_EVENT = '5k-auth-change';

/** Phát sự kiện đổi phiên; SSR-safe và không làm hỏng luồng đăng nhập nếu lỗi. */
function notifyAuthChange(): void {
  if (!isClient()) return;
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch (err) {
    console.error('Failed to dispatch auth change event', err);
  }
}

/** Các key lưu trên thiết bị thuộc về tài khoản — xoá sạch khi đăng xuất. */
const SESSION_SCOPED_KEYS = [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, SESSION_KEY, '5k_notification_settings'];

/** Cookie phiên dùng cho Next middleware — chỉ sống tối đa 2 giờ. */
const SESSION_COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);

/**
 * Checks whether the current code is running in a browser environment.
 */
function isClient(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Retrieves the stored JWT access token.
 */
export function getAuthToken(): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to read auth token from localStorage', err);
    return null;
  }
}

/**
 * Retrieves the stored refresh token.
 */
export function getRefreshToken(): string | null {
  if (!isClient()) return null;
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (err) {
    console.error('Failed to read refresh token from localStorage', err);
    return null;
  }
}

/**
 * Retrieves the current logged-in user profile from local storage.
 */
export function getCurrentUser(): User | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch (err) {
    console.error('Failed to parse current user from localStorage', err);
    return null;
  }
}

/**
 * Thời điểm phiên hết hạn (epoch ms). `null` = chưa có phiên.
 * Giá trị được ghi MỘT LẦN lúc đăng nhập và KHÔNG đổi khi refresh access token,
 * nên phiên không thể sống quá 2 giờ dù token được làm mới liên tục.
 */
export function getSessionExpiresAt(): number | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (err) {
    console.error('Failed to read session expiry from localStorage', err);
    return null;
  }
}

/** Phiên đã quá 2 giờ (hoặc không có mốc hạn hợp lệ kèm token). */
export function isSessionExpired(): boolean {
  if (!getAuthToken()) return true;
  const expiresAt = getSessionExpiresAt();
  if (expiresAt === null) return true;
  return Date.now() >= expiresAt;
}

/** Ghi mốc hết hạn cố định cho phiên mới; refresh token KHÔNG được gọi hàm này. */
function persistSessionExpiry(expiresAt: number): void {
  localStorage.setItem(SESSION_KEY, String(expiresAt));
}

/**
 * Stores tokens and user profile upon successful login or registration.
 *
 * `SESSION_KEY` chỉ được đặt ở đây (đăng nhập mới). `setAuthTokens` (refresh)
 * cố tình không đụng tới nó — đó là cơ chế chặn phiên vượt quá 2 giờ.
 */
export function setAuthSession(token: string, refreshToken: string, user: User): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    persistSessionExpiry(Date.now() + SESSION_TTL_MS);

    // Also sync to cookie for Next.js middleware / server components if needed
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;

    // Root-level providers (chat, notification badge) đang chờ phiên này.
    notifyAuthChange();
  } catch (err) {
    console.error('Failed to save auth session to localStorage', err);
  }
}

/**
 * Updates only the tokens in storage (used after silent token refresh).
 */
export function setAuthTokens(token: string, refreshToken: string): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    // KHÔNG đặt lại SESSION_KEY: hạn 2 giờ tính từ lần đăng nhập, không phải
    // từ lần refresh gần nhất. Cookie cũng chỉ sống tới hạn phiên còn lại.
    const expiresAt = getSessionExpiresAt();
    const remainingSeconds = expiresAt === null
      ? SESSION_COOKIE_MAX_AGE_SECONDS
      : Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${remainingSeconds}; SameSite=Lax`;
  } catch (err) {
    console.error('Failed to save refreshed tokens to localStorage', err);
  }
}

/**
 * Updates partial user fields in local storage (e.g., after profile update).
 */
export function updateStoredUser(updates: Partial<User>): User | null {
  if (!isClient()) return null;
  try {
    const current = getCurrentUser();
    if (!current) return null;
    const updated = { ...current, ...updates };
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to update user profile in localStorage', err);
    return null;
  }
}

/**
 * Clears all authentication tokens and cached user data from storage.
 */
export function clearAuthSession(): void {
  if (!isClient()) return;
  try {
    // Xoá MỌI dữ liệu thuộc tài khoản trên thiết bị: token, hồ sơ đã cache,
    // mốc phiên và tuỳ chọn thông báo. Nhờ vậy sau khi đăng xuất không còn
    // mảnh dữ liệu nào của tài khoản cũ (không cần F5 để "quên" phiên).
    for (const key of SESSION_SCOPED_KEYS) {
      localStorage.removeItem(key);
    }

    // Expire the cookie
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    // Dừng ngay mọi luồng realtime của tài khoản cũ (chat/badge).
    notifyAuthChange();
  } catch (err) {
    console.error('Failed to clear auth session', err);
  }
}

/**
 * Checks if the user is currently authenticated (access token exists).
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Returns the current authenticated user's role, or null if unauthenticated.
 */
export function getUserRole(): Role | null {
  const user = getCurrentUser();
  return user?.role ?? null;
}

export function isAdminRole(role?: string | null): boolean {
  const normalizedRole = role?.trim().toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN';
}

/**
 * Checks if the logged-in user matches any of the required roles.
 */
export function hasRole(roles: Role[]): boolean {
  const currentRole = getUserRole();
  if (!currentRole) return false;
  return roles.includes(currentRole);
}

/**
 * Complete logout action:
 * Revokes refresh token on backend (fire and forget / best effort),
 * clears client storage, and redirects to login page.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  const rawUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
  const baseUrl = rawUrl.replace(/(\/api\/v1)+$/, '').replace(/\/+$/, '');

  // 1) Xoá phiên CỤC BỘ TRƯỚC. Đăng xuất không được phụ thuộc mạng/back-end:
  //    nếu server chậm hoặc offline, người dùng vẫn thoát ngay và không còn
  //    token nào trên thiết bị để request tiếp theo mang theo.
  clearAuthSession();

  // 2) Thu hồi refresh token ở server (best effort, tối đa 5 giây). Không
  //    `await` vô hạn: một request treo không được giữ người dùng ở lại.
  if (refreshToken) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 5_000) : null;
      try {
        await fetch(`${baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          signal: controller?.signal,
        });
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (error) {
      console.warn('Backend logout call failed or backend offline, local session was already cleared.', error);
    }
  }

  // 3) Điều hướng bằng replace + tải lại toàn trang: mọi state trong RAM (socket,
  //    notification, chat) bị xoá theo, nên không cần F5 thủ công.
  if (isClient()) {
    window.location.replace('/login');
  }
}
