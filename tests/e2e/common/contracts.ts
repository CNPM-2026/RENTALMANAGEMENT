/**
 * Authoritative Domain Contracts, Enums, Tokens & Seed Fixtures
 * Derived from PROJECT.md, TEST_INFRA.md, and spec_miner_survey_2/handoff.md
 */

export const BRAND_NAME = '5K-Rental Manager';
export const FORBIDDEN_LEGACY_BRAND = 'Ở cùng';

export const DESIGN_TOKENS = {
  colors: {
    primaryPineGreen: '#15594f',
    accentGreen: '#203c37',
    brandTint: '#eaf2ed',
    sandNeutralSurface: '#f7f6f2',
    subtleBorders: '#e2e7e1',
    mutedText: '#74817b',
  },
  typography: {
    fallbackFontStack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  layout: {
    tenantSidebarWidth: '236px',
    landlordSidebarWidth: '224px',
    adminSidebarWidth: '224px',
    topbarHeight: '72px',
    tenantPublicNavHeight: '88px',
  },
};

export const SEED_ACCOUNTS = {
  admin: {
    email: 'admin.test@rental.local',
    password: 'TestPassword123!',
    role: 'ADMIN',
    fullName: 'System Administrator',
  },
  landlord: {
    email: 'landlord.test@rental.local',
    password: 'TestPassword123!',
    role: 'LANDLORD',
    phone: '0912345678',
    fullName: 'Chủ Trọ Hoàng Mai',
  },
  tenant: {
    email: 'tenant.test@rental.local',
    password: 'TestPassword123!',
    role: 'TENANT',
    phone: '0987654321',
    fullName: 'Nguyễn Văn Thuê',
  },
};

export enum Role {
  ADMIN = 'ADMIN',
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
  AGENT = 'AGENT',
}

export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  MAINTENANCE = 'MAINTENANCE',
}

export enum PostType {
  RENT_OUT = 'RENT_OUT',
  FIND_ROOM = 'FIND_ROOM',
  FIND_ROOMMATE = 'FIND_ROOMMATE',
}

export enum PostStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CLOSED = 'CLOSED',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

