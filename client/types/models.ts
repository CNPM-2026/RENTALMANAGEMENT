/**
 * 5K-Rental Manager - TypeScript Domain Models & Contracts
 * Strictly mapped to backend Prisma schema, database relations, and all 51 REST API endpoints.
 */

// =============================================================================
// 1. SYSTEM ENUMS
// =============================================================================

export type Role = 'ADMIN' | 'LANDLORD' | 'TENANT' | 'STAFF';

export type RoomStatus = 'AVAILABLE' | 'RENTED' | 'MAINTENANCE';

export type PostType = 'RENT_OUT' | 'FIND_ROOM' | 'FIND_ROOMMATE';

export type PostStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLOSED';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export type ContractStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export type ContractTerminationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ContractTerminationReason =
  | 'TENANT_MOVED_OUT'
  | 'TENANT_VIOLATION'
  | 'LANDLORD_VIOLATION'
  | 'MUTUAL_AGREEMENT'
  | 'OTHER';

export type DepositRefundStatus = 'NOT_REQUIRED' | 'PENDING' | 'PAID';

export type ContractRenewalStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CANCELLED';

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
  | 'SYSTEM'
  /** 🆕 Batch 2 — thông báo marketplace công việc (ứng tuyển / nhận việc). */
  | 'TASK'
  /** 🆕 Batch 3 — thương lượng giá. */
  | 'OFFER'
  /** 🆕 Batch 4 — đánh giá công việc và tranh chấp. */
  | 'REVIEW'
  | 'DISPUTE'
  /** 🆕 Occupancy — khai báo số người ở / kết quả xác minh. */
  | 'OCCUPANCY'
  /** 🆕 Chấm dứt / ký tiếp hợp đồng. */
  | 'CONTRACT_TERMINATION'
  | 'CONTRACT_RENEWAL';

/**
 * 🆕 Occupancy — trạng thái khai báo số người ở.
 * Chỉ VERIFIED (hoặc SUPERSEDED đã từng VERIFIED trước cuối kỳ) mới dùng để tính
 * tiền nước; PENDING/REJECTED thì không bao giờ.
 */
export type OccupancyDeclarationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED';

/** 🆕 Batch 4 — đánh giá cả CÔNG VIỆC đã hoàn thành (`targetId` = task id). */
export type ReviewTargetType = 'POST' | 'USER' | 'ROOM' | 'TASK';

/** 🆕 Batch 4 — báo cáo có thể nhắm vào chính công việc. */
export type ReportTargetType = 'POST' | 'USER' | 'ROOM' | 'TASK';

/** 🆕 Batch 4 — vòng đời xử lý tranh chấp (RESOLVED/REJECTED là trạng thái cuối). */
export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

/** 🆕 Batch 4 — phân loại tranh chấp (mirror enum `DisputeCategory`). */
export type DisputeCategory =
  | 'WORK_QUALITY'
  | 'NO_SHOW'
  | 'PRICE_DISPUTE'
  | 'SAFETY'
  | 'HARASSMENT'
  | 'FRAUD'
  | 'PROPERTY_DAMAGE'
  | 'OTHER';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/**
 * 🆕 Batch 2 (điều chỉnh luồng) — trạng thái TIẾP NHẬN báo cáo sự cố của chủ trọ.
 * Tách khỏi `MaintenanceStatus` (vòng đời xử lý) và khỏi `MaintenanceTaskStatus`
 * (công việc marketplace): một sự cố có thể "cần bổ sung thông tin" trong khi
 * công việc chưa hề tồn tại.
 */
export type MaintenanceTriageStatus = 'PENDING' | 'REVIEWED' | 'NEEDS_INFO' | 'REJECTED';
export type RentalRequestStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'CONTRACT_READY' | 'SIGNED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Trạng thái KYC đầy đủ như server trả về: `NONE` = tài khoản chưa từng nộp hồ sơ.
 * Dùng chung cho chủ trọ và thợ vì cả hai ghi vào cùng bảng `kyc_submissions`.
 */
export type KycState = 'NONE' | KycStatus;

/** Các role có hồ sơ trong hàng đợi KYC của admin (cùng bảng `kyc_submissions`). */
export type KycRole = 'LANDLORD' | 'STAFF';

/**
 * 🆕 Nhóm kỹ năng / loại dịch vụ của THỢ ĐỘC LẬP (mirror enum `ServiceCategory`
 * trong Prisma schema). Dùng mảng có kiểm soát thay cho text tự do.
 */
