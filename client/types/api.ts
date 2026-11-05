/**
 * 5K-Rental Manager - API Contract & Envelope Types
 * Defines standard response envelopes, pagination metadata, error formats, and request query options.
 */

/**
 * Standard API Success Envelope returned by backend controllers.
 * Example: { success: true, message: "...", data: T }
 */
export interface ApiResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
}

/**
 * Pagination metadata returned by paginated endpoints (e.g. /posts/search).
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Paginated API Response Envelope.
 * Example: { success: true, message?: string, meta: { total, page, limit, totalPages }, data: T[] }
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  message?: string;
  meta: PaginationMeta;
  data: T[];
}

/**
 * Validation error item returned by backend Zod validation middleware.
 */
export interface ApiValidationError {
  field: string;
  message: string;
}

/**
 * Standard API Error Envelope returned by backend on 4xx/5xx responses.
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ApiValidationError[];
}

/**
 * HTTP Request Options extending standard RequestInit with query params and client flags.
 */
export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | (string | number)[] | undefined | null>;
  body?: unknown;
  skipAuth?: boolean;
  skipAutoRefresh?: boolean;
}

/**
 * Unboxed API response return type helper:
 * Automatically extracts data payload or paginated bundle.
 */
export type UnboxedResponse<T> = T extends PaginatedResponse<infer U>
  ? { meta: PaginationMeta; data: U[] }
  : T extends ApiResponse<infer U>
  ? U
  : T;
