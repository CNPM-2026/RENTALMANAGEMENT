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
  UpdateRoomPayload,
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
  ContractTerminationRequest,
  ContractTerminationStatus,
  CreateContractTerminationPayload,
  ReviewContractTerminationPayload,
  ContractRenewalRequest,
  ContractRenewalStatus,
  CreateContractRenewalPayload,
  RespondContractRenewalPayload,
  MeterReading,
  CreateMeterReadingPayload,
  Invoice,
  GenerateInvoicePayload,
  InvoicePreview,
  OccupancyDeclaration,
  DeclareOccupancyPayload,
  RejectOccupancyPayload,
  ToggleFavoriteResponse,
  Favorite,
  Review,
  CreateReviewPayload,
  ReviewSummaryResponse,
  LifestyleQuestion,
  LifestyleQuestionPayload,
  UserLifestyleAnswer,
  SubmitAnswersPayload,
  UpdatePreferencesPayload,
  RoommatePreference,
  SuggestedRoommate,
  RoommatePostFilters,
  RoommatePostItem,
  Conversation,
  Message,
  CreateConversationPayload,
  Notification,
  Report,
  ResolveReportPayload,
  ModeratePostPayload,
  AdminStatsResponse,
  LandlordStatsResponse,
  SupportTicket,
  CreateSupportTicketPayload,
  MaintenanceRequest,
  CreateMaintenancePayload,
  MaintenanceStatus,
  MaintenanceTriageStatus,
  RentalRequest,
  CreateRentalRequestPayload,
  RoommateInvitation,
  CreateRoommateInvitationPayload,
  KycSubmission,
  KycRole,
  AuditLog,
  StaffMembership,
  MyStaffMembership,
  PublicUserProfile,
  StaffPermission,
  StaffProfile,
  StaffProfilePayload,
  StaffBrowseQuery,
  MaintenanceTask,
  MaintenanceTaskApplicant,
  MaintenanceTaskApplication,
  MaintenanceTaskBrowseQuery,
  MaintenanceTaskStatus,
  MaintenanceNegotiation,
  TaskReviewState,
  CreateDisputePayload,
  DisputeCategory,
  ReportStatus,
} from '@/types/models';

const inFlightWrites = new Map<string, Promise<unknown>>();
import {
  getAuthToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthSession,
  isSessionExpired,
} from '@/lib/auth';

/**
 * Thời gian chờ TỐI ĐA cho một request API (ms).
 *
 * Mọi request đều bị huỷ sau 7 giây thay vì treo vô hạn khi mạng/back-end không
 * phản hồi. Lỗi huỷ được chuyển thành `ApiError` 408 để UI hiển thị thông báo
 * thống nhất và không rơi vào trạng thái "đang tải" mãi.
 */
export const REQUEST_TIMEOUT_MS = 7_000;

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