export type ServiceCategory =
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'WATER_LEAK'
  | 'FURNITURE'
  | 'AIR_CONDITIONER'
  | 'PAINTING'
  | 'CLEANING'
  | 'GENERAL_MAINTENANCE';

/**
 * 🆕 Trạng thái CÔNG VIỆC bảo trì (mirror `MaintenanceTaskStatus`).
 * Không có `APPLIED`: "đã có người ứng tuyển" là trạng thái của ĐƠN, không phải
 * của công việc — xem `MaintenanceApplicationStatus`.
 *
 * 🆕 Batch 3 — vòng đời thực thi/nghiệm thu:
 * ASSIGNED → IN_PROGRESS (thợ bắt đầu) → SUBMITTED (thợ gửi nghiệm thu)
 * → COMPLETED (chủ trọ xác nhận) hoặc quay lại IN_PROGRESS (yêu cầu làm lại).
 */
export type MaintenanceTaskStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED'
  | 'CANCELLED';

/** 🆕 Trạng thái ĐƠN ỨNG TUYỂN của thợ (mirror `MaintenanceApplicationStatus`). */
export type MaintenanceApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

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
  electricityRate?: number | null;
  waterRate?: number | null;
  internetFee?: number | null;
  serviceFee?: number | null;
  parkingFee?: number | null;
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
  _count?: {
    answers: number;
  };
}

export interface LifestyleOptionPayload {
  id?: string;
  optionText: string;
  scoreValue: number;
}

export interface LifestyleQuestionPayload {
  questionText: string;
  category: string;
  weight: number;
  options: LifestyleOptionPayload[];
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
  hasRoom?: boolean | null;
  currentProvince?: string | null;
  currentDistrict?: string | null;
  currentWard?: string | null;
  currentAddress?: string | null;
  currentRent?: number | null;
  currentArea?: number | null;
  currentOccupants?: number | null;
  roommateSlots?: number | null;
  moveInDate?: string | null;
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
  /** Server suy ra từ `endDate`; hợp đồng quá hạn vẫn có thể đang ACTIVE. */
  isExpired?: boolean;

  // Relations
  room?: Room & { property?: Partial<Property> };
  tenant?: Partial<User>;
  agent?: Partial<User> | null;
}

export interface ContractTerminationAttachment {
  id: string;
  requestId: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  url: string;
}

export interface ContractTerminationRequest {
  id: string;
  contractId: string;
  requestedById: string;
  initiatorRole: Role;
  reason: ContractTerminationReason;
  details: string;
  requestedEffectiveDate?: string | null;
  status: ContractTerminationStatus;
  depositRefundRequired: boolean;
  depositRefundAmount?: number | null;
  refundStatus: DepositRefundStatus;
  refundPaidAt?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: ContractTerminationAttachment[];
  contract?: Contract;
  requestedBy?: Partial<User>;
  reviewedBy?: Partial<User> | null;
}

export interface ContractRenewalRequest {
  id: string;
  contractId: string;
  requestedById: string;
  proposedEndDate?: string | null;
  proposedMonthlyRent?: number | null;
  note?: string | null;
  status: ContractRenewalStatus;
  respondedById?: string | null;
  respondedAt?: string | null;
  responseNote?: string | null;
  createdAt: string;
  updatedAt: string;
  contract?: Contract;
  requestedBy?: Partial<User>;
  respondedBy?: Partial<User> | null;
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
  /** Phí cố định snapshot từ cấu hình phòng khi phát hành (0 nếu chưa cấu hình). */
  internetFee: number;
  serviceFee: number;
  parkingFee: number;
  otherFee: number;
  totalAmount: number;
  /**
   * 🆕 Snapshot tại thời điểm phát hành. `null` với hoá đơn cũ (trước delta) —
   * UI phải hiển thị "không có dữ liệu" chứ không tự suy ra từ giá hiện tại.
   */
  electricityStart?: number | null;
  electricityEnd?: number | null;
  electricityConsumption?: number | null;
  waterConsumption?: number | null;
  waterOccupants?: number | null;
  electricityUnitPrice?: number | null;
  waterUnitPrice?: number | null;
  occupancyDeclarationId?: string | null;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;

  // Relations
  room?: Room & { property?: Partial<Property> };
  tenant?: Partial<User>;
}

