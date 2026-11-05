/**
 * 5K-Rental Manager - TypeScript Domain Models & Contracts
 * Strictly mapped to backend Prisma schema, database relations, and all 51 REST API endpoints.
 */

// =============================================================================
// 1. SYSTEM ENUMS
// =============================================================================

export type Role = 'ADMIN' | 'LANDLORD' | 'TENANT' | 'AGENT';

export type RoomStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';

export type PostType = 'RENT_OUT' | 'FIND_ROOM' | 'FIND_ROOMMATE';

export type PostStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type ContractStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export type InvoiceStatus = 'UNPAID' | 'PAID';

export type CommissionStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';

export type NotificationType =
  | 'APPOINTMENT'
  | 'POST_APPROVED'
  | 'POST_REJECTED'
  | 'INVOICE'
  | 'MESSAGE'
  | 'CONTRACT'
  | 'COMMISSION'
  | 'SYSTEM';

export type ReviewTargetType = 'POST' | 'USER' | 'ROOM';

export type ReportTargetType = 'POST' | 'USER' | 'ROOM';

export type ReportStatus = 'PENDING' | 'RESOLVED';

// =============================================================================
// 2. CORE DOMAIN ENTITY MODELS
// =============================================================================

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  gender?: string | null;
  dob?: string | null;
  bio?: string | null;
  occupation?: string | null;
  emergencyContact?: string | null;
  createdAt: string;
}

export interface UserWithProfile extends User {
  profile?: UserProfile | null;
}

export interface PropertyImage {
  id: string;
  propertyId: string;
  imageUrl: string;
  isPrimary: boolean;
}

export interface Property {
  id: string;
  landlordId: string;
  name: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  description?: string | null;
  rules?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  createdAt: string;

  // Relations
  landlord?: Partial<User>;
  rooms?: Room[];
  images?: PropertyImage[];
  _count?: {
    rooms: number;
  };
}

export interface Amenity {
  id: string;
  name: string;
  iconUrl?: string | null;
}

export interface RoomAmenity {
  roomId: string;
  amenityId: string;
  amenity?: Amenity;
}

export interface Room {
  id: string;
  propertyId: string;
  roomNumber: string;
  priceMonthly: number;
  priceYearly?: number | null;
  depositAmount: number;
  area: number;
  maxOccupants: number;
  status: RoomStatus;
  createdAt: string;

  // Relations
  property?: Property;
  roomAmenities?: RoomAmenity[];
}

export interface PostImage {
  id: string;
  postId: string;
  imageUrl: string;
  isPrimary: boolean;
}

export interface Post {
  id: string;
  authorId: string;
  propertyId?: string | null;
  roomId?: string | null;
  title: string;
  description: string;
  price?: number | null;
  postType: PostType;
  status: PostStatus;
  viewCount: number;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;

  // Relations
  author?: Partial<User>;
  property?: Partial<Property> | null;
  room?: (Partial<Room> & { roomAmenities?: RoomAmenity[] }) | null;
  images?: PostImage[];
}

export interface Favorite {
  userId: string;
  postId: string;
  createdAt: string;
  user?: Partial<User>;
  post?: Post;
}

export interface LifestyleOption {
  id: string;
  questionId: string;
  optionText: string;
  scoreValue: number;
}

export interface LifestyleQuestion {
  id: string;
  questionText: string;
  category: string;
  weight: number;
  options: LifestyleOption[];
}

export interface UserLifestyleAnswer {
  id: string;
  userId: string;
  questionId: string;
  optionId: string;
  option?: LifestyleOption;
  question?: LifestyleQuestion;
}

export interface RoommatePreference {
  id: string;
  userId: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  preferredGender?: string | null;
  preferredProvince?: string | null;
  preferredDistrict?: string | null;
  preferredWard?: string | null;
  smokingAllowed?: boolean | null;
  petAllowed?: boolean | null;
  cleanlinessLevel?: number | null;
  sleepSchedule?: string | null;
  occupationPreference?: string | null;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  tenantId: string;
  landlordId: string;
  agentId?: string | null;
  roomId?: string | null;
  postId?: string | null;
  appointmentTime: string;
  note?: string | null;
  status: AppointmentStatus;
  createdAt: string;

  // Relations
  tenant?: Partial<User>;
  landlord?: Partial<User>;
  agent?: Partial<User> | null;
  room?: Partial<Room> | null;
  post?: Partial<Post> | null;
}

export interface Contract {
  id: string;
  roomId: string;
  tenantId: string;
  agentId?: string | null;
  startDate: string;
  endDate?: string | null;
  depositPaid: number;
  monthlyRent: number;
  terms?: string | null;
  status: ContractStatus;
  createdAt: string;

  // Relations
  room?: Room & { property?: Partial<Property> };
  tenant?: Partial<User>;
  agent?: Partial<User> | null;
}

export interface Commission {
  id: string;
  contractId: string;
  agentId: string;
  amount: number;
  note?: string | null;
  status: CommissionStatus;
  createdAt: string;
}

export interface MeterReading {
  id: string;
  roomId: string;
  month: number;
  year: number;
  electricityStart: number;
  electricityEnd: number;
  waterStart: number;
  waterEnd: number;
  recordedAt: string;
  room?: Partial<Room>;
}

export interface Invoice {
  id: string;
  roomId: string;
  tenantId: string;
  month: number;
  year: number;
  roomFee: number;
  electricityFee: number;
  waterFee: number;
  otherFee: number;
  totalAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;

  // Relations
  room?: Room & { property?: Partial<Property> };
  tenant?: Partial<User>;
}

