/**
 * 5K-Rental Manager - Authentication Session & Token Storage Helper
 * Provides SSR-safe access to JWT access tokens, refresh tokens, and user profiles.
 */

import { Role, User } from '@/types/models';

export const TOKEN_KEY = '5k_access_token';
export const REFRESH_TOKEN_KEY = '5k_refresh_token';
export const USER_KEY = '5k_user_profile';

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
 * Stores tokens and user profile upon successful login or registration.
 */
export function setAuthSession(token: string, refreshToken: string, user: User): void {
  if (!isClient()) return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    // Also sync to cookie for Next.js middleware / server components if needed
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
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
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Expire the cookie
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
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

  if (refreshToken) {
    try {
      await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch (error) {
      console.warn('Backend logout call failed or backend offline, clearing local session anyway.', error);
    }
  }

  clearAuthSession();

  if (isClient()) {
    window.location.replace('/login');
  }
}