/**
 * 🆕 Occupancy — một bản khai báo số người ở (bất biến sau khi tạo).
 * Mỗi thay đổi tạo row mới PENDING; row cũ thành SUPERSEDED.
 */
export interface OccupancyDeclaration {
  id: string;
  roomId: string;
  tenantId: string;
  contractId?: string | null;
  occupants: number;
  status: OccupancyDeclarationStatus;
  declaredById: string;
  declaredAt: string;
  verifiedById?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  supersededAt?: string | null;
  createdAt: string;

  room?: {
    id: string;
    roomNumber: string;
    maxOccupants: number;
    electricityRate?: number | null;
    waterRate?: number | null;
    property?: { id?: string; name?: string; landlordId?: string };
  };
  tenant?: Partial<User>;
  declaredBy?: Partial<User>;
  verifiedBy?: Partial<User> | null;
  contract?: { id: string; status: ContractStatus; startDate: string; endDate?: string | null } | null;
}

export type InvoiceBlockerCode =
  | 'CONTRACT_REQUIRED'
  | 'INVOICE_EXISTS'
  | 'READING_REQUIRED'
  | 'READING_INVALID'
  | 'INVALID_UNIT_PRICE'
  | 'INVALID_ROOM_FEE'
  | 'INVALID_ROOM_EXTRA_FEE'
  | 'INVALID_OTHER_FEE';

/** 🆕 Trả về từ GET /invoices/preview — nguồn sự thật của công thức hiển thị. */
export interface InvoicePreview {
  roomId: string;
  roomNumber: string;
  month: number;
  year: number;
  periodEnd: string;
  ready: boolean;
  blockers: { code: InvoiceBlockerCode; message: string; statusCode: number }[];
  contract: { id: string; tenantId: string } | null;
  reading: {
    electricityStart: number;
    electricityEnd: number;
    waterStart: number;
    waterEnd: number;
    electricityConsumption: number | null;
    waterConsumption: number | null;
  } | null;
  occupancy: { declarationId: string | null; occupants: number; verified: boolean } | null;
  unitPrices: { electricity: string | null; water: string | null };
  fees: {
    roomFee: string;
    electricityFee: string;
    waterFee: string;
    internetFee: string;
    serviceFee: string;
    parkingFee: string;
    otherFee: string;
    totalAmount: string;
  } | null;
}

export interface DeclareOccupancyPayload {
  roomId: string;
  occupants: number;
}

export interface RejectOccupancyPayload {
  reason: string;
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
  /**
   * 🆕 Batch 5 — tệp đính kèm riêng tư. `url` là đường dẫn NGẮN HẠN có token do
   * server cấp cho ĐÚNG người xem; không bao giờ là URL Cloudinary công khai.
   */
  attachment?: {
    url: string;
    mimeType: string;
    byteSize: number;
    name: string;
  } | null;
  /** 🆕 Batch 5 — id do client sinh để retry không tạo tin nhắn trùng. */
  clientMessageId?: string | null;
}

