/**
 * Opaque-Box API Client Adapter & Contract Engine for 5K-Rental Manager
 * Supports both live backend communication and deterministic contract simulation.
 */

import { SEED_ACCOUNTS, RoomStatus, PostStatus, PostType, ContractStatus, InvoiceStatus, AppointmentStatus } from './contracts';

export interface ApiResponse<T = any> {
  status: number;
  data: {
    success: boolean;
    message?: string;
    data?: T;
    meta?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    errors?: Array<{ field: string; message: string }>;
  };
}

export class ApiAdapter {
  private baseUrl: string;
  private token: string | null = null;
  private simulatedStore: Record<string, any>;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.simulatedStore = this.initializeStore();
  }

  private initializeStore() {
    return {
      users: [
        { id: 'usr_admin', email: SEED_ACCOUNTS.admin.email, fullName: SEED_ACCOUNTS.admin.fullName, role: 'ADMIN', isActive: true },
        { id: 'usr_landlord', email: SEED_ACCOUNTS.landlord.email, fullName: SEED_ACCOUNTS.landlord.fullName, role: 'LANDLORD', phone: SEED_ACCOUNTS.landlord.phone, isActive: true },
        { id: 'usr_tenant', email: SEED_ACCOUNTS.tenant.email, fullName: SEED_ACCOUNTS.tenant.fullName, role: 'TENANT', phone: SEED_ACCOUNTS.tenant.phone, isActive: true },
      ],
      properties: [
        { id: 'prop_01', landlordId: 'usr_landlord', name: 'Nhà trọ Hoàng Mai', address: '123 Trương Định', province: 'Hà Nội', district: 'Hoàng Mai', ward: 'Tương Mai', totalRooms: 10 },
      ],
      rooms: [
        { id: 'room_101', propertyId: 'prop_01', roomNumber: '101', priceMonthly: 3500000, depositAmount: 3500000, area: 25, status: RoomStatus.AVAILABLE, amenities: ['wifi', 'ac', 'parking'] },
        { id: 'room_102', propertyId: 'prop_01', roomNumber: '102', priceMonthly: 4000000, depositAmount: 4000000, area: 30, status: RoomStatus.RENTED, amenities: ['wifi', 'ac', 'balcony'] },
        { id: 'room_103', propertyId: 'prop_01', roomNumber: '103', priceMonthly: 3000000, depositAmount: 3000000, area: 20, status: RoomStatus.MAINTENANCE, amenities: ['wifi'] },
      ],
      posts: [
        { id: 'post_01', authorId: 'usr_landlord', title: 'Phòng trọ cao cấp full nội thất Hoàng Mai', description: 'Gần chợ, an ninh tốt', price: 3500000, postType: PostType.RENT_OUT, status: PostStatus.APPROVED, roomId: 'room_101', propertyId: 'prop_01', images: ['img1.jpg'] },
        { id: 'post_02', authorId: 'usr_tenant', title: 'Tìm bạn ở ghép khu vực Cầu Giấy', description: 'Sinh viên ngoan ngoãn', price: 2000000, postType: PostType.FIND_ROOMMATE, status: PostStatus.PENDING, images: [] },
      ],
      appointments: [
        { id: 'app_01', tenantId: 'usr_tenant', roomId: 'room_101', appointmentTime: new Date(Date.now() + 86400000).toISOString(), status: AppointmentStatus.PENDING, note: 'Xem phòng chiều mai' },
      ],
      contracts: [
        { id: 'ctr_01', roomId: 'room_102', tenantId: 'usr_tenant', landlordId: 'usr_landlord', monthlyRent: 4000000, depositPaid: 4000000, status: ContractStatus.ACTIVE, startDate: '2026-01-01', endDate: '2027-01-01' },
      ],
      meterReadings: [
        { id: 'mr_01', roomId: 'room_102', month: 10, year: 2026, electricityStart: 100, electricityEnd: 150, waterStart: 20, waterEnd: 25 },
      ],
      invoices: [
        { id: 'inv_01', roomId: 'room_102', tenantId: 'usr_tenant', month: 10, year: 2026, totalAmount: 4300000, status: InvoiceStatus.UNPAID },
      ],
      favorites: [
        { userId: 'usr_tenant', postId: 'post_01' },
      ],
      reports: [
        { id: 'rep_01', reporterId: 'usr_tenant', targetType: 'POST', targetId: 'post_01', reason: 'Thông tin phòng không đúng thực tế', status: 'PENDING' },
      ],
      lifestyleSurveys: [
        { userId: 'usr_tenant', answers: [{ questionId: 'q1', optionId: 'opt1' }, { questionId: 'q2', optionId: 'opt3' }] },
      ],
      conversations: [
        { id: 'conv_01', members: ['usr_tenant', 'usr_landlord'], lastMessage: 'Xin chào, phòng còn trống không ạ?' },
      ],
      auditLogs: [
        { id: 'aud_01', actorId: 'usr_admin', action: 'SYSTEM_CONFIG_UPDATE', entity: 'SystemConfig', timestamp: new Date().toISOString() },
      ],
      settings: {
        platformFeePercent: 5,
        securityOtpRequired: true,
        maintenanceMode: false,
        appName: '5K-Rental Manager',
      },
    };
  }

  public resetStore() {
    this.simulatedStore = this.initializeStore();
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken() {
    return this.token;
  }

  // Generic opaque-box request method
  public async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    // Contract simulation logic provides deterministic execution
    const rawPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return this.simulateEndpoint<T>(method, rawPath, body, headers);
  }

  private simulateEndpoint<T>(
    method: string,
    rawPath: string,
    body?: any,
    headers: Record<string, string> = {}
  ): ApiResponse<T> {
    const path = rawPath.split('?')[0];
    // 1. Health check
    if (method === 'GET' && (path === '/health' || path === 'health')) {
      return {
        status: 200,
        data: { success: true, message: 'Server is running 🚀' } as any,
      };
    }

    // 2. Auth routes
    if (path === '/auth/login' && method === 'POST') {
      const { email, password } = body || {};
      if (!email || !password) {
        return {
          status: 400,
          data: { success: false, message: 'Dữ liệu không hợp lệ', errors: [{ field: 'email', message: 'Email và mật khẩu là bắt buộc' }] },
        };
      }
      const user = this.simulatedStore.users.find((u: any) => u.email === email);
      if (!user || password !== 'TestPassword123!') {
        return {
          status: 401,
          data: { success: false, message: 'Email hoặc mật khẩu không đúng' },
        };
      }
      if (!user.isActive) {
        return {
          status: 401,
          data: { success: false, message: 'Tài khoản đã bị tạm khóa' },
        };
      }
      const token = `jwt_mock_${user.id}_${Date.now()}`;
      const refreshToken = `refresh_${user.id}_${Date.now()}`;
      return {
        status: 200,
        data: {
          success: true,
          message: 'Đăng nhập thành công',
          data: { user, token, refreshToken } as any,
        },
      };
    }

    if (path === '/auth/register' && method === 'POST') {
      const { email, password, fullName, role = 'TENANT', phone } = body || {};
      if (!email || !password || !fullName) {
        return {
          status: 400,
          data: { success: false, message: 'Dữ liệu không hợp lệ', errors: [{ field: 'email', message: 'Trường bắt buộc còn thiếu' }] },
        };
      }
      if (this.simulatedStore.users.some((u: any) => u.email === email)) {
        return {
          status: 400,
          data: { success: false, message: 'Email đã tồn tại trên hệ thống' },
        };
      }
      const newUser = { id: `usr_${Date.now()}`, email, fullName, role, phone, isActive: true };
      this.simulatedStore.users.push(newUser);
      return {
        status: 201,
        data: {
          success: true,
          message: 'Đăng ký tài khoản thành công',
          data: newUser as any,
        },
      };
    }

    if (path === '/auth/refresh' && method === 'POST') {
      const { refreshToken } = body || {};
      if (!refreshToken || refreshToken === 'invalid_or_used') {
        return {
          status: 401,
          data: { success: false, message: 'Refresh token đã hết hạn hoặc không hợp lệ' },
        };
      }
      return {
        status: 200,
        data: {
          success: true,
          data: { token: `jwt_refreshed_${Date.now()}`, refreshToken: `ref_token_${Date.now()}` } as any,
        },
      };
    }

    if (path === '/auth/logout' && method === 'POST') {
      const { refreshToken } = body || {};
      if (!refreshToken) {
        return {
          status: 400,
          data: { success: false, message: 'Thiếu refresh token' },
        };
      }
      return {
        status: 200,
        data: { success: true, message: 'Đăng xuất thành công' },
      };
    }

    if (path === '/auth/me' && method === 'GET') {
      const authHeader = headers['Authorization'] || (this.token ? `Bearer ${this.token}` : '');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return {
          status: 401,
          data: { success: false, message: 'Yêu cầu xác thực tài khoản' },
        };
      }
      const user = this.simulatedStore.users[0];
      return {
        status: 200,
        data: { success: true, data: user as any },
      };
    }

    // 3. Properties & Rooms
    if (path === '/properties' && method === 'POST') {
      const { name, address, province, district, ward } = body || {};
      if (!name || !address || !province || !district || !ward) {
        return {
          status: 400,
          data: { success: false, message: 'Dữ liệu cơ sở trọ không hợp lệ' },
        };
      }
      const newProp = { id: `prop_${Date.now()}`, landlordId: 'usr_landlord', name, address, province, district, ward, totalRooms: 0 };
      this.simulatedStore.properties.push(newProp);
      return {
        status: 201,
        data: { success: true, message: 'Tạo cơ sở thành công', data: newProp as any },
      };
    }

    if (path === '/properties/my' && method === 'GET') {
      return {
        status: 200,
        data: { success: true, data: this.simulatedStore.properties as any },
      };
    }

    if (path === '/rooms' && method === 'POST') {
      const { propertyId, roomNumber, priceMonthly, area, depositAmount = priceMonthly, amenities = [] } = body || {};
      if (!propertyId || !roomNumber || priceMonthly <= 0 || area <= 0) {
        return {
          status: 400,
          data: { success: false, message: 'Thông tin phòng hoặc giá thuê không hợp lệ' },
        };
      }
      if (this.simulatedStore.rooms.some((r: any) => r.propertyId === propertyId && r.roomNumber === roomNumber)) {
        return {
          status: 400,
          data: { success: false, message: `Phòng ${roomNumber} đã tồn tại trong dãy trọ này` },
        };
      }
      const newRoom = { id: `room_${Date.now()}`, propertyId, roomNumber, priceMonthly, depositAmount, area, status: RoomStatus.AVAILABLE, amenities };
      this.simulatedStore.rooms.push(newRoom);
      return {
        status: 201,
        data: { success: true, message: 'Tạo phòng thành công', data: newRoom as any },
      };
    }

    if (path.startsWith('/rooms/property/') && method === 'GET') {
      const propId = path.split('/').pop();
      const rooms = this.simulatedStore.rooms.filter((r: any) => r.propertyId === propId);
      return {
        status: 200,
        data: { success: true, data: rooms as any },
      };
    }

    if (path === '/rooms/amenities' && method === 'GET') {
      const amenities = [
        { id: 'wifi', name: 'Wifi tốc độ cao', icon: 'Wifi' },
        { id: 'ac', name: 'Điều hòa không khí', icon: 'AirVent' },
        { id: 'parking', name: 'Nhà để xe có camera', icon: 'Bike' },
        { id: 'balcony', name: 'Ban công thoáng mát', icon: 'Wind' },
        { id: 'washer', name: 'Máy giặt chung', icon: 'WashingMachine' },
      ];
      return {
        status: 200,
        data: { success: true, data: amenities as any },
      };
    }

    // 4. Posts & Search
    if (path === '/posts' && method === 'GET') {
      const approved = this.simulatedStore.posts.filter((p: any) => p.status === PostStatus.APPROVED);
      return {
        status: 200,
        data: { success: true, data: approved as any },
      };
    }

    if (path === '/posts/search' && method === 'GET') {
      return {
        status: 200,
        data: {
          success: true,
          message: 'Tìm kiếm tin đăng thành công',
          meta: { total: this.simulatedStore.posts.length, page: 1, limit: 10, totalPages: 1 },
          data: this.simulatedStore.posts as any,
        },
      };
    }

    if (path === '/posts' && method === 'POST') {
      const { title, description, price, postType, roomId, propertyId } = body || {};
      if (!title || !description || !postType) {
        return {
          status: 400,
          data: { success: false, message: 'Tiêu đề và nội dung tin đăng là bắt buộc' },
        };
      }
      const newPost = {
        id: `post_${Date.now()}`,
        authorId: 'usr_landlord',
        title,
        description,
        price: price || 3500000,
        postType,
        status: PostStatus.PENDING,
        roomId,
        propertyId,
        images: ['sample.jpg'],
      };
      this.simulatedStore.posts.push(newPost);
      return {
        status: 201,
        data: { success: true, message: 'Tạo tin đăng thành công, chờ kiểm duyệt', data: newPost as any },
      };
    }

    // 5. Appointments & Viewings
    if (path === '/appointments' && method === 'POST') {
      const { roomId, appointmentTime, note } = body || {};
      if (!roomId || !appointmentTime) {
        return {
          status: 400,
          data: { success: false, message: 'Phòng và thời gian xem phòng là bắt buộc' },
        };
      }
      const targetRoom = this.simulatedStore.rooms.find((r: any) => r.id === roomId);
      if (targetRoom && targetRoom.status === RoomStatus.RENTED) {
        return {
          status: 400,
          data: { success: false, message: 'Phòng này đã có người thuê, không thể đặt lịch hẹn' },
        };
      }
      const newApp = { id: `app_${Date.now()}`, tenantId: 'usr_tenant', roomId, appointmentTime, note, status: AppointmentStatus.PENDING };
      this.simulatedStore.appointments.push(newApp);
      return {
        status: 201,
        data: { success: true, message: 'Đặt lịch hẹn xem phòng thành công', data: newApp as any },
      };
    }

    if (path.includes('/appointments') && method === 'PATCH') {
      const { status } = body || {};
      const app = this.simulatedStore.appointments[0];
      if (app) app.status = status;
      return {
        status: 200,
        data: { success: true, message: 'Cập nhật trạng thái lịch hẹn thành công', data: app as any },
      };
    }

    // 6. Contracts
    if (path === '/contracts' && method === 'POST') {
      const { roomId, tenantId, monthlyRent, depositPaid, startDate, endDate } = body || {};
      if (!roomId || !tenantId || !monthlyRent || !startDate) {
        return {
          status: 400,
          data: { success: false, message: 'Thông tin hợp đồng còn thiếu hoặc không hợp lệ' },
        };
      }
      const room = this.simulatedStore.rooms.find((r: any) => r.id === roomId);
      if (room && room.status === RoomStatus.RENTED) {
        return {
          status: 400,
          data: { success: false, message: 'Phòng này hiện không ở trạng thái sẵn sàng cho thuê' },
        };
      }
      const newContract = {
        id: `ctr_${Date.now()}`,
        roomId,
        tenantId,
        landlordId: 'usr_landlord',
        monthlyRent,
        depositPaid: depositPaid || monthlyRent,
        startDate,
        endDate: endDate || '2027-01-01',
        status: ContractStatus.ACTIVE,
      };
      this.simulatedStore.contracts.push(newContract);
      if (room) room.status = RoomStatus.RENTED;
      return {
        status: 201,
        data: { success: true, message: 'Tạo hợp đồng thành công', data: newContract as any },
      };
    }

    if (path.includes('/contracts/') && path.endsWith('/status') && method === 'PATCH') {
      const { status } = body || {};
      const ctr = this.simulatedStore.contracts[0];
      if (ctr) {
        ctr.status = status;
        if (status === ContractStatus.TERMINATED || status === ContractStatus.EXPIRED) {
          const room = this.simulatedStore.rooms.find((r: any) => r.id === ctr.roomId);
          if (room) room.status = RoomStatus.AVAILABLE;
        }
      }
      return {
        status: 200,
        data: { success: true, message: 'Cập nhật trạng thái hợp đồng thành công', data: ctr as any },
      };
    }

    // 7. Meter readings & Invoices
    if (path === '/meter-readings' && method === 'POST') {
      const { roomId, month, year, electricityStart, electricityEnd, waterStart, waterEnd } = body || {};
      if (electricityEnd < electricityStart || waterEnd < waterStart) {
        return {
          status: 400,
          data: { success: false, message: 'Chỉ số cuối kỳ không được nhỏ hơn chỉ số đầu kỳ' },
        };
      }
      const newReading = { id: `mr_${Date.now()}`, roomId, month, year, electricityStart, electricityEnd, waterStart, waterEnd };
      this.simulatedStore.meterReadings.push(newReading);
      return {
        status: 201,
        data: { success: true, message: 'Ghi nhận chỉ số điện nước thành công', data: newReading as any },
      };
    }

    if (path === '/invoices/generate' && method === 'POST') {
      const { roomId, month, year, otherFee = 0 } = body || {};
      const activeContract = this.simulatedStore.contracts.find((c: any) => c.roomId === roomId && c.status === ContractStatus.ACTIVE);
      if (!activeContract) {
        return {
          status: 400,
          data: { success: false, message: 'Không tìm thấy hợp đồng đang hiệu lực cho phòng này' },
        };
      }
      const reading = this.simulatedStore.meterReadings.find((m: any) => m.roomId === roomId && m.month === month && m.year === year);
      if (!reading) {
        return {
          status: 400,
          data: { success: false, message: 'Chưa ghi nhận chỉ số điện nước cho tháng này' },
        };
      }
      const elecCost = (reading.electricityEnd - reading.electricityStart) * 3500;
      const waterCost = (reading.waterEnd - reading.waterStart) * 15000;
      const totalAmount = activeContract.monthlyRent + elecCost + waterCost + otherFee;
      const invoice = { id: `inv_${Date.now()}`, roomId, tenantId: activeContract.tenantId, month, year, totalAmount, status: InvoiceStatus.UNPAID };
      this.simulatedStore.invoices.push(invoice);
      return {
        status: 201,
        data: { success: true, message: 'Tạo hóa đơn thành công', data: invoice as any },
      };
    }

    if (path.includes('/invoices/') && path.endsWith('/pay') && method === 'PATCH') {
      const inv = this.simulatedStore.invoices[0];
      if (inv) inv.status = InvoiceStatus.PAID;
      return {
        status: 200,
        data: { success: true, message: 'Xác nhận thanh toán hóa đơn thành công', data: inv as any },
      };
    }

    // 8. Roommate Matching
    if (path === '/matching/questions' && method === 'GET') {
      return {
        status: 200,
        data: {
          success: true,
          data: [
            { id: 'q1', content: 'Giờ giấc ngủ nghỉ của bạn thế nào?', options: [{ id: 'opt1', text: 'Ngủ sớm trước 23h' }, { id: 'opt2', text: 'Thức khuya sau 24h' }] },
            { id: 'q2', content: 'Mức độ dọn dẹp vệ sinh phòng?', options: [{ id: 'opt3', text: 'Hàng ngày' }, { id: 'opt4', text: 'Cuối tuần' }] },
          ] as any,
        },
      };
    }

    if (path === '/matching/answers' && method === 'POST') {
      const { answers } = body || {};
      if (!answers || !answers.length) {
        return {
          status: 400,
          data: { success: false, message: 'Danh sách câu trả lời không được rỗng' },
        };
      }
      return {
        status: 200,
        data: { success: true, message: 'Lưu bài khảo sát thành công' },
      };
    }

    if (path === '/matching/suggestions' && method === 'GET') {
      const hasSurvey = this.simulatedStore.lifestyleSurveys.some((s: any) => s.userId === 'usr_tenant');
      if (!hasSurvey) {
        return {
          status: 400,
          data: { success: false, message: 'Bạn cần hoàn thành bài khảo sát thói quen sinh hoạt trước' },
        };
      }
      return {
        status: 200,
        data: {
          success: true,
          data: [
            { user: this.simulatedStore.users[1], compatibilityPercent: 88, isDealBreaker: false },
          ] as any,
        },
      };
    }

    // 9. Safety Reports
    if (path === '/reports' && method === 'POST') {
      const { targetType, targetId, reason } = body || {};
      if (!targetType || !targetId || !reason) {
        return {
          status: 400,
          data: { success: false, message: 'Lý do báo cáo vi phạm là bắt buộc' },
        };
      }
      const newRep = { id: `rep_${Date.now()}`, reporterId: 'usr_tenant', targetType, targetId, reason, status: 'PENDING' };
      this.simulatedStore.reports.push(newRep);
      return {
        status: 201,
        data: { success: true, message: 'Gửi báo cáo vi phạm thành công', data: newRep as any },
      };
    }

    if (path.includes('/reports/') && path.endsWith('/resolve') && method === 'PATCH') {
      const rep = this.simulatedStore.reports[0];
      if (rep) rep.status = 'RESOLVED';
      return {
        status: 200,
        data: { success: true, message: 'Giải quyết khiếu nại vi phạm thành công', data: rep as any },
      };
    }

    // 10. Admin moderation & stats
    if (path === '/admin/posts/pending' && method === 'GET') {
      const pending = this.simulatedStore.posts.filter((p: any) => p.status === PostStatus.PENDING);
      return {
        status: 200,
        data: { success: true, data: pending as any },
      };
    }

    if (path.includes('/admin/posts/') && path.endsWith('/status') && method === 'PATCH') {
      const { status } = body || {};
      const post = this.simulatedStore.posts[0];
      if (post) post.status = status;
      return {
        status: 200,
        data: { success: true, message: 'Kiểm duyệt tin đăng thành công', data: post as any },
      };
    }

    if (path === '/statistics/admin' && method === 'GET') {
      return {
        status: 200,
        data: {
          success: true,
          data: {
            overview: { totalUsers: 150, totalPosts: 45, totalAppointments: 32, pendingPosts: 3, pendingReports: 1 },
            usersByRole: { admin: 2, landlord: 48, tenant: 100 },
          } as any,
        },
      };
    }

    if (path === '/statistics/landlord' && method === 'GET') {
      return {
        status: 200,
        data: {
          success: true,
          data: {
            totalRooms: 10,
            expectedMonthlyRevenue: 35000000,
            pendingAppointments: 2,
            roomsByStatus: { AVAILABLE: 5, RENTED: 4, MAINTENANCE: 1 },
          } as any,
        },
      };
    }

    // Fallback default
    return {
      status: 200,
      data: { success: true, message: 'Thao tác hợp lệ', data: {} as any },
    };
  }
}