/** Lỗi khi request vượt quá `REQUEST_TIMEOUT_MS` — code 408 để UI xử lý riêng. */
export class ApiTimeoutError extends ApiError {
  constructor() {
    super('Máy chủ phản hồi quá lâu (quá 7 giây). Vui lòng thử lại.', 408);
    this.name = 'ApiTimeoutError';
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

/**
 * Resolves a media reference returned by the API into a browser-loadable URL.
 *
 * 🆕 Batch 2.1 (M2): maintenance evidence is no longer delivered as a public
 * Cloudinary URL. The API returns a **relative, short-lived** path
 * (`/api/v1/maintenance-images/<kind>/<id>?token=...`) that must be resolved
 * against the API origin, exactly like server-local `/uploads/` files.
 */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  // Server-relative media (local uploads + authorized evidence endpoints).
  if (url.startsWith('/uploads/')) return `${getBaseOriginUrl()}${url}`;
  if (url.startsWith('/api/v1/')) return `${getBaseOriginUrl()}${url}`;
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

  // Phiên quá 2 giờ thì KHÔNG refresh nữa — kể cả khi refresh token còn hạn
  // (server cũng đã chặn bằng hạn tuyệt đối). Tránh vòng lặp gia hạn vô tận.
  if (isSessionExpired()) {
    return null;
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

  // Hết hạn phiên tuyệt đối (2 giờ): chặn NGAY tại client, xoá sạch dữ liệu
  // tài khoản và đưa về trang đăng nhập — không gửi request, không refresh.
  if (!skipAuth && getAuthToken() && isSessionExpired()) {
    clearAuthSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login?expired=1');
    }
    throw new ApiError('Phiên đăng nhập đã hết hạn (tối đa 2 giờ). Vui lòng đăng nhập lại.', 401);
  }

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

  // Timeout cứng 7 giây cho MỌI request. Nếu caller đã truyền `signal` riêng,
  // tôn trọng signal đó và không tạo thêm bộ huỷ thứ hai.
  const timeoutController = fetchOptions.signal ? null : new AbortController();
  const timeoutTimer = timeoutController
    ? setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    : null;

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      cache: 'no-store',
      headers: mergedHeaders,
      body: formattedBody as BodyInit | null | undefined,
      signal: fetchOptions.signal ?? timeoutController?.signal,
    });
  } catch (error) {
    // `AbortError` do timeout của chính client ⇒ lỗi 408 có thể hiển thị được.
    if (timeoutController?.signal.aborted) {
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }

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
    /** Trang cá nhân công khai (mọi role) — không có email/SĐT/toạ độ. */
    getPublicProfile: (id: string) =>
      apiClient.get<PublicUserProfile>(`/users/${id}/public-profile`),
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
    /** 🆕 Sửa phòng: giá điện/nước/sức chứa... (server kiểm tra quyền sở hữu). */
    update: (id: string, payload: UpdateRoomPayload) =>
      apiClient.patch<Room>(`/rooms/${id}`, payload),
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
    /**
     * Tìm bài đăng. Dùng POST vì bộ lọc có thể chứa `lat`/`lng`/`radius`
     * (dữ liệu nhạy cảm); đưa lên URL sẽ lộ trong access log/history/referer.
     */
    search: (query: SearchPostsQuery) =>
      apiClient.post<{ meta: PaginationMeta; data: Post[] }>('/posts/search', query, { skipAuth: true }),
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

    /** Gửi yêu cầu chấm dứt kèm bằng chứng (FormData: reason/details/images/...). */
    createTerminationRequest: (id: string, payload: FormData | CreateContractTerminationPayload) =>
      apiClient.post<ContractTerminationRequest>(`/contracts/${id}/termination-requests`, payload),
    getTerminationRequests: (status?: ContractTerminationStatus) =>
      apiClient.get<ContractTerminationRequest[]>(
        '/contracts/termination-requests',
        status ? { status } : undefined,
      ),
    reviewTerminationRequest: (requestId: string, payload: ReviewContractTerminationPayload) =>
      apiClient.patch<ContractTerminationRequest>(
        `/contracts/termination-requests/${requestId}/review`,
        payload,
      ),
    confirmDepositRefund: (requestId: string) =>
      apiClient.patch<ContractTerminationRequest>(
        `/contracts/termination-requests/${requestId}/refund-paid`,
      ),

    /** Đề xuất ký tiếp; bên còn lại dùng `respondRenewalRequest`. */
    createRenewalRequest: (id: string, payload: CreateContractRenewalPayload) =>
      apiClient.post<ContractRenewalRequest>(`/contracts/${id}/renewal-requests`, payload),
    getRenewalRequests: (status?: ContractRenewalStatus) =>
      apiClient.get<ContractRenewalRequest[]>(
        '/contracts/renewal-requests',
        status ? { status } : undefined,
      ),
    respondRenewalRequest: (requestId: string, payload: RespondContractRenewalPayload) =>
      apiClient.patch<ContractRenewalRequest>(
        `/contracts/renewal-requests/${requestId}/respond`,
        payload,
      ),
  },

  // 8. Meter Readings
  meterReadings: {
    create: (payload: CreateMeterReadingPayload) =>
      apiClient.post<MeterReading>('/meter-readings', payload),
    /** 🆕 Batch 7 — chỉ số gần nhất của phòng, để điền sẵn chỉ số đầu kỳ. */
    getLatest: (roomId: string) =>
      apiClient.get<MeterReading | null>('/meter-readings/latest', { roomId }),
  },

  // 9. Invoices
  invoices: {
    /**
     * 🆕 Xem trước hoá đơn (chỉ đọc). Trả `ready=false` + `blockers` thay vì ném
     * lỗi để form hiển thị lý do cụ thể trước khi phát hành.
     */
    preview: (query: { roomId: string; month: number; year: number; otherFee?: number }) =>
      apiClient.get<InvoicePreview>('/invoices/preview', query),
    generate: (payload: GenerateInvoicePayload) =>
      apiClient.post<Invoice>('/invoices/generate', payload),
    getMyInvoices: () =>
      apiClient.get<Invoice[]>('/invoices/my'),
    pay: (id: string) =>
      apiClient.patch<Invoice>(`/invoices/${id}/pay`),
  },

  /**
   * 🆕 Occupancy — khai báo số người ở (tenant) và xác minh (chủ trọ).
   * Không có endpoint nào cho phép tenant tự xác minh: route verify/reject chỉ
   * cho LANDLORD, service kiểm tra tiếp quyền sở hữu phòng.
   */
  occupancyDeclarations: {
    declare: (payload: DeclareOccupancyPayload) =>
      apiClient.post<OccupancyDeclaration>('/occupancy-declarations', payload),
    getMine: () =>
      apiClient.get<OccupancyDeclaration[]>('/occupancy-declarations/my'),
    getPending: () =>
      apiClient.get<OccupancyDeclaration[]>('/occupancy-declarations/pending'),
    getByRoom: (roomId: string) =>
      apiClient.get<{
        room: Room;
        current: OccupancyDeclaration | null;
        history: OccupancyDeclaration[];
      }>(`/occupancy-declarations/room/${roomId}`),
    verify: (id: string) =>
      apiClient.patch<OccupancyDeclaration>(`/occupancy-declarations/${id}/verify`),
    reject: (id: string, payload: RejectOccupancyPayload) =>
      apiClient.patch<OccupancyDeclaration>(`/occupancy-declarations/${id}/reject`, payload),
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
    /** 🆕 Batch 4 — mình đã đánh giá công việc này chưa, có được đánh giá không. */
    getTaskState: (taskId: string) =>
      apiClient.get<TaskReviewState>(`/reviews/task/${taskId}/state`),
    /** 🆕 Batch 4 — điểm đánh giá tổng hợp của thợ (tính từ review TASK). */
    getStaffSummary: (staffId: string) =>
      apiClient.get<{ averageRating: number; totalReviews: number }>(`/reviews/staff/${staffId}/summary`),
  },

  // 12. Roommate Matching
  matching: {
    getQuestions: () =>
      apiClient.get<LifestyleQuestion[]>('/matching/questions', undefined, { skipAuth: true }),
    getAnswers: () =>
      apiClient.get<UserLifestyleAnswer[]>('/matching/answers'),
    submitAnswers: (payload: SubmitAnswersPayload) =>
      apiClient.post<{ message: string }>('/matching/answers', payload),
    updatePreferences: (payload: UpdatePreferencesPayload) =>
      apiClient.put<Record<string, unknown>>('/matching/preferences', payload),
    getPreferences: () =>
      apiClient.get<RoommatePreference | null>('/matching/preferences'),
    getSuggestions: () =>
      apiClient.get<SuggestedRoommate[]>('/matching/suggestions'),
    /**
     * Bài đăng tìm bạn ở ghép đã duyệt, kèm bộ lọc công khai.
     *
     * Dùng POST vì bộ lọc có `gender` (dữ liệu nhạy cảm); đưa lên URL sẽ lộ
     * trong access log, browser history và referer.
     */
    getRoommatePosts: (query?: RoommatePostFilters) =>
      apiClient.post<RoommatePostItem[]>(
        '/matching/posts/browse',
        query ?? {},
        { skipAuth: false },
      ),
    /** Hồ sơ của một người đang có bài đăng tìm bạn ở ghép được duyệt. */
    getRoommateProfile: (userId: string) =>
      apiClient.get<RoommatePostItem>(`/matching/posts/${userId}`),
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
    /**
     * Gửi tin nhắn VĂN BẢN. Tính năng gửi ảnh đã bị gỡ: API không còn nhận
     * multipart, nên client chỉ gửi JSON `{ content, clientMessageId }`.
     */
    sendMessage: (
      conversationId: string,
      payload: { content: string; clientMessageId?: string },
    ) => apiClient.post<Message>(`/chats/conversations/${conversationId}/messages`, payload),
    markAsRead: (conversationId: string) =>
      apiClient.patch<{ message: string }>(`/chats/conversations/${conversationId}/read`),
  },

  // 14. Notifications
  notifications: {
    getMy: (query?: { since?: string; unreadOnly?: boolean; limit?: number }) =>
      apiClient.get<Notification[]>(
        '/notifications',
        query ? { since: query.since, unreadOnly: query.unreadOnly ? 'true' : undefined, limit: query.limit } : undefined,
      ),
    /** 🆕 Batch 6 — badge chưa đọc; gọi lại sau reconnect để phục hồi trạng thái. */
    getUnreadCount: () =>
      apiClient.get<{ unreadCount: number }>('/notifications/unread-count'),
    getById: (id: string) =>
      apiClient.get<Notification>(`/notifications/${id}`),
    markAsRead: (id: string) =>
      apiClient.patch<Notification>(`/notifications/${id}/read`),
    markAllAsRead: () =>
      apiClient.patch<{ message: string }>('/notifications/read-all'),
  },

  // 15. Reports / Disputes
  reports: {
    /** 🆕 Batch 4 — báo cáo có thể kèm bằng chứng (multipart `images`). */
    create: (payload: CreateDisputePayload | FormData) =>
      apiClient.post<Report>('/reports', payload),
    getMy: () =>
      apiClient.get<Report[]>('/reports/my'),
    getAll: (query?: { status?: ReportStatus; category?: DisputeCategory }) =>
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
    getLifestyleQuestions: () =>
      apiClient.get<LifestyleQuestion[]>('/admin/lifestyle-questions'),
    createLifestyleQuestion: (payload: LifestyleQuestionPayload) =>
      apiClient.post<LifestyleQuestion>('/admin/lifestyle-questions', payload),
    updateLifestyleQuestion: (id: string, payload: Partial<LifestyleQuestionPayload>) =>
      apiClient.patch<LifestyleQuestion>(`/admin/lifestyle-questions/${id}`, payload),
    deleteLifestyleQuestion: (id: string) =>
      apiClient.delete<LifestyleQuestion>(`/admin/lifestyle-questions/${id}`),
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

  /**
   * PHIẾU SỰ CỐ KHÁCH THUÊ (điểm bắt đầu của luồng marketplace).
   * Hoàn toàn khác `maintenanceTasks` bên dưới (marketplace do chủ trọ đăng).
   */
  maintenance: {
    /** Khách thuê báo sự cố; dùng FormData khi gửi kèm ảnh hiện trạng. */
    create: (payload: FormData | CreateMaintenancePayload) =>
      apiClient.post<MaintenanceRequest>('/maintenance', payload),
    getMine: () => apiClient.get<MaintenanceRequest[]>('/maintenance/my'),
    getById: (id: string) => apiClient.get<MaintenanceRequest>(`/maintenance/${id}`),
    updateStatus: (id: string, status: MaintenanceStatus) =>
      apiClient.patch<MaintenanceRequest>(`/maintenance/${id}/status`, { status }),
    /** 🆕 Chủ trọ tiếp nhận: đã xem xét / cần bổ sung thông tin / từ chối. */
    updateTriage: (
      id: string,
      payload: { triageStatus: MaintenanceTriageStatus; triageNote?: string | null },
    ) => apiClient.patch<MaintenanceRequest>(`/maintenance/${id}/triage`, payload),
    /**
     * 🆕 Chuyển sự cố thành công việc cần thợ (multipart vì có thể thêm ảnh).
     * Nơi làm việc do server suy ra từ sự cố — client không gửi property/room/address.
     */
    createTaskFromIssue: (id: string, formData: FormData) =>
      apiClient.post<MaintenanceTask>(`/maintenance/${id}/tasks`, formData),
  },

  /**
   * 🆕 MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2) — `/maintenance-tasks`.
   * Khác `maintenance` ở trên (`/maintenance` = phiếu sự cố khách thuê gửi).
   * KHÔNG có hàm tạo công việc: công việc chỉ được tạo từ sự cố qua
   * `maintenance.createTaskFromIssue`.
   */
  maintenanceTasks: {
    /** Công việc của chính chủ trọ (kèm `_count.applications`). */
    getMine: (status?: MaintenanceTaskStatus) =>
      apiClient.get<MaintenanceTask[]>('/maintenance-tasks/mine', status ? { status } : undefined),
    /**
     * Công việc đang mở — chỉ role STAFF.
     *
     * Dùng POST body vì bộ lọc có thể chứa toạ độ (`latitude`/`longitude`) và
     * bán kính; đưa dữ liệu vị trí vào query string sẽ làm lộ qua access log,
     * browser history và referer.
     */
    browseOpen: (query?: MaintenanceTaskBrowseQuery) =>
      apiClient.post<{ meta: PaginationMeta; data: MaintenanceTask[] }>(
        '/maintenance-tasks/browse',
        query ?? {},
      ),
    getById: (id: string) => apiClient.get<MaintenanceTask>(`/maintenance-tasks/${id}`),
    cancel: (id: string) => apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/cancel`),
    listApplications: (id: string) =>
      apiClient.get<MaintenanceTaskApplicant[]>(`/maintenance-tasks/${id}/applications`),
    acceptApplication: (id: string, applicationId: string) =>
      apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/applications/${applicationId}/accept`),
    rejectApplication: (id: string, applicationId: string) =>
      apiClient.post<{ id: string; status: string }>(
        `/maintenance-tasks/${id}/applications/${applicationId}/reject`,
      ),
    /** Thợ ứng tuyển. Lỗi KYC trả 403 với `code = STAFF_KYC_REQUIRED`. */
    apply: (id: string, payload: { message?: string | null; proposedAmount?: number | null } = {}) =>
      apiClient.post<MaintenanceTaskApplication>(`/maintenance-tasks/${id}/applications`, payload),
    withdraw: (id: string) =>
      apiClient.delete<MaintenanceTaskApplication>(`/maintenance-tasks/${id}/applications/me`),
    getMyApplications: () => apiClient.get<MaintenanceTaskApplication[]>('/maintenance-tasks/applications/mine'),

    // --- 🆕 Batch 3: thợ thực thi & chủ trọ nghiệm thu -----------------------
    /** Việc ĐÃ GIAO cho chính thợ đang đăng nhập (id lấy từ token). */
    getAssigned: (status?: MaintenanceTaskStatus) =>
      apiClient.get<MaintenanceTask[]>('/maintenance-tasks/assigned', status ? { status } : undefined),
    /** Bắt đầu làm việc. Server yêu cầu KYC đã duyệt (403 `STAFF_KYC_REQUIRED`). */
    startWork: (id: string) => apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/start`),
    /**
     * Gửi nghiệm thu. Dùng FormData khi kèm ảnh bằng chứng — server chỉ nhận
     * tệp, KHÔNG nhận URL ảnh do client gửi.
     */
    submitCompletion: (id: string, formData: FormData) =>
      apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/completion`, formData),
    /** Chủ trọ xác nhận hoàn thành (ghi chú tuỳ chọn). */
    confirmCompletion: (id: string, payload: { note?: string | null } = {}) =>
      apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/completion/confirm`, payload),
    /** Chủ trọ yêu cầu làm lại — lý do BẮT BUỘC (>= 10 ký tự, server kiểm tra). */
    rejectCompletion: (id: string, reason: string) =>
      apiClient.post<MaintenanceTask>(`/maintenance-tasks/${id}/completion/reject`, { reason }),

    // --- 🆕 Batch 3: thương lượng giá -------------------------------------
    /** Lịch sử đề xuất + giá đã chốt + quyền phản hồi của người xem. */
    getOffers: (id: string) =>
      apiClient.get<MaintenanceNegotiation>(`/maintenance-tasks/${id}/offers`),
    proposeOffer: (id: string, payload: { amount: number; note?: string | null }) =>
      apiClient.post<MaintenanceNegotiation>(`/maintenance-tasks/${id}/offers`, payload),
    /**
     * Chấp nhận đề xuất của BÊN KIA. `expectedVersion` chống tab cũ áp quyết định
     * lên trạng thái thương lượng mới hơn (server trả 409 NEGOTIATION_VERSION_CONFLICT).
     */
    acceptOffer: (id: string, offerId: string, payload: { expectedVersion?: number; note?: string | null } = {}) =>
      apiClient.post<MaintenanceNegotiation>(`/maintenance-tasks/${id}/offers/${offerId}/accept`, payload),
    rejectOffer: (id: string, offerId: string, payload: { expectedVersion?: number; note?: string | null } = {}) =>
      apiClient.post<MaintenanceNegotiation>(`/maintenance-tasks/${id}/offers/${offerId}/reject`, payload),
    withdrawOffer: (id: string, offerId: string) =>
      apiClient.delete<MaintenanceNegotiation>(`/maintenance-tasks/${id}/offers/${offerId}`),
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
    /** Quyền của CHÍNH mình; `null` = tài khoản không phải nhân viên của chủ trọ nào. */
    getMyMembership: () => apiClient.get<MyStaffMembership | null>('/staff/membership/me'),
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
    /**
     * Chủ trọ khám phá thợ theo kỹ năng / trạng thái (phân trang).
     *
     * POST body để toạ độ/bán kính không xuất hiện trong URL (access log,
     * browser history, referer headers).
     */
    browse: (query?: StaffBrowseQuery) =>
      apiClient.post<{ meta: PaginationMeta; data: StaffProfile[] }>(
        '/staff-marketplace/browse',
        query ?? {},
      ),
    getPublicProfile: (userId: string) =>
      apiClient.get<StaffProfile>(`/staff-marketplace/${userId}`),
  },
};

export default apiClient;