export interface Conversation {
  id: string;
  /** 🆕 Batch 5 — hội thoại gắn với công việc (STAFF ↔ LANDLORD/TENANT). */
  taskId?: string | null;
  createdAt: string;
  updatedAt: string;
  members: ConversationMember[];
  messages?: Message[];
  lastMessage?: Message | null;
  unreadCount?: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  type: NotificationType;
  isRead: boolean;
  /** 🆕 Batch 6 — thời điểm đọc (NULL = chưa đọc). */
  readAt?: string | null;
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
  /** 🆕 Batch 4 — phân loại tranh chấp. */
  category?: DisputeCategory;
  /** 🆕 Batch 4 — công việc liên quan (nếu có). */
  taskId?: string | null;
  reason: string;
  status: ReportStatus;
  /** 🆕 Batch 4 — kết luận của admin khi RESOLVED/REJECTED. */
  resolution?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: Partial<User> | null;
  task?: { id: string; title: string; status: MaintenanceTaskStatus } | null;
  /** 🆕 Batch 4 — bằng chứng riêng tư (URL có token, hạn ngắn). */
  attachments?: Array<{ id: string; url: string }>;
  createdAt: string;
  updatedAt?: string;
  reporter?: Partial<User>;
  target?: {
    id: string;
    title?: string;
    status?: PostStatus;
    roomNumber?: string;
    name?: string;
    fullName?: string;
    email?: string;
    isActive?: boolean;
    author?: Partial<User>;
    property?: { name: string; landlordId: string };
  } | null;
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

export interface SupportTicket {
  id: string;
  userId: string;
  roomId?: string | null;
  category: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: MaintenancePriority;
  adminReply?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Partial<User> | null;
  room?: Partial<Room> | null;
}

/** 🆕 Ảnh hiện trạng khách thuê gửi kèm báo cáo sự cố. */
export interface MaintenanceIssueImage {
  id: string;
  imageUrl: string;
}

/** 🆕 Công việc marketplace đã được tạo TỪ một sự cố (chỉ đọc trong payload sự cố). */
export interface MaintenanceIssueTaskLink {
  id: string;
  title: string;
  status: MaintenanceTaskStatus;
  assignedStaffId?: string | null;
  createdAt: string;
}

export interface MaintenanceRequest {
  id: string;
  tenantId: string;
  landlordId: string;
  roomId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  /** 🆕 Danh mục sự cố (null với báo cáo cũ chưa phân loại). */
  category?: ServiceCategory | null;
  /** 🆕 Trạng thái tiếp nhận của chủ trọ — độc lập với `status`. */
  triageStatus: MaintenanceTriageStatus;
  triageNote?: string | null;
  triageUpdatedAt?: string | null;
  images?: MaintenanceIssueImage[];
  /** 🆕 Việc cần thợ đã tạo từ sự cố này (mới nhất trước). */
  tasks?: MaintenanceIssueTaskLink[];
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  room?: Partial<Room> & { property?: Partial<Property> | null };
  tenant?: Partial<User>;
}

export interface RentalRequest {
  id: string;
  tenantId: string;
  landlordId: string;
  roomId: string;
  moveInDate: string;
  leaseTermMonths: number;
  occupantsCount: number;
  note?: string | null;
  status: RentalRequestStatus;
  createdAt: string;
  updatedAt: string;
  room?: Room;
  tenant?: Partial<User>;
}

export interface RoommateInvitation {
  id: string;
  senderId: string;
  recipientId: string;
  postId?: string | null;
  message?: string | null;
  status: InvitationStatus;
  createdAt: string;
  updatedAt: string;
  sender?: UserWithProfile;
  recipient?: UserWithProfile;
  post?: { id: string; title: string } | null;
  /** Chỉ có trong response chấp nhận: hệ thống tự từ chối vì vượt sức chứa. */
  autoRejected?: boolean;
  rejectionReason?: string;
  capacity?: {
    roomId: string;
    roomNumber: string;
    maxOccupants: number;
    occupiedBefore: number;
    requestedOccupants: number;
  };
  occupancyDeclarationId?: string | null;
}

export interface KycSubmission {
  id: string;
  userId: string;
  idNumber: string;
  permanentAddress: string;
  frontIdUrl: string;
  backIdUrl: string;
  status: KycStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Partial<User>;
}

export type StaffPermission = 'PROPERTIES_ROOMS' | 'MAINTENANCE' | 'INVOICES' | 'APPOINTMENTS';

/**
 * Quyền nhân viên của CHÍNH mình (`GET /staff/membership/me`).
 * `landlord` = chủ trọ đã cấp quyền; API trả `null` khi tài khoản không phải
 * nhân viên của bất kỳ chủ trọ nào.
 */
/**
 * Hồ sơ công khai trả từ `GET /users/:id/public-profile`.
 * Không chứa email/số điện thoại/toạ độ — chỉ dữ liệu người khác được xem.
 */
export interface PublicUserProfile {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  role: Role;
  joinedAt: string;
  bio?: string | null;
  occupation?: string | null;
  kycVerified: boolean;
  stats: {
    completedTasks?: number;
    reviewCount?: number;
    averageRating?: number;
    properties?: number;
    rooms?: number;
    activeContracts?: number;
  };
  staffProfile?: {
    description?: string | null;
    serviceAddress?: string | null;
    priceMin?: string | number | null;
    priceMax?: string | number | null;
    isAvailable: boolean;
    skills: Array<{ category: ServiceCategory }>;
  } | null;
}

export interface MyStaffMembership {
  id: string;
  landlordId: string;
  permissions: StaffPermission[];
  createdAt: string;
  landlord: { id: string; fullName: string; avatarUrl?: string | null };
}


export interface StaffMembership {
  id: string;
  permissions: StaffPermission[];
  isActive: boolean;
  createdAt: string;
  user: Pick<User, 'id' | 'email' | 'fullName' | 'phone' | 'avatarUrl'>;
}

/**
 * 🆕 Hồ sơ THỢ ĐỘC LẬP (marketplace) — khác hoàn toàn `StaffMembership`
 * (nhân viên được chủ trọ cấp quyền). Trả về từ `/staff-marketplace/*`.
 *
 * `priceMin`/`priceMax` là Decimal của Prisma nên trong JSON là string.
 * `latitude`/`longitude` chỉ có ở hồ sơ của chính thợ (API công khai không trả
 * toạ độ để tránh lộ vị trí nhà).
 */
export interface StaffProfile {
  id: string;
  userId: string;
  description?: string | null;
  serviceAddress?: string | null;
  priceMin?: string | number | null;
  priceMax?: string | number | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  skills: Array<{ category: ServiceCategory }>;
  user: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    email?: string;
    phone?: string | null;
    role?: Role;
    isActive?: boolean;
  };
  latitude?: number | null;
  longitude?: number | null;
  /**
   * Trạng thái KYC của thợ, đọc từ bảng dùng chung `kyc_submissions`
   * (`NONE` = chưa từng nộp). Chỉ `APPROVED` mới được bật "đang nhận việc".
   */
  kycStatus?: KycState;
  /**
   * 🆕 Khoảng cách (km) từ toạ độ chủ trọ tới khu vực thợ, do SERVER tính.
   * `null` = không xác định được (thợ chưa khai báo toạ độ hoặc chủ trọ không
   * gửi toạ độ) — UI phải hiển thị "chưa rõ", không được tự suy diễn.
   */
  distanceKm?: number | null;
}

