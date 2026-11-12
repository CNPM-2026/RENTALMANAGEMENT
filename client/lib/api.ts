/**
 * 5K-Rental Manager - Unified API Client Layer
 * Handles base URL prefixing, Bearer token injection, query serialization,
 * envelope unboxing, atomic 401 token refresh queue, and typed API namespaces.
 */

import {
  ApiResponse,
  PaginationMeta,
  ApiErrorResponse,
  ApiValidationError,
  RequestOptions,
} from '@/types/api';
import {
  User,
  UserWithProfile,
  RegisterPayload,
  RegisterResponse,
  LoginPayload,
  LoginResponse,
  RefreshTokenResponse,
  ForgotPasswordPayload,
  ResetPasswordPayload,
  PasswordSetPayload,
  VerifyEmailResponse,
  UpdateProfilePayload,
  Property,
  CreatePropertyPayload,
  Room,
  CreateRoomPayload,
  Amenity,
  Post,
  CreatePostPayload,
  UpdatePostPayload,
  SearchPostsQuery,
  Appointment,
  CreateAppointmentPayload,
  UpdateAppointmentStatusPayload,
  Contract,
  CreateContractPayload,
  UpdateContractStatusPayload,
  MeterReading,
  CreateMeterReadingPayload,
  Invoice,
  GenerateInvoicePayload,
  ToggleFavoriteResponse,
  Favorite,
  Review,
  CreateReviewPayload,
  ReviewSummaryResponse,
  LifestyleQuestion,
  SubmitAnswersPayload,
  UpdatePreferencesPayload,
  RoommatePreference,
  SuggestedRoommate,
  Conversation,
  Message,
  CreateConversationPayload,
  Notification,
  Report,
  CreateReportPayload,
  ResolveReportPayload,
  ModeratePostPayload,
  AdminStatsResponse,
  LandlordStatsResponse,
  SupportTicket,
  CreateSupportTicketPayload,
  MaintenanceRequest,
  CreateMaintenancePayload,
  RentalRequest,
  CreateRentalRequestPayload,
  RoommateInvitation,
  CreateRoommateInvitationPayload,
  KycSubmission,
  KycRole,
  AuditLog,
  StaffMembership,
  StaffPermission,
  StaffProfile,
  StaffProfilePayload,
  StaffBrowseQuery,
} from '@/types/models';

const inFlightWrites = new Map<string, Promise<unknown>>();
import {
  getAuthToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthSession,
} from '@/lib/auth';

/**
 * Standard typed API error representing non-2xx responses.
 */
export class ApiError extends Error {
  status: number;
  errors?: ApiValidationError[];
  data?: unknown;

  constructor(message: string, status: number, errors?: ApiValidationError[], data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

// In-flight refresh promise lock to prevent multiple concurrent refresh calls
let refreshPromise: Promise<string | null> | null = null;

/**
 * Normalizes the base origin URL by removing trailing slashes and any trailing /api/v1.
 * e.g. "http://localhost:3000/api/v1" -> "http://localhost:3000"
 */
export function getBaseOriginUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const raw = (envUrl && envUrl.length > 0 ? envUrl : 'http://localhost:3000').replace(/\/+$/, '');
  return raw.replace(/(\/api\/v1)+$/, '').replace(/\/+$/, '');
}

/**
 * Returns the fully normalized base API URL including /api/v1.
 * e.g. "http://localhost:3000" -> "http://localhost:3000/api/v1"
 * e.g. "http://localhost:3000/api/v1" -> "http://localhost:3000/api/v1"
 */
export function getBaseApiUrl(): string {
  return `${getBaseOriginUrl()}/api/v1`;
}

export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return `${getBaseOriginUrl()}${url}`;
  return url;
}

/**
 * Resolves the full URL, injecting base URL and /api/v1 prefix if missing.
 */
function resolveUrl(path: string, params?: RequestOptions['params']): string {
  const baseUrl = getBaseOriginUrl();

  let fullPath = path;
  if (!fullPath.startsWith('http://') && !fullPath.startsWith('https://')) {
    if (!fullPath.startsWith('/')) {
      fullPath = '/' + fullPath;
    }
    if (fullPath !== '/api/v1' && !fullPath.startsWith('/api/v1/')) {
      fullPath = `/api/v1${fullPath}`;
    }
    fullPath = `${baseUrl}${fullPath}`;
  }

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        // Backend Zod transforms comma-separated strings (e.g. amenityIds=id1,id2)
        searchParams.append(key, value.join(','));
      } else {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullPath += (fullPath.includes('?') ? '&' : '?') + queryString;
    }
  }

  return fullPath;
}