export enum ContractStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export enum InvoiceStatus {
  UNPAID = 'UNPAID',
  PAID = 'PAID',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export enum NotificationType {
  APPOINTMENT = 'APPOINTMENT',
  POST_APPROVED = 'POST_APPROVED',
  POST_REJECTED = 'POST_REJECTED',
  INVOICE = 'INVOICE',
  MESSAGE = 'MESSAGE',
  CONTRACT = 'CONTRACT',
  COMMISSION = 'COMMISSION',
  SYSTEM = 'SYSTEM',
}

export enum ReviewTargetType {
  POST = 'POST',
  USER = 'USER',
  ROOM = 'ROOM',
}

export interface FeatureDefinition {
  id: string;
  name: string;
  milestone: 'M1' | 'M2' | 'M3' | 'M4' | 'M5';
  category: 'Foundation' | 'Tenant' | 'Landlord' | 'Admin' | 'Acceptance';
  description: string;
}

export const ALL_FEATURES: FeatureDefinition[] = [
  { id: 'F01', name: 'Brand Renaming', milestone: 'M1', category: 'Foundation', description: 'Replace all branding with "5K-Rental Manager"' },
  { id: 'F02', name: 'Tailwind CSS v4 Theme Tokens', milestone: 'M1', category: 'Foundation', description: 'Theme tokens (#15594f, #203c37, #eaf2ed, #f7f6f2, #e2e7e1, #74817b)' },
  { id: 'F03', name: 'Geist Font Offline Fallback', milestone: 'M1', category: 'Foundation', description: 'System-ui and sans-serif fallback stack for offline builds' },
  { id: 'F04', name: 'Unified API Client Layer', milestone: 'M1', category: 'Foundation', description: 'Centralized API client with envelope unboxing and error normalization' },
  { id: 'F05', name: 'Authentication Session & State', milestone: 'M1', category: 'Foundation', description: 'JWT token storage, refresh rotation, and current user profile' },
  { id: 'F06', name: 'Shared Core UI Library', milestone: 'M1', category: 'Foundation', description: 'Button, Input, Badge, Card, Modal, Table, Tabs, Dropdown' },
  { id: 'F07', name: 'Shared Icon Infrastructure', milestone: 'M1', category: 'Foundation', description: 'Lucide-react iconography for sidebars and dashboards' },
  { id: 'F08', name: 'Shared TypeScript Domain Models', milestone: 'M1', category: 'Foundation', description: 'User, Property, Room, Contract, Invoice, Post, Appointment, Report' },
  { id: 'F09', name: 'Public Navigation & Footer', milestone: 'M1', category: 'Foundation', description: 'Tenant public top navigation (88px) and footer' },
  { id: 'F10', name: 'Tenant Portal Layout & Sidebar', milestone: 'M1', category: 'Foundation', description: 'Tenant 236px sidebar (9 functional + 5 account links)' },
  { id: 'F11', name: 'Landlord Dashboard Layout & Sidebar', milestone: 'M1', category: 'Foundation', description: 'Landlord 224px sidebar (4 business groups) + property switcher' },
  { id: 'F12', name: 'Admin Dashboard Layout & Sidebar', milestone: 'M1', category: 'Foundation', description: 'Admin 224px sidebar (4 governance groups) + env badge' },
  { id: 'F13', name: 'Tenant Home & Hero Discovery', milestone: 'M2', category: 'Tenant', description: 'Home hero search, featured rooms, neighborhood exploration' },
  { id: 'F14', name: 'Tenant Room Search & Filter', milestone: 'M2', category: 'Tenant', description: 'Multi-criteria filters (price, district, room type, amenities, pet)' },
  { id: 'F15', name: 'Tenant Room Map Discovery', milestone: 'M2', category: 'Tenant', description: 'Interactive map pins and room cards (/rooms/map)' },
  { id: 'F16', name: 'Tenant Room Detail & Gallery', milestone: 'M2', category: 'Tenant', description: 'Image gallery, specs, amenities list, verified landlord card' },
  { id: 'F17', name: 'Tenant Appointment Booking', milestone: 'M2', category: 'Tenant', description: 'Viewing appointment booking form and status tracker' },
  { id: 'F18', name: 'Tenant Rental Application', milestone: 'M2', category: 'Tenant', description: 'Rental application form and status tracker' },
  { id: 'F19', name: 'Tenant Contract View & PDF', milestone: 'M2', category: 'Tenant', description: 'Digital lease contract viewer, terms, deposit, download' },
  { id: 'F20', name: 'Tenant Saved Favorites', milestone: 'M2', category: 'Tenant', description: 'Saved rooms bookmark page with toggle/remove' },
  { id: 'F21', name: 'Tenant Roommate Matching & Survey', milestone: 'M2', category: 'Tenant', description: 'Lifestyle survey, compatibility score (0-100%) calculation' },
  { id: 'F22', name: 'Tenant Roommate Invitations', milestone: 'M2', category: 'Tenant', description: 'Sent and received roommate connection invitations' },
  { id: 'F23', name: 'Tenant Support Center', milestone: 'M2', category: 'Tenant', description: 'FAQ search, ticket list, ticket creation, response thread' },
  { id: 'F24', name: 'Tenant Safety Center & Violation Report', milestone: 'M2', category: 'Tenant', description: 'Safety guidelines, violation report form (frame 44:66785)' },
  { id: 'F25', name: 'Tenant Authentication Suite', milestone: 'M2', category: 'Tenant', description: 'Login, Register, Forgot Password, Verify OTP, Reset Password' },
  { id: 'F26', name: 'Tenant Profile & Settings', milestone: 'M2', category: 'Tenant', description: 'Profile editor, notification center, privacy/security settings' },
  { id: 'F27', name: 'Landlord Onboarding & KYC', milestone: 'M3', category: 'Landlord', description: 'Landlord registration and KYC legal document verification' },
  { id: 'F28', name: 'Landlord Dashboard Overview', milestone: 'M3', category: 'Landlord', description: 'KPI cards, cash flow chart, pending requests, today visits (50:4401)' },
  { id: 'F29', name: 'Landlord Properties & Facilities', milestone: 'M3', category: 'Landlord', description: 'Property management, facility cards, occupancy rate' },
  { id: 'F30', name: 'Landlord Rooms & Floor Plans', milestone: 'M3', category: 'Landlord', description: 'Building/floor/room matrix with status badges (50:3934)' },
  { id: 'F31', name: 'Landlord Vacant Rooms Tracking', milestone: 'M3', category: 'Landlord', description: 'Quick view and filter of vacant units ready for tenant placement' },
  { id: 'F32', name: 'Landlord Room Edit & Amenities', milestone: 'M3', category: 'Landlord', description: 'Room creation/update, pricing, deposit, area, amenities toggles' },
  { id: 'F33', name: 'Landlord Listing Management', milestone: 'M3', category: 'Landlord', description: 'Rental post queue, listing editor, multi-image uploader' },
  { id: 'F34', name: 'Landlord Rental Requests', milestone: 'M3', category: 'Landlord', description: 'Tenant rental application review table and approval flow' },
  { id: 'F35', name: 'Landlord Viewing Calendar', milestone: 'M3', category: 'Landlord', description: 'Viewing calendar (week/month) and rescheduling (50:2756)' },
  { id: 'F36', name: 'Landlord Tenant Directory', milestone: 'M3', category: 'Landlord', description: 'Tenant registry, lease dates, contact, payment health badges' },
  { id: 'F37', name: 'Landlord Contract Management', milestone: 'M3', category: 'Landlord', description: 'Contract table, lease terms, deposit history, state transitions' },
  { id: 'F38', name: 'Landlord Utility Meter Readings', milestone: 'M3', category: 'Landlord', description: 'Electricity & water meter reading entry table (50:1621)' },
  { id: 'F39', name: 'Landlord Monthly Invoices', milestone: 'M3', category: 'Landlord', description: 'Invoice batch generation, VietQR, mark-as-paid action' },
  { id: 'F40', name: 'Landlord Business Reports', milestone: 'M3', category: 'Landlord', description: 'Financial & operational analytics: revenue, expenses (50:244)' },
  { id: 'F41', name: 'Landlord Maintenance & Repairs', milestone: 'M3', category: 'Landlord', description: 'Maintenance ticket tracker, priorities, technicians (50:844)' },
  { id: 'F42', name: 'Landlord Staff & Roles', milestone: 'M3', category: 'Landlord', description: 'Staff management, role delegation, branch assignment' },
  { id: 'F43', name: 'Landlord Messages & Notifications', milestone: 'M3', category: 'Landlord', description: 'Split-pane direct messaging center, tenant chat (50:2)' },
  { id: 'F44', name: 'Landlord Account Settings', milestone: 'M3', category: 'Landlord', description: 'Profile, security, notification preference configurations' },
  { id: 'F45', name: 'Admin Platform Dashboard', milestone: 'M4', category: 'Admin', description: 'Global platform KPIs, active users, GMV, alerts (67:4298)' },
  { id: 'F46', name: 'Admin Comprehensive Analytics', milestone: 'M4', category: 'Admin', description: 'Detailed analytical reports: users, landlords, properties' },
  { id: 'F47', name: 'Admin User Management', milestone: 'M4', category: 'Admin', description: 'User directory, status toggles, disciplinary lock modal' },
  { id: 'F48', name: 'Admin Landlord Governance & KYC', milestone: 'M4', category: 'Admin', description: 'Landlord registry, KYC document review console' },
  { id: 'F49', name: 'Admin Listing Moderation Queue', milestone: 'M4', category: 'Admin', description: 'Rental listing approval queue, preview, decision (67:2525)' },
  { id: 'F50', name: 'Admin Safety Reports & Fraud', milestone: 'M4', category: 'Admin', description: 'Safety violation queue (67:1992), fraud investigation' },
  { id: 'F51', name: 'Admin Content Filtering', milestone: 'M4', category: 'Admin', description: 'Banned keywords dictionary and automated moderation filter' },
  { id: 'F52', name: 'Admin Support Ticket Management', milestone: 'M4', category: 'Admin', description: 'Global support ticket triage and SLA resolution console' },
  { id: 'F53', name: 'Admin Staff & RBAC Permissions', milestone: 'M4', category: 'Admin', description: 'Internal admin staff table and RBAC permission matrix' },
  { id: 'F54', name: 'Admin System Audit Logs', milestone: 'M4', category: 'Admin', description: 'Full platform audit log table with JSON inspector (67:268)' },
  { id: 'F55', name: 'Admin System Configuration', milestone: 'M4', category: 'Admin', description: 'Global settings: General, Fees, Security, Maintenance (67:2)' },
  { id: 'F56', name: 'Full E2E Test Suite Validation', milestone: 'M5', category: 'Acceptance', description: 'Execution and 100% pass rate validation of all E2E tests' },
  { id: 'F57', name: 'Adversarial Hardening', milestone: 'M5', category: 'Acceptance', description: 'White-box stress testing, edge-case coverage audit, defense' },
];