/** Payload cập nhật hồ sơ thợ (`PUT /staff-marketplace/me`). */
export interface StaffProfilePayload {
  description?: string | null;
  serviceAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  isAvailable?: boolean;
  skills?: ServiceCategory[];
}

export interface StaffBrowseQuery {
  category?: ServiceCategory;
  isAvailable?: boolean;
  search?: string;
  /** Toạ độ của chủ trọ/bất động sản để server tính khoảng cách (km). */
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: 'newest' | 'nearest';
  page?: number;
  limit?: number;
}

// -----------------------------------------------------------------------------
// 🆕 MARKETPLACE CÔNG VIỆC BẢO TRÌ (Batch 2)
// -----------------------------------------------------------------------------

export interface MaintenanceTaskImage {
  id: string;
  imageUrl: string;
  /**
   * 🆕 Batch 3 — `TASK` = ảnh hiện trạng (chủ trọ tải lúc đăng việc),
   * `COMPLETION` = bằng chứng nghiệm thu (thợ tải khi hoàn thành). Server đã
   * tách sẵn thành `images` / `completionImages`, trường này chỉ để tham chiếu.
   */
  kind?: 'TASK' | 'COMPLETION';
}

export interface MaintenanceTaskApplicant {
  id: string;
  taskId: string;
  staffId: string;
  message?: string | null;
  /** 🆕 Batch 3 — giá thợ đề nghị cho công việc này. */
  proposedAmount?: string | null;
  status: MaintenanceApplicationStatus;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Trạng thái KYC hiện tại của thợ (đã phẳng hoá từ quan hệ). */
  kycStatus?: KycState;
  staff: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    /** Chỉ chủ trọ của công việc / admin nhận được số này. */
    phone?: string | null;
    staffProfile?: {
      description?: string | null;
      serviceAddress?: string | null;
      priceMin?: string | number | null;
      priceMax?: string | number | null;
      isAvailable: boolean;
      skills: Array<{ category: ServiceCategory }>;
    } | null;
  };
}