export interface ConversationMember {
  conversationId: string;
  userId: string;
  user?: Partial<User>;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  messageType: MessageType;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender?: Partial<User>;
}

export interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  messages?: Message[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: NotificationType;
  isRead: boolean;
  referenceId?: string | null;
  createdAt: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  targetType: ReviewTargetType;
  targetId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer?: Partial<User>;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  reporter?: Partial<User>;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: Partial<User> | null;
}

// =============================================================================
// 3. API ENDPOINT PAYLOADS & RESPONSES (51 ENDPOINTS)
// =============================================================================

// --- Auth Endpoints ---
export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: Role;
}

export interface RegisterResponse {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

// --- User Profile Endpoints ---
export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  bio?: string;
  occupation?: string;
}

// --- Property Endpoints ---
export interface CreatePropertyPayload {
  name: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  description?: string;
  rules?: string;
  latitude?: number;
  longitude?: number;
}

// --- Room Endpoints ---
export interface CreateRoomPayload {
  propertyId: string;
  roomNumber: string;
  priceMonthly: number;
  priceYearly?: number;
  depositAmount?: number;
  area: number;
  maxOccupants?: number;
  amenityIds?: string[];
}

// --- Post Endpoints ---
export interface CreatePostPayload {
  title: string;
  description: string;
  price?: number;
  postType: PostType;
  propertyId?: string;
  roomId?: string;
}

export interface UpdatePostPayload {
  title?: string;
  description?: string;
  price?: number;
  status?: PostStatus;
}

export interface SearchPostsQuery {
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  province?: string;
  district?: string;
  ward?: string;
  amenityIds?: string[];
  lat?: number;
  lng?: number;
  radius?: number;
  sortBy?: 'price_asc' | 'price_desc';
  page?: number;
  limit?: number;
}

// --- Appointment Endpoints ---
export interface CreateAppointmentPayload {
  roomId?: string;
  postId?: string;
  appointmentTime: string;
  note?: string;
}

export interface UpdateAppointmentStatusPayload {
  status: AppointmentStatus;
}

// --- Contract Endpoints ---
export interface CreateContractPayload {
  roomId: string;
  tenantId: string;
  startDate: string;
  endDate?: string;
  depositPaid: number;
  monthlyRent: number;
  terms?: string;
}

export interface UpdateContractStatusPayload {
  status: ContractStatus;
}

// --- Meter Reading Endpoints ---
export interface CreateMeterReadingPayload {
  roomId: string;
  month: number;
  year: number;
  electricityStart: number;
  electricityEnd: number;
  waterStart: number;
  waterEnd: number;
}

// --- Invoice Endpoints ---
export interface GenerateInvoicePayload {
  roomId: string;
  month: number;
  year: number;
  otherFee?: number;
}

// --- Favorite Endpoints ---
export interface ToggleFavoriteResponse {
  message: string;
  isFavorited: boolean;
}

// --- Review Endpoints ---
export interface CreateReviewPayload {
  targetType: ReviewTargetType;
  targetId: string;
  rating: number;
  comment?: string;
}

export interface ReviewSummaryResponse {
  averageRating: number;
  totalReviews: number;
  reviews: Review[];
}

// --- Roommate Matching Endpoints ---
export interface SubmitAnswersPayload {
  answers: Array<{ questionId: string; optionId: string }>;
}

export interface UpdatePreferencesPayload {
  budgetMin?: number;
  budgetMax?: number;
  preferredGender?: string;
  preferredProvince?: string;
  preferredDistrict?: string;
  preferredWard?: string;
  smokingAllowed?: boolean;
  petAllowed?: boolean;
  cleanlinessLevel?: number;
  sleepSchedule?: string;
  occupationPreference?: string;
  note?: string;
}

export interface SuggestedRoommate {
  post: {
    id: string;
    title: string;
    description: string;
    price: number | null;
    createdAt: string;
    expiredAt?: string | null;
    property?: {
      province: string;
      district: string;
      ward: string;
    } | null;
  };
  user: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: Role;
    gender?: string | null;
    occupation?: string | null;
  };
  compatibilityPercent: number;
  isDealBreaker: boolean;
}

// --- Chat Endpoints ---
export interface CreateConversationPayload {
  targetUserId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  messageType?: MessageType;
}

// --- Report Endpoints ---
export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export interface ResolveReportPayload {
  status: ReportStatus;
}

// --- Admin Endpoints ---
export interface ModeratePostPayload {
  status: 'APPROVED' | 'REJECTED';
}

// --- Statistics Endpoints ---
export interface AdminStatsResponse {
  overview: {
    totalUsers: number;
    totalPosts: number;
    totalAppointments: number;
    pendingPosts: number;
    pendingReports: number;
  };
  usersByRole: Array<{
    role: Role;
    count: number;
  }>;
}

export interface LandlordStatsResponse {
  totalRooms: number;
  expectedMonthlyRevenue: number;
  pendingAppointments: number;
  roomsByStatus: Array<{
    status: RoomStatus;
    count: number;
  }>;
}

// =============================================================================
// 4. REAL-TIME SOCKET.IO EVENT MAP
// =============================================================================

export interface SocketEvents {
  // Client to Server
  join_conversation: (conversationId: string) => void;
  send_message: (data: { conversationId: string; content: string; messageType?: MessageType }) => void;
  typing: (data: { conversationId: string; isTyping: boolean }) => void;

  // Server to Client
  receive_message: (message: Message) => void;
  user_typing: (data: { userId: string; isTyping: boolean }) => void;
  new_notification: (notification: Notification) => void;
  error_message: (error: { message: string }) => void;
}