/**
 * Refreshes access token atomically. Queues all callers until completion.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getBaseApiUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearAuthSession();
        return null;
      }

      const body: ApiResponse<RefreshTokenResponse> = await response.json();
      if (body.data?.token && body.data?.refreshToken) {
        setAuthTokens(body.data.token, body.data.refreshToken);
        return body.data.token;
      }
      return null;
    } catch (err) {
      console.error('Token refresh network failure', err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Centralized low-level fetch request wrapper.
 */
async function requestUncoalesced<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, skipAuth, skipAutoRefresh, authToken, ...fetchOptions } = options;
  const url = resolveUrl(path, params);

  const headers: Record<string, string> = {};

  // Inject Bearer token unless explicitly skipped
  if (!skipAuth) {
    const token = authToken ?? getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

  }

  // Handle body content type
  let formattedBody = body;
  if (body !== undefined && body !== null) {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      // Do not set Content-Type header for FormData; fetch will set multipart boundary
    } else if (typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      formattedBody = JSON.stringify(body);
    }
  }

  const mergedHeaders = {
    ...headers,
    ...(fetchOptions.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...fetchOptions,
    cache: 'no-store',
    headers: mergedHeaders,
    body: formattedBody as BodyInit | null | undefined,
  });

  // Handle 401 Unauthorized with token refresh rotation
  const isAuthEndpoint = path.includes('/auth/login') || path.includes('/auth/refresh') || path.includes('/auth/register');
  if (response.status === 401 && !skipAuth && !skipAutoRefresh && !isAuthEndpoint) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry request with newly acquired access token
      return request<T>(path, {
        ...options,
        skipAutoRefresh: true, // Prevent infinite retry loops
      });
    } else {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
      throw new ApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as unknown as T;
  }

  let responseData: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    responseData = await response.json();
  } else {
    responseData = await response.text();
  }

  if (!response.ok) {
    const errorBody = responseData as ApiErrorResponse;
    const message = errorBody?.message || response.statusText || 'Lỗi kết nối máy chủ';
    if (response.status === 403 && typeof window !== 'undefined' && window.location.pathname !== '/403') {
      window.location.replace('/403');
    }
    throw new ApiError(message, response.status, errorBody?.errors, responseData);
  }

  // Envelope Unboxing:
  // If response has { success: true, meta, data }, return { meta, data }
  if (responseData && typeof responseData === 'object') {
    const obj = responseData as Record<string, unknown>;
    if ('meta' in obj && 'data' in obj) {
      return {
        meta: obj.meta,
        data: obj.data,
      } as unknown as T;
    }
    // If standard envelope { success: true, data: ... }, unbox data
    if ('data' in obj) {
      return obj.data as T;
    }
  }

  return responseData as T;
}

export function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = String(options.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || options.skipAutoRefresh) {
    return requestUncoalesced<T>(path, options);
  }

  const body = options.body;
  const bodyKey = typeof body === 'string'
    ? body
    : body && typeof FormData !== 'undefined' && body instanceof FormData
      ? Array.from(body.entries()).map(([key, value]) => [
          key,
          typeof value === 'string'
            ? value
            : `${value.name}:${value.size}:${value.lastModified}`,
        ]).sort().map(([key, value]) => `${key}=${value}`).join('&')
      : JSON.stringify(body ?? null);

  const key = `${method}:${path}:${bodyKey}`;
  const existing = inFlightWrites.get(key);
  if (existing) return existing as Promise<T>;

  const pending = requestUncoalesced<T>(path, options).finally(() => {
    inFlightWrites.delete(key);
  });
  inFlightWrites.set(key, pending);
  return pending;
}

/**
 * Standard HTTP Method wrappers
 */