export interface MaintenanceTask {
  id: string;
  landlordId: string;
  propertyId: string;
  roomId?: string | null;
  title: string;
  description: string;
  category: ServiceCategory;
  address: string;
  /** Chỉ có ở chi tiết công việc mà người xem đã có quyền đọc. */
  latitude?: number | null;
  longitude?: number | null;
  budgetMin?: string | number | null;
  budgetMax?: string | number | null;
  urgency: MaintenancePriority;
  preferredStartAt?: string | null;
  preferredEndAt?: string | null;
  additionalInstructions?: string | null;
  status: MaintenanceTaskStatus;
  assignedStaffId?: string | null;
  assignedApplicationId?: string | null;
  assignedAt?: string | null;
  /**
   * 🆕 Batch 3 — dấu vết thực thi & nghiệm thu.
   * `completionSubmittedAt` là mốc nộp GẦN NHẤT (giữ lại sau khi bị yêu cầu làm
   * lại); `completionReviewedAt`/`completionReviewNote` là kết quả duyệt GẦN
   * NHẤT. Nếu `completionReviewedAt < completionSubmittedAt` thì lần nộp hiện
   * tại đang chờ duyệt và ghi chú kia là lý do của lần trước.
   */
  startedAt?: string | null;
  completionSubmittedAt?: string | null;
  completionNote?: string | null;
  completionReviewedAt?: string | null;
  completionReviewNote?: string | null;
  completionAttempts?: number;
  /**
   * 🆕 Batch 3 — giá ĐÃ CHỐT giữa hai bên. `null` = chưa thống nhất giá, và khi
   * đó server từ chối cho thợ bắt đầu (`code = PRICE_NOT_AGREED`).
   */
  agreedAmount?: string | null;
  agreedAt?: string | null;
  /** Bộ đếm phiên bản thương lượng — gửi kèm khi chấp nhận/từ chối đề xuất. */
  negotiationVersion?: number;
  /**
   * 🆕 Sự cố khách thuê mà công việc này bắt nguồn từ đó. Luôn có giá trị: mọi
   * công việc marketplace đều được tạo từ báo cáo sự cố (Variant B).
   */
  sourceIssueId: string;
  createdAt: string;
  updatedAt: string;
  /** Có ở danh sách "công việc của tôi". */
  _count?: { applications: number };
  property?: {
    id: string;
    name: string;
    address: string;
    province?: string;
    district?: string;
    ward?: string;
  } | null;
  room?: { id: string; roomNumber: string } | null;
  skills?: Array<{ category: ServiceCategory }>;
  /**
   * 🆕 Batch 2.1: `imageUrl` là đường dẫn NGẮN HẠN (`/api/v1/maintenance-images/…`)
   * do server cấp, không phải URL Cloudinary công khai — hãy đi qua
   * `resolveMediaUrl`. Danh sách marketplace không trả ảnh (chỉ `imageCount`).
   */
  images?: MaintenanceTaskImage[];
  /**
   * 🆕 Batch 3 — ảnh BẰNG CHỨNG NGHIỆM THU do thợ gửi (tách khỏi `images`).
   * Cùng định dạng đường dẫn ngắn hạn như trên.
   */
  completionImages?: MaintenanceTaskImage[];
  /** Có ở danh sách marketplace: số ảnh hiện trạng, không kèm đường dẫn. */
  imageCount?: number;
  /** Khoảng cách từ toạ độ đã gửi tới nơi làm việc; `null` = chưa xác định. */
  distanceKm?: number | null;
  /** Đơn của CHÍNH thợ đang xem (nếu có). */
  myApplication?: { id: string; status: MaintenanceApplicationStatus } | null;
  /** Chỉ có khi xem chi tiết: người xem có phải chủ trọ của công việc. */
  isOwner?: boolean;
  /**
   * 🆕 Batch 3 — cờ GỢI Ý cho UI (server vẫn kiểm tra lại mọi thao tác).
   * Chỉ có ở payload chi tiết công việc.
   */
  isAssignee?: boolean;
  canStartWork?: boolean;
  canSubmitCompletion?: boolean;
  canReviewCompletion?: boolean;
  assignedStaff?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    phone?: string | null;
  } | null;
  /** Chỉ chủ trọ/admin nhận được danh sách đơn đầy đủ. */
  applications?: MaintenanceTaskApplicant[];
}

export interface MaintenanceTaskApplication {
  id: string;
  taskId: string;
  staffId: string;
  message?: string | null;
  /** 🆕 Batch 3 — giá thợ đề nghị khi ứng tuyển (chấp nhận đơn = chốt giá này). */
  proposedAmount?: string | null;
  status: MaintenanceApplicationStatus;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Có ở danh sách "đơn của tôi" của thợ. */
  task?: MaintenanceTask;
}

export interface CreateMaintenanceTaskPayload {
  propertyId: string;
  roomId?: string | null;
  title: string;
  description: string;
  category: ServiceCategory;
  skills?: ServiceCategory[];
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  urgency?: MaintenancePriority;
  preferredStartAt?: string | null;
  preferredEndAt?: string | null;
  additionalInstructions?: string | null;
}

