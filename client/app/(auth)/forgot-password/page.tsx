"use client";

import * as React from "react";
import Link from "next/link";
import { Home, Mail, ArrowLeft, Info, CheckCircle2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  async function handleForgotPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.includes("@")) {
      setErrorMessage("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.auth.forgotPassword({ email: email.trim().toLowerCase() });
      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Không thể gửi yêu cầu đặt lại mật khẩu.");
      } else {
        setErrorMessage("Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
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
            BẢO MẬT TÀI KHOẢN
          </div>

          <h1 className="text-[44px] font-semibold leading-[1.18] tracking-[-1.5px] text-white">
            Khôi phục<br />truy cập dễ dàng.
          </h1>

          <p className="text-[16px] text-[#e3ece6] leading-relaxed max-w-[480px]">
            Hệ thống hỗ trợ đặt lại mật khẩu an toàn qua email xác thực một lần để bảo vệ tài khoản người dùng tuyệt đối.
          </p>

          <div className="pt-4 border-t border-white/15">
            <p className="text-[13px] text-[#d3dfd5]">
              Liên kết khôi phục có hiệu lực trong vòng 60 phút.
            </p>
          </div>
        </div>
      </aside>

      {/* 2. Right Form Container */}
      <main className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:px-[106px] lg:py-[48px] overflow-y-auto">
        <div className="flex justify-start">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#74817b] hover:text-[#15594f] transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại Đăng nhập</span>
          </Link>
        </div>

        <div className="w-full max-w-[480px] mx-auto my-auto py-8">
          {!isSuccess ? (
            <>
              <div className="mb-8">
                <h2 className="text-[32px] font-semibold text-[#203c37] tracking-[-1px]">
                  Quên mật khẩu?
                </h2>
                <p className="text-[15px] text-[#74817b] mt-1.5">
                  Nhập email tài khoản của bạn để nhận liên kết đặt lại mật khẩu mới.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-[8px] bg-[#fee2e2] text-[#991b1b] text-[13px]">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-[13px] font-semibold text-[#203c37] mb-2"
                  >
                    Email đã đăng ký
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="linh.nguyen@gmail.com"
                    className="w-full min-h-[48px] px-3.5 py-3 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <span>Đang gửi liên kết...</span>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      <span>Gửi liên kết khôi phục</span>
                    </>
                  )}
                </button>
              </form>

              {/* Note callout */}
              <div className="mt-8 p-4 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-start gap-3">
                <Info className="size-4 text-[#15594f] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#15594f] leading-relaxed">
                  Kiểm tra cả hộp thư rác (Spam / Junk) nếu bạn không nhận được thư sau 1 - 2 phút.
                </p>
              </div>
            </>
          ) : (
            /* Success confirmation view */
            <div className="text-center space-y-6">
              <div className="size-16 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-8" />
              </div>

              <div>
                <h2 className="text-[28px] font-semibold text-[#203c37]">
                  Đã gửi liên kết!
                </h2>
                <p className="text-[14px] text-[#74817b] mt-2 leading-relaxed">
                  Nếu email <strong className="text-[#203c37]">{email}</strong> tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi đến hộp thư của bạn.
                </p>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Link
                  href="/login"
                  className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center transition-colors"
                >
                  Quay lại Đăng nhập
                </Link>

                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="text-[13px] text-[#74817b] hover:text-[#15594f] underline cursor-pointer"
                >
                  Gửi lại tới email khác
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#74817b] text-center max-w-[500px] mx-auto">
          5K-Rental Manager — Nền tảng thuê trọ và quản lý bất động sản tiện nghi.
        </p>
      </main>
    </div>
  );
}