export const apiClient = {
  get: <T = unknown>(path: string, params?: RequestOptions['params'], options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET', params }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  // ===========================================================================
  // TYPED SERVICE METHODS (51 ENDPOINTS)
  // ===========================================================================

  // 1. Authentication
  auth: {
    register: (payload: RegisterPayload) =>
      apiClient.post<RegisterResponse>('/auth/register', payload, { skipAuth: true }),
    login: (payload: LoginPayload) =>
      apiClient.post<LoginResponse>('/auth/login', payload, { skipAuth: true }),
    refresh: (payload: { refreshToken: string }) =>
      apiClient.post<RefreshTokenResponse>('/auth/refresh', payload, { skipAuth: true }),
    logout: (payload: { refreshToken: string }) =>
      apiClient.post<void>('/auth/logout', payload),
    forgotPassword: (payload: ForgotPasswordPayload) =>
      apiClient.post<{ message: string }>('/auth/forgot-password', payload, { skipAuth: true }),
    resetPassword: (payload: ResetPasswordPayload) =>
      apiClient.post<{ message: string }>('/auth/reset-password', payload, { skipAuth: true }),
    verifyEmail: (payload: { email: string; code: string }) =>
      apiClient.post<VerifyEmailResponse>('/auth/verify-email', payload, { skipAuth: true }),
    // H-05/Batch 2B1: đặt mật khẩu bằng grant ngắn hạn. `skipAuth` vì grant KHÔNG
    // phải access token và request này không được mang Authorization của phiên cũ.
    setPassword: (payload: PasswordSetPayload) =>
      apiClient.post<{ message: string }>('/auth/password/set', payload, { skipAuth: true }),
    resendVerification: (payload: { email: string }) =>
      apiClient.post<{ message: string }>('/auth/resend-verification', payload, { skipAuth: true }),
    getMe: () =>
      apiClient.get<UserWithProfile>('/auth/me'),
    getMeWithToken: (token: string) =>
      apiClient.get<UserWithProfile>('/auth/me', undefined, { authToken: token, skipAutoRefresh: true }),
  },

  // 2. User Profile
  users: {
    updateProfile: (formData: FormData | UpdateProfilePayload) =>
      apiClient.put<User>('/users/profile', formData),
    getMyKyc: () => apiClient.get<KycSubmission | null>('/users/kyc'),
    submitKyc: (payload: FormData) =>
      apiClient.post<KycSubmission>('/users/kyc', payload),
  },

  // 3. Properties
  properties: {
    create: (payload: CreatePropertyPayload) =>
      apiClient.post<Property>('/properties', payload),
    getMyProperties: () =>
      apiClient.get<Property[]>('/properties/my'),
  },

  // 4. Rooms & Amenities
  rooms: {
    create: (payload: CreateRoomPayload) =>
      apiClient.post<Room>('/rooms', payload),
    getByProperty: (propertyId: string) =>
      apiClient.get<Room[]>(`/rooms/property/${propertyId}`),
    delete: (id: string) =>
      apiClient.delete<{ message: string }>(`/rooms/${id}`),
    getAllAmenities: () =>
      apiClient.get<Amenity[]>('/rooms/amenities', undefined, { skipAuth: true }),
  },

  // 5. Posts (Rental Listings)
  posts: {
    getApproved: (query?: { postType?: string; province?: string }) =>
      apiClient.get<Post[]>('/posts', query, { skipAuth: true }),
    search: (query: SearchPostsQuery) =>
      apiClient.get<{ meta: PaginationMeta; data: Post[] }>('/posts/search', query as unknown as RequestOptions['params'], { skipAuth: true }),
    getMyPosts: () =>
      apiClient.get<Post[]>('/posts/my-posts'),
    getById: (id: string) =>
      apiClient.get<Post>(`/posts/${id}`),
    create: (formData: FormData | CreatePostPayload) =>
      apiClient.post<Post>('/posts', formData),
    update: (id: string, formData: FormData | UpdatePostPayload) =>
      apiClient.put<Post>(`/posts/${id}`, formData),
    delete: (id: string) =>
      apiClient.delete<{ message: string }>(`/posts/${id}`),
  },

  // 6. Appointments
  appointments: {
    create: (payload: CreateAppointmentPayload) =>
      apiClient.post<Appointment>('/appointments', payload),
    getMyAppointments: () =>
      apiClient.get<Appointment[]>('/appointments/my'),
    updateStatus: (id: string, payload: UpdateAppointmentStatusPayload) =>
      apiClient.patch<Appointment>(`/appointments/${id}/status`, payload),
  },

  // 7. Contracts
  contracts: {
    create: (payload: CreateContractPayload) =>
      apiClient.post<Contract>('/contracts', payload),
    getMyContracts: () =>
      apiClient.get<Contract[]>('/contracts/my'),
    updateStatus: (id: string, payload: UpdateContractStatusPayload) =>
      apiClient.patch<Contract>(`/contracts/${id}/status`, payload),
  },

  // 8. Meter Readings
  meterReadings: {
    create: (payload: CreateMeterReadingPayload) =>
      apiClient.post<MeterReading>('/meter-readings', payload),
  },

  // 9. Invoices
  invoices: {
    generate: (payload: GenerateInvoicePayload) =>
      apiClient.post<Invoice>('/invoices/generate', payload),
    getMyInvoices: () =>
      apiClient.get<Invoice[]>('/invoices/my'),
    pay: (id: string) =>
      apiClient.patch<Invoice>(`/invoices/${id}/pay`),
  },

  // 10. Favorites
  favorites: {
    toggle: (postId: string) =>
      apiClient.post<ToggleFavoriteResponse>(`/favorites/${postId}`),
    getMyFavorites: () =>
      apiClient.get<Favorite[]>('/favorites'),
  },

  // 11. Reviews
  reviews: {
    create: (payload: CreateReviewPayload) =>
      apiClient.post<Review>('/reviews', payload),
    getByTarget: (targetType: string, targetId: string) =>
      apiClient.get<ReviewSummaryResponse>(`/reviews/${targetType}/${targetId}`, undefined, { skipAuth: true }),
  },

  // 12. Roommate Matching
  matching: {
    getQuestions: () =>
      apiClient.get<LifestyleQuestion[]>('/matching/questions', undefined, { skipAuth: true }),
    submitAnswers: (payload: SubmitAnswersPayload) =>
      apiClient.post<{ message: string }>('/matching/answers', payload),
    updatePreferences: (payload: UpdatePreferencesPayload) =>
      apiClient.put<Record<string, unknown>>('/matching/preferences', payload),
    getPreferences: () =>
      apiClient.get<RoommatePreference | null>('/matching/preferences'),
    getSuggestions: () =>
      apiClient.get<SuggestedRoommate[]>('/matching/suggestions'),
  },

  // 13. Chat
  chats: {
    getOrCreateConversation: (payload: CreateConversationPayload) =>
      apiClient.post<Conversation>('/chats/conversations', payload),
    getMyConversations: () =>
      apiClient.get<Conversation[]>('/chats/conversations'),
    findConversationWithUser: async (targetUserId: string) => {
      const conversations = await apiClient.chats.getMyConversations();
      return conversations.find((conversation) =>
        conversation.members.length === 2
        && conversation.members.some((member) => member.userId === targetUserId)
      ) ?? null;
    },
    getOrCreateConversationWithUser: (targetUserId: string) =>
      apiClient.chats.getOrCreateConversation({ targetUserId }),
    getMessages: (conversationId: string, query?: { page?: number; limit?: number }) =>
      apiClient.get<Message[]>(`/chats/conversations/${conversationId}/messages`, query),
    markAsRead: (conversationId: string) =>
      apiClient.patch<{ message: string }>(`/chats/conversations/${conversationId}/read`),
  },

  // 14. Notifications
  notifications: {
    getMy: () =>
      apiClient.get<Notification[]>('/notifications'),
    getById: (id: string) =>
      apiClient.get<Notification>(`/notifications/${id}`),
    markAsRead: (id: string) =>
      apiClient.patch<Notification>(`/notifications/${id}/read`),
    markAllAsRead: () =>
      apiClient.patch<{ message: string }>('/notifications/read-all'),
  },

  // 15. Reports
  reports: {
    create: (payload: CreateReportPayload) =>
      apiClient.post<Report>('/reports', payload),
    getMy: () =>
      apiClient.get<Report[]>('/reports/my'),
    getAll: (query?: { status?: string }) =>
      apiClient.get<Report[]>('/reports', query),
    resolve: (id: string, payload: ResolveReportPayload) =>
      apiClient.patch<Report>(`/reports/${id}/resolve`, payload),
  },

  // 16. Admin Governance
  admin: {
    getPendingPosts: () =>
      apiClient.get<Post[]>('/admin/posts/pending'),
    moderatePost: (id: string, payload: ModeratePostPayload) =>
      apiClient.patch<Post>(`/admin/posts/${id}/status`, payload),
    deletePost: (id: string) =>
      apiClient.delete<Post>(`/admin/posts/${id}`),
    updateUserStatus: (id: string, isActive: boolean) =>
      apiClient.patch<User>(`/admin/users/${id}/status`, { isActive }),
    getContentFilterKeywords: () =>
      apiClient.get<Array<{ id: string; keyword: string }>>('/admin/content-filter'),
    addContentFilterKeyword: (keyword: string) =>
      apiClient.post<{ id: string; keyword: string }>('/admin/content-filter', { keyword }),
    removeContentFilterKeyword: (id: string) =>
      apiClient.delete<{ id: string }>(`/admin/content-filter/${id}`),
    getAmenities: () =>
      apiClient.get<Amenity[]>('/admin/amenities'),
    createAmenity: (payload: { name: string; iconUrl?: string }) =>
      apiClient.post<Amenity>('/admin/amenities', payload),
    deleteAmenity: (id: string) =>
      apiClient.delete<Amenity>(`/admin/amenities/${id}`),
  },

  // 17. Statistics
  statistics: {
    getAdminStats: () =>
      apiClient.get<AdminStatsResponse>('/statistics/admin'),
    getLandlordStats: () =>
      apiClient.get<LandlordStatsResponse>('/statistics/landlord'),
  },

  support: {
    create: (payload: CreateSupportTicketPayload) =>
      apiClient.post<SupportTicket>('/support', payload),
    getMine: () => apiClient.get<SupportTicket[]>('/support/my'),
    getById: (id: string) => apiClient.get<SupportTicket>(`/support/${id}`),
    getAll: (status?: string) => apiClient.get<SupportTicket[]>('/support/admin', status ? { status } : undefined),
    update: (id: string, payload: { status?: string; adminReply?: string }) =>
      apiClient.patch<SupportTicket>(`/support/${id}`, payload),
  },

  maintenance: {
    create: (payload: CreateMaintenancePayload) =>
      apiClient.post<MaintenanceRequest>('/maintenance', payload),
    getMine: () => apiClient.get<MaintenanceRequest[]>('/maintenance/my'),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<MaintenanceRequest>(`/maintenance/${id}/status`, { status }),
  },

  rentalRequests: {
    create: (payload: CreateRentalRequestPayload) =>
      apiClient.post<RentalRequest>('/rental-requests', payload),
    getMine: () => apiClient.get<RentalRequest[]>('/rental-requests/my'),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<RentalRequest>(`/rental-requests/${id}/status`, { status }),
  },

  roommateInvitations: {
    create: (payload: CreateRoommateInvitationPayload) =>
      apiClient.post<RoommateInvitation>('/roommate-invitations', payload),
    getMine: (type: 'received' | 'sent') =>
      apiClient.get<RoommateInvitation[]>('/roommate-invitations/my', { type }),
    updateStatus: (id: string, status: string) =>
      apiClient.patch<RoommateInvitation>(`/roommate-invitations/${id}/status`, { status }),
  },

  adminGovernance: {
    getUsers: (query?: { role?: string; search?: string }) =>
      apiClient.get<User[]>('/admin/users', query),
    updateUserStatus: (id: string, isActive: boolean) =>
      apiClient.patch<User>(`/admin/users/${id}/status`, { isActive }),
    /** `role` lọc hàng đợi theo người nộp (`LANDLORD` | `STAFF`); bỏ trống = cả hai. */
    getKyc: (status?: string, role?: KycRole) =>
      apiClient.get<KycSubmission[]>('/admin/kyc', { status, role }),
    updateKyc: (id: string, payload: { status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      apiClient.patch<KycSubmission>(`/admin/kyc/${id}/status`, payload),
    getAuditLogs: (query?: { search?: string; limit?: number }) =>
      apiClient.get<AuditLog[]>('/admin/audit-logs', query),
  },
  staff: {
    getMine: () => apiClient.get<StaffMembership[]>('/staff'),
    invite: (payload: { email: string; permissions: StaffPermission[] }) =>
      apiClient.post<StaffMembership>('/staff', payload),
    update: (id: string, payload: { permissions?: StaffPermission[]; isActive?: boolean }) =>
      apiClient.patch<StaffMembership>(`/staff/${id}`, payload),
    remove: (id: string) => apiClient.delete<void>(`/staff/${id}`),
  },

  /**
   * 🆕 STAFF MARKETPLACE — hồ sơ thợ độc lập (role = STAFF).
   * Khác `staff` ở trên (`StaffMembership` = nhân viên do chủ trọ cấp quyền).
   */
  staffMarketplace: {
    /** Hồ sơ của chính mình; `null` nếu thợ chưa hoàn thiện hồ sơ. */
    getMe: () => apiClient.get<StaffProfile | null>('/staff-marketplace/me'),
    upsertMe: (payload: StaffProfilePayload) =>
      apiClient.put<StaffProfile>('/staff-marketplace/me', payload),
    updateAvailability: (isAvailable: boolean) =>
      apiClient.patch<StaffProfile>('/staff-marketplace/me/availability', { isAvailable }),
    /** Chủ trọ khám phá thợ theo kỹ năng / trạng thái (phân trang). */
    browse: (query?: StaffBrowseQuery) =>
      apiClient.get<{ meta: PaginationMeta; data: StaffProfile[] }>(
        '/staff-marketplace',
        query as unknown as RequestOptions['params'],
      ),
    getPublicProfile: (userId: string) =>
      apiClient.get<StaffProfile>(`/staff-marketplace/${userId}`),
  },
};

export default apiClient;