export interface MaintenanceTaskBrowseQuery {
  category?: ServiceCategory;
  skill?: ServiceCategory;
  urgency?: MaintenancePriority;
  search?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sort?: 'newest' | 'nearest' | 'urgency';
  page?: number;
  limit?: number;
}

// -----------------------------------------------------------------------------
// 🆕 THƯƠNG LƯỢNG GIÁ (Batch 3)
// -----------------------------------------------------------------------------

export type MaintenanceOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'WITHDRAWN';
export type MaintenanceOfferActor = 'LANDLORD' | 'STAFF';

export interface MaintenanceTaskOffer {
  id: string;
  taskId: string;
  /** Số thứ tự tăng dần trong một công việc (lịch sử bất biến). */
  version: number;
  proposedById: string;
  proposedByRole: MaintenanceOfferActor;
  /** Chuỗi thập phân do server trả về (Decimal) — luôn đi qua `formatMoney`. */
  amount: string;
  note?: string | null;
  status: MaintenanceOfferStatus;
  respondedById?: string | null;
  respondedAt?: string | null;
  responseNote?: string | null;
  createdAt: string;
  proposedBy?: { id: string; fullName: string; avatarUrl?: string | null };
}

export interface MaintenanceNegotiation {
  taskId: string;
  status: MaintenanceTaskStatus;
  agreedAmount?: string | null;
  agreedAt?: string | null;
  negotiationVersion: number;
  actorRole: MaintenanceOfferActor;
  canNegotiate: boolean;
  pendingOffer: {
    id: string;
    amount: string;
    proposedById: string;
    proposedByRole: MaintenanceOfferActor;
    createdAt: string;
    note?: string | null;
    /** `false` khi chính bạn là người đề xuất (không thể tự chấp nhận). */
    canRespond: boolean;
  } | null;
  offers: MaintenanceTaskOffer[];
}

/** 🆕 Batch 4 — trạng thái đánh giá của một công việc với người xem hiện tại. */
export interface TaskReviewState {
  taskId: string;
  status: MaintenanceTaskStatus;
  canReview: boolean;
  myReview: { id: string; rating: number; comment?: string | null; createdAt: string } | null;
  counterpartReview: { id: string; rating: number; comment?: string | null; createdAt: string } | null;
}

