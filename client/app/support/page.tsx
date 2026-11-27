"use client";

import * as React from "react";
import {
  HelpCircle,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Send,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  User,
  ChevronDown,
  Building,
  Lock,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { PublicNavbar } from "@/components/tenant/public-navbar";
import { getCurrentUser } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { User as UserModel, SupportTicket } from "@/types/models";

function PublicSupportContent() {
  const searchParams = useSearchParams();
  const isBannedParam = searchParams.get("banned") === "1";
  const emailParam = searchParams.get("email") || "";
  const reasonParam = searchParams.get("reason") || "";

  const [currentUser] = React.useState<UserModel | null>(() => {
    if (typeof window !== "undefined") {
      return getCurrentUser();
    }
    return null;
  });
  const [formData, setFormData] = React.useState(() => {
    const user = typeof window !== "undefined" ? getCurrentUser() : null;
    return {
      guestName: user?.fullName || "",
      guestEmail: emailParam || user?.email || "",
      guestPhone: "",
      category: isBannedParam ? "ACCOUNT_APPEAL" : "GENERAL",
      subject: isBannedParam ? "Kháng cáo tài khoản bị khóa" : "",
      description: isBannedParam && reasonParam ? `Lý do hệ thống thông báo: ${reasonParam}\n\nNội dung giải trình / kháng cáo: ` : "",
    };
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [submittedTicket, setSubmittedTicket] = React.useState<SupportTicket | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [openFaq, setOpenFaq] = React.useState<number | null>(isBannedParam ? 3 : 0);

  React.useEffect(() => {
    if (isBannedParam) {
      setOpenFaq(3);
      if (emailParam) {
        setFormData((prev) => ({
          ...prev,
          guestEmail: prev.guestEmail || emailParam,
          category: "ACCOUNT_APPEAL",
          subject: prev.subject || "Kháng cáo tài khoản bị khóa",
        }));
      }
    }
  }, [isBannedParam, emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.guestName.trim() || !formData.guestEmail.trim() || !formData.subject.trim() || !formData.description.trim()) {
      setErrorMessage("Vui lòng điền đầy đủ các trường bắt buộc.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.support.createPublic({
        guestName: formData.guestName.trim(),
        guestEmail: formData.guestEmail.trim(),
        guestPhone: formData.guestPhone.trim() || undefined,
        category: formData.category,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
        priority: formData.category === "ACCOUNT_APPEAL" ? "URGENT" : "MEDIUM",
      });
      setSubmittedTicket(res);
      setFormData({
        guestName: currentUser?.fullName || "",
        guestEmail: currentUser?.email || "",
        guestPhone: "",
        category: "GENERAL",
        subject: "",
        description: "",
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(errorObj?.response?.data?.message || errorObj?.message || "Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      title: "1. Hướng dẫn an toàn khi thuê phòng & đặt cọc",
      icon: ShieldCheck,
      content:
        "Luôn đến xem phòng trực tiếp trước khi quyết định đặt cọc. Mọi khoản đặt cọc trên 5K-Rental đều được tích hợp vào hợp đồng điện tử có tính pháp lý. Tuyệt đối không chuyển tiền cọc ngoài hệ thống cho người lạ hoặc các tài khoản không trùng khớp với danh tính chủ trọ đã xác thực.",
    },
    {
      title: "2. Quy trình hẹn xem phòng trực tiếp",
      icon: Clock,
      content:
        "Bạn có thể bấm 'Đặt lịch xem phòng' tại trang chi tiết phòng để chọn khung giờ phù hợp. Chủ trọ sẽ nhận được thông báo và xác nhận lịch hẹn. Bạn nên đến sớm 5-10 phút để quan sát tình hình an ninh, hạ tầng và sóng điện thoại tại khu vực.",
    },
    {
      title: "3. Xác thực danh tính (KYC) & Ký số hợp đồng",
      icon: FileText,
      content:
        "Để đảm bảo môi trường trọ an toàn và minh bạch, tất cả người thuê cần hoàn tất xác minh CMND/CCCD (KYC) trước khi gửi yêu cầu thuê phòng. Khi chủ trọ tạo hợp đồng, bạn có thể thực hiện ký số điện tử ngay trên ứng dụng.",
    },
    {
      title: "4. Kháng cáo tài khoản bị khóa (Ban)",
      icon: Lock,
      content:
        "Nếu tài khoản của bạn bị tạm khóa hoặc đình chỉ hoạt động, bạn có thể sử dụng biểu mẫu liên hệ bên dưới (chọn phân loại 'Kháng cáo tài khoản bị khóa'), cung cấp email đăng ký và giải trình lý do kèm các tài liệu xác thực để ban quản trị đối soát và xem xét mở lại tài khoản.",
    },
    {
      title: "5. Tìm bạn ở ghép văn minh & xóa tin tự động",
      icon: Building,
      content:
        "Khi tìm người ở ghép, bạn có thể tạo tin tìm bạn cùng phòng với các tiêu chí sinh hoạt rõ ràng. Khi bạn đã ghép chung hoặc hợp đồng trọ đã đủ người, hệ thống sẽ tự động cập nhật trạng thái tin đăng nhằm tránh làm phiền.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex flex-col font-sans">
      <PublicNavbar currentUser={currentUser} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf2ed] text-[#15594f] text-[12px] font-bold border border-[#d2e4d7]">
            <HelpCircle className="size-4" />
            <span>TRUNG TÂM TRỢ GIÚP 24/7</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#203c37] tracking-tight">
            Hỗ trợ & Hướng dẫn người dùng
          </h1>
          <p className="text-[15px] text-[#74817b] leading-relaxed">
            Giải đáp mọi thắc mắc về tìm phòng, ký hợp đồng số, giải quyết khiếu nại và tiếp nhận kháng cáo tài khoản.
          </p>
        </div>

        {/* Main Grid: FAQs & Contact Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: FAQs & Guidelines (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-[18px] font-bold text-[#203c37] flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#15594f]" />
              Hướng dẫn & Câu hỏi thường gặp
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                const Icon = faq.icon;
                return (
                  <div
                    key={index}
                    className="bg-white rounded-[12px] border border-[#e2e7e1] shadow-xs overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full p-4 flex items-center justify-between text-left hover:bg-[#faf9f5] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <span className="text-[14px] font-bold text-[#203c37]">{faq.title}</span>
                      </div>
                      <ChevronDown
                        className={`size-4 text-[#74817b] transition-transform duration-200 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 text-[13px] text-[#55635d] leading-relaxed border-t border-[#f2ede3]">
                        {faq.content}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick Contact Info */}
            <div className="bg-[#eaf2ed] border border-[#d2e4d7] rounded-[12px] p-5 space-y-2 mt-6">
              <h3 className="text-[14px] font-bold text-[#15594f]">Đường dây nóng hỗ trợ khẩn cấp</h3>
              <p className="text-[13px] text-[#203c37]">
                Hotline hỗ trợ kỹ thuật và an ninh: <strong className="text-[#15594f]">1900 6868</strong> (8:00 - 21:00 hàng ngày)
              </p>
              <p className="text-[13px] text-[#203c37]">
                Email ban quản trị: <strong className="text-[#15594f]">support@5krental.vn</strong>
              </p>
            </div>
          </div>

          {/* Right Column: Contact Form (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-[16px] border border-[#e2e7e1] shadow-md space-y-5">
            <div>
              <h2 className="text-[18px] font-bold text-[#203c37] flex items-center gap-2">
                <Send className="size-5 text-[#15594f]" />
                Gửi yêu cầu hỗ trợ / Kháng cáo
              </h2>
              <p className="text-[12px] text-[#74817b] mt-1">
                Dành cho cả khách vãng lai, người dùng hệ thống và tài khoản đang chờ kháng cáo.
              </p>
            </div>

            {isBannedParam && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-[10px] space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-red-800 font-bold text-[14px]">
                  <Lock className="size-4.5 text-red-600 shrink-0" />
                  <span>Tài khoản của bạn hiện đang bị tạm khóa</span>
                </div>
                <p className="text-[12px] text-red-700 leading-relaxed">
                  {reasonParam ? `${reasonParam}. ` : ""}
                  Bạn có thể gửi giải trình hoặc yêu cầu kháng cáo qua biểu mẫu bên dưới. Ban quản trị sẽ tiếp nhận và phản hồi qua email của bạn.
                </p>
              </div>
            )}

            {submittedTicket && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[10px] space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-[14px]">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  <span>Đã gửi yêu cầu thành công!</span>
                </div>
                <p className="text-[12px] text-emerald-700 leading-relaxed">
                  Mã yêu cầu của bạn: <strong>{submittedTicket.id}</strong>. Ban quản trị sẽ phản hồi qua email{" "}
                  <strong>{submittedTicket.guestEmail || submittedTicket.user?.email}</strong> trong thời gian sớm nhất.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSubmittedTicket(null)}
                  className="mt-2 text-[12px]"
                >
                  Gửi yêu cầu khác
                </Button>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[8px] text-[12px] flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {!submittedTicket && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="size-4 text-[#74817b] absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={formData.guestName}
                      onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                      placeholder="Nguyễn Văn A"
                      className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                      Email liên hệ <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="size-4 text-[#74817b] absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={formData.guestEmail}
                        onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                        placeholder="email@example.com"
                        className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                      Số điện thoại
                    </label>
                    <div className="relative">
                      <Phone className="size-4 text-[#74817b] absolute left-3 top-3" />
                      <input
                        type="tel"
                        value={formData.guestPhone}
                        onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                        placeholder="0912345678"
                        className="w-full pl-9 pr-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f]"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                    Phân loại yêu cầu <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f] bg-white"
                  >
                    <option value="GENERAL">Tư vấn chung & Tìm phòng</option>
                    <option value="ACCOUNT_APPEAL">Kháng cáo tài khoản bị khóa / Ban</option>
                    <option value="RENTAL_DISPUTE">Khiếu nại hợp đồng & Đặt cọc</option>
                    <option value="SECURITY_VIOLATION">Báo cáo lừa đảo hoặc vi phạm an ninh</option>
                    <option value="TECHNICAL">Sự cố kỹ thuật / Lỗi hệ thống</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                    Tiêu đề <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Tóm tắt yêu cầu cần hỗ trợ"
                    className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                    Nội dung chi tiết <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Mô tả chi tiết sự việc, bao gồm thông tin tài khoản, phòng trọ liên quan (nếu có)..."
                    className="w-full p-3 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f] resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#15594f] hover:bg-[#103f39] text-white font-bold h-[44px] text-[14px]"
                >
                  {submitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hỗ trợ"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PublicSupportPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#f7f6f2] flex items-center justify-center text-sm text-[#74817b]">Đang tải...</div>}>
      <PublicSupportContent />
    </React.Suspense>
  );
}
