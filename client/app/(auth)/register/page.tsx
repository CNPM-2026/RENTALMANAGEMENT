"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { Role } from "@/types/models";

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = React.useState<Role>("TENANT");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (fullName.trim().length < 2) {
      setErrorMessage("Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự).");
      return;
    }
    if (!email.includes("@")) {
      setErrorMessage("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    if (phone && !/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phone.trim())) {
      setErrorMessage("Số điện thoại không đúng định dạng Việt Nam.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!termsAccepted) {
      setErrorMessage("Bạn cần đồng ý với Điều khoản sử dụng để tiếp tục.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.auth.register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        password,
        role,
      });

      // Redirect to OTP verification screen
      router.push(`/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}&role=${role}`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Đăng ký không thành công. Email có thể đã tồn tại.");
      } else {
        setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-[#f7f6f2] text-[#203c37]">
      {/* 1. Left Brand Story Banner (650px, #15594f) */}
      <aside className="hidden lg:flex w-[650px] shrink-0 bg-[#15594f] text-white flex-col justify-between p-[56px] relative overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#15594f]/80 via-[#103f39]/90 to-[#0c2f2b] pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="size-[36px] bg-white rounded-[12px] flex items-center justify-center text-[#15594f] shadow-sm">
            <Home className="size-5" />
          </div>
          <span className="text-[26px] font-bold tracking-[-1px] text-white">
            5K-Rental Manager
          </span>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center px-3 py-1 rounded-[100px] bg-[#eaf2ed] text-[#15594f] text-[12px] font-semibold tracking-wide uppercase">
            GIA NHẬP CỘNG ĐỒNG
          </div>

          <h1 className="text-[44px] font-semibold leading-[1.18] tracking-[-1.5px] text-white">
            Khởi đầu mới.<br />Không gian riêng.
          </h1>

          <p className="text-[16px] text-[#e3ece6] leading-relaxed max-w-[480px]">
            Dù bạn tìm phòng trọ ưng ý hay quản lý các tòa nhà cho thuê, 5K-Rental Manager đồng hành bảo vệ quyền lợi và minh bạch tối đa.
          </p>

          <div className="pt-4 border-t border-white/15">
            <p className="text-[13px] text-[#d3dfd5]">
              Đăng ký tài khoản miễn phí chỉ trong 1 phút.
            </p>
          </div>
        </div>
      </aside>

      {/* 2. Right Form Container */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:px-[106px] lg:py-[48px] overflow-y-auto">
        <div className="flex justify-end text-[13px] text-[#74817b]">
          <span>Cần hỗ trợ? </span>
          <Link
            href="/tenant/support"
            className="ml-1 text-[#15594f] font-semibold hover:underline"
          >
            Trung tâm trợ giúp ↗
          </Link>
        </div>

        <div className="w-full max-w-[500px] mx-auto my-auto py-8">
          <div className="mb-6">
            <h2 className="text-[32px] font-semibold text-[#203c37] tracking-[-1px]">
              Tạo tài khoản mới.
            </h2>
            <p className="text-[15px] text-[#74817b] mt-1.5">
              Chọn vai trò của bạn để nhận giao diện phù hợp nhất.
            </p>
          </div>

          {/* Role Selector Tabs (TENANT vs LANDLORD) */}
          <div className="grid grid-cols-2 p-1 bg-[#eaf2ed] rounded-[8px] mb-6">
            <button
              type="button"
              onClick={() => setRole("TENANT")}
              className={`h-[38px] rounded-[6px] text-[13px] font-semibold transition-all cursor-pointer ${
                role === "TENANT"
                  ? "bg-white text-[#15594f] shadow-sm"
                  : "text-[#74817b] hover:text-[#203c37]"
              }`}
            >
              Tôi là Người thuê phòng
            </button>
            <button
              type="button"
              onClick={() => setRole("LANDLORD")}
              className={`h-[38px] rounded-[6px] text-[13px] font-semibold transition-all cursor-pointer ${
                role === "LANDLORD"
                  ? "bg-white text-[#15594f] shadow-sm"
                  : "text-[#74817b] hover:text-[#203c37]"
              }`}
            >
              Tôi là Chủ trọ / Quản lý
            </button>
          </div>

          {errorMessage && (
            <div className="mb-6 p-4 rounded-[8px] bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-center gap-2.5">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Field: Full Name */}
            <div>
              <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                Họ và tên <span className="text-[#991b1b]">*</span>
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn An"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              />
            </div>

            {/* Field: Email */}
            <div>
              <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                Địa chỉ email <span className="text-[#991b1b]">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="an.nguyen@example.com"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              />
            </div>

            {/* Field: Phone */}
            <div>
              <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                Số điện thoại liên hệ
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912 345 678"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              />
            </div>

            {/* Field: Password */}
            <div>
              <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                Mật khẩu <span className="text-[#991b1b]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full min-h-[46px] px-3.5 py-2.5 pr-11 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74817b] hover:text-[#203c37] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Field: Confirm Password */}
            <div>
              <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                Xác nhận mật khẩu <span className="text-[#991b1b]">*</span>
              </label>
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              />
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 size-[18px] rounded-[4px] border-[#e2e7e1] text-[#15594f] focus:ring-[#15594f] accent-[#15594f]"
              />
              <span className="text-[12px] text-[#74817b] leading-snug">
                Tôi đồng ý với{" "}
                <Link href="/terms" className="text-[#15594f] underline">
                  Điều khoản dịch vụ
                </Link>{" "}
                và{" "}
                <Link href="/privacy" className="text-[#15594f] underline">
                  Chính sách quyền riêng tư
                </Link>{" "}
                của 5K-Rental Manager.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[46px] mt-4 rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <span>Đang khởi tạo tài khoản...</span>
              ) : (
                <>
                  <ArrowRight className="size-4" />
                  <span>Đăng ký ngay</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[14px] text-[#203c37] mt-6">
            Đã có tài khoản?{" "}
            <Link
              href="/login"
              className="text-[#15594f] font-semibold hover:underline"
            >
              Đăng nhập ngay
            </Link>
          </p>
        </div>

        <p className="text-[11px] text-[#74817b] text-center max-w-[500px] mx-auto">
          5K-Rental Manager cam kết bảo mật thông tin liên hệ và số điện thoại cá nhân của bạn.
        </p>
      </main>
    </div>
  );
}
