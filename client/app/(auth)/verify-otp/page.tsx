"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, ShieldCheck, CheckCircle2, Info } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "nguoidung@example.com";

  const [otp, setOtp] = React.useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = React.useState(60);
  const canResend = countdown === 0;
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // 60-second Countdown Timer
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  function handleDigitChange(index: number, value: string) {
    const char = value.slice(-1); // Take latest input
    if (char && !/^\d$/.test(char)) return; // Allow numbers only

    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);

    // Focus last filled digit
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
  }

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fullOtp = otp.join("");
    if (fullOtp.length < 6) {
      setError("Vui lòng nhập đủ 6 chữ số mã xác minh.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      await apiClient.auth.verifyEmail({ email: emailParam, code: fullOtp });
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login?verified=true");
      }, 1500);
    } catch (verificationError) {
      setError(verificationError instanceof ApiError ? verificationError.message : "Mã xác minh không chính xác hoặc đã hết hạn.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend() {
    if (!canResend) return;
    try {
      await apiClient.auth.resendVerification({ email: emailParam });
      setCountdown(60);
      setOtp(["", "", "", "", "", ""]);
      setError(null);
      inputRefs.current[0]?.focus();
    } catch (resendError) {
      setError(resendError instanceof ApiError ? resendError.message : "Không thể gửi lại mã xác minh.");
    }
  }

  return (
    <div className="w-full max-w-[500px] mx-auto my-auto py-8">
      {!isSuccess ? (
        <>
          <div className="mb-6">
            <h2 className="text-[32px] font-semibold text-[#203c37] tracking-[-1px]">
              Xác minh mã OTP.
            </h2>
            <p className="text-[15px] text-[#74817b] mt-1.5 leading-relaxed">
              Chúng tôi đã gửi mã 6 chữ số đến địa chỉ{" "}
              <strong className="text-[#203c37]">{emailParam}</strong>.
            </p>
          </div>

          {/* Expiry Pill */}
          <div className="inline-flex items-center px-3 py-1 rounded-[100px] bg-[#eaf2ed] text-[#15594f] text-[12px] font-semibold mb-6">
            {countdown > 0 ? `MÃ HẾT HẠN SAU ${countdown}S` : "MÃ ĐÃ HẾT HẠN"}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-[8px] bg-[#fee2e2] text-[#991b1b] text-[13px]">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            {/* 6 Digit Input Boxes (Figma: 86px width each, 68px height) */}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  className="size-[48px] sm:size-[68px] text-center text-[24px] font-bold rounded-[8px] bg-white border border-[#e2e7e1] text-[#203c37] outline-none transition-colors focus:border-[#15594f] focus:ring-2 focus:ring-[#15594f]/20 shadow-sm"
                />
              ))}
            </div>

            {/* Resend Action */}
            <div className="text-center text-[13px] text-[#74817b]">
              {canResend ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="text-[#15594f] font-semibold hover:underline cursor-pointer"
                >
                  Gửi lại mã xác minh ngay
                </button>
              ) : (
                <span>Chưa nhận được mã? Gửi lại sau {countdown}s</span>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying || otp.join("").length < 6}
              className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? (
                <span>Đang xác minh...</span>
              ) : (
                <>
                  <ShieldCheck className="size-4" />
                  <span>Xác minh tài khoản</span>
                </>
              )}
            </button>
          </form>

          {/* Security info */}
          <div className="mt-8 p-4 rounded-[8px] bg-[#f2ede3] border border-[#e2e7e1] flex items-start gap-3">
            <Info className="size-4 text-[#74817b] shrink-0 mt-0.5" />
            <p className="text-[12px] text-[#74817b] leading-relaxed">
              Tuyệt đối không chia sẻ mã xác thực này cho bất kỳ ai, kể cả nhân viên tự xưng là của 5K-Rental Manager.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-[13px] text-[#74817b] hover:text-[#203c37] hover:underline"
            >
              Quay lại trang Đăng nhập
            </Link>
          </div>
        </>
      ) : (
        /* Success confirmation */
        <div className="text-center space-y-6">
          <div className="size-16 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-8" />
          </div>
          <h2 className="text-[28px] font-semibold text-[#203c37]">
            Xác minh thành công!
          </h2>
          <p className="text-[14px] text-[#74817b]">
            Tài khoản 5K-Rental Manager của bạn đã được kích hoạt. Đang chuyển hướng đến trang đăng nhập...
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyOtpPage() {
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
            XÁC THỰC DANH TÍNH
          </div>

          <h1 className="text-[44px] font-semibold leading-[1.18] tracking-[-1.5px] text-white">
            Bảo vệ tài khoản.<br />An tâm trải nghiệm.
          </h1>

          <p className="text-[16px] text-[#e3ece6] leading-relaxed max-w-[480px]">
            Mã OTP giúp xác minh tính chính chủ của email hoặc số điện thoại, đảm bảo giao dịch và hợp đồng thuê phòng luôn an toàn.
          </p>

          <div className="pt-4 border-t border-white/15">
            <p className="text-[13px] text-[#d3dfd5]">
              Mã xác minh chỉ sử dụng được một lần duy nhất.
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
            Liên hệ hỗ trợ ↗
          </Link>
        </div>

        <React.Suspense fallback={<div className="w-full max-w-[500px] mx-auto py-8 text-center text-[#74817b]">Đang tải...</div>}>
          <VerifyOtpForm />
        </React.Suspense>

        <p className="text-[11px] text-[#74817b] text-center max-w-[500px] mx-auto">
          5K-Rental Manager — Nền tảng quản lý phòng trọ minh bạch và tin cậy.
        </p>
      </main>
    </div>
  );
}