export interface CreateDisputePayload {
  targetType: ReportTargetType;
  targetId: string;
  category: DisputeCategory;
  taskId?: string;
  reason: string;
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

/**
 * H-05/Batch 2B1: payload của `POST /auth/password/set`.
 * `token` là "password-setup grant" ngắn hạn phát ra sau khi xác minh email —
 * KHÔNG phải access token/refresh token và không được lưu vào storage của trình duyệt.
 */
export interface PasswordSetPayload {
  token: string;
  password: string;
}

/**
 * Kết quả `POST /auth/verify-email`: grant đặt mật khẩu dùng MỘT lần, sống 10 phút,
 * gắn với `authVersion` hiện tại của tài khoản.
 */
export interface VerifyEmailResponse {
  passwordSetupGrant: string;
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
  electricityRate?: number;
  waterRate?: number;
  internetFee?: number;
  serviceFee?: number;
  parkingFee?: number;
}

/** 🆕 Sửa phòng — mọi trường tuỳ chọn; `null` = xoá cấu hình phí. */
export interface UpdateRoomPayload {
  roomNumber?: string;
  priceMonthly?: number;
  priceYearly?: number | null;
  depositAmount?: number;
  area?: number;
  maxOccupants?: number;
  electricityRate?: number | null;
  waterRate?: number | null;
  internetFee?: number | null;
  serviceFee?: number | null;
  parkingFee?: number | null;
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
  /** Hạn hiển thị tin (ISO). Server mặc định 30 ngày cho tin FIND_ROOMMATE. */
  expiredAt?: string;
  images?: File[];
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

export interface CreateContractTerminationPayload {
  reason: ContractTerminationReason;
  details: string;
  requestedEffectiveDate?: string;
}

export interface ReviewContractTerminationPayload {
  status: Extract<ContractTerminationStatus, 'APPROVED' | 'REJECTED'>;
  reviewNote: string;
  refundAmount?: number;
  effectiveDate?: string;
}

export interface CreateContractRenewalPayload {
  /** Bỏ trống/null = ký tiếp vô thời hạn. */
  proposedEndDate?: string | null;
  proposedMonthlyRent?: number;
  note?: string | null;
}

export interface RespondContractRenewalPayload {
  status: Extract<ContractRenewalStatus, 'APPROVED' | 'DECLINED'>;
  note?: string | null;
}

// --- Meter Reading Endpoints ---
export interface CreateMeterReadingPayload {
  roomId: string;
  month: number;
  year: number;
  /**
   * 🆕 Batch 7 — chỉ số ĐẦU kỳ là TUỲ CHỌN: bỏ trống thì server lấy chỉ số cuối
   * của kỳ gần nhất (không còn gửi cứng 0 làm sai lượng tiêu thụ).
   */
  electricityStart?: number;
  electricityEnd: number;
  waterStart?: number;
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
  hasRoom?: boolean;
  currentProvince?: string;
  currentDistrict?: string;
  currentWard?: string;
  currentAddress?: string;
  currentRent?: number;
  currentArea?: number;
  currentOccupants?: number;
  roommateSlots?: number;
  moveInDate?: string;
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
      name?: string | null;
      province: string;
      district: string;
      ward: string;
    } | null;
    /** Phòng đang thuê mà chủ tin gắn vào bài ở ghép (nếu có). */
    room?: {
      id: string;
      roomNumber: string;
      maxOccupants: number;
      area: number;
      status: RoomStatus;
    } | null;
    images?: Array<{ id: string; imageUrl: string; isPrimary?: boolean }>;
  };
  user: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
    role: Role;
    gender?: string | null;
    occupation?: string | null;
    bio?: string | null;
    age?: number;
  };
  preference?: {
    budgetMin?: number | null;
    budgetMax?: number | null;
    preferredGender?: string | null;
    preferredProvince?: string | null;
    preferredDistrict?: string | null;
    preferredWard?: string | null;
    hasRoom?: boolean | null;
    currentProvince?: string | null;
    currentDistrict?: string | null;
    currentWard?: string | null;
    roommateSlots?: number | null;
    moveInDate?: string | null;
    smokingAllowed?: boolean | null;
    petAllowed?: boolean | null;
    cleanlinessLevel?: number | null;
    sleepSchedule?: string | null;
    note?: string | null;
  } | null;
  location?: {
    province: string | null;
    district: string | null;
    ward: string | null;
  } | null;
  compatibilityPercent: number;
  isDealBreaker: boolean;
}

export type RoommatePostItem = SuggestedRoommate;

export interface RoommatePostFilters {
  keyword?: string;
  province?: string;
  district?: string;
  ward?: string;
  minPrice?: number;
  maxPrice?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  hasRoom?: boolean;
  sleepSchedule?: string;
  smokingAllowed?: boolean;
  petAllowed?: boolean;
  minCleanliness?: number;
  sortBy?: 'best_match' | 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
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
export interface ResolveReportPayload {
  status: ReportStatus;
  /** 🆕 Batch 4 — BẮT BUỘC khi RESOLVED/REJECTED (server kiểm tra, >= 10 ký tự). */
  resolution?: string;
}

// --- Admin Endpoints ---
export interface ModeratePostPayload {
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface CreateSupportTicketPayload {
  roomId?: string;
  category: string;
  subject: string;
  description: string;
  priority?: MaintenancePriority;
}

export interface CreateMaintenancePayload {
  roomId: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  /** 🆕 Danh mục sự cố — dùng để gợi ý danh mục khi chủ trọ chuyển thành việc cho thợ. */
  category?: ServiceCategory;
}

export interface CreateRentalRequestPayload {
  roomId: string;
  moveInDate: string;
  leaseTermMonths: number;
  occupantsCount?: number;
  note?: string;
}

export interface CreateRoommateInvitationPayload {
  recipientId: string;
  postId?: string;
  message?: string;
}

// --- Statistics Endpoints ---
export interface AdminStatsResponse {
  overview: {
    totalUsers: number;
    totalPosts: number;
    totalAppointments: number;
    pendingPosts: number;
    pendingReports: number;
    totalRooms?: number;
    occupiedRooms?: number;
    vacantRooms?: number;
    totalProperties?: number;
    verifiedLandlords?: number;
    publicPosts?: number;
    totalPostViews?: number;
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
