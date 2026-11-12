"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Home, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiClient, ApiError, getBaseApiUrl } from "@/lib/api";
import { setAuthSession, getCurrentUser } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [emailOrPhone, setEmailOrPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [rememberMe, setRememberMe] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Handle Google OAuth callback (#google=<url-encoded params>)
  React.useEffect(() => {
    const hash = window.location.hash;

    if (!hash.startsWith("#google=")) {
      if (searchParams.get("googleError")) {
        queueMicrotask(() =>
          setErrorMessage("Đăng nhập Google thất bại. Vui lòng thử lại.")
        );
      }
      return;
    }

    let payload: URLSearchParams;
    try {
      payload = new URLSearchParams(
        decodeURIComponent(hash.replace(/^#google=/, ""))
      );
    } catch {
      queueMicrotask(() =>
        setErrorMessage("Phản hồi đăng nhập Google không hợp lệ.")
      );
      return;
    }

    const token = payload.get("token");
    const refreshToken = payload.get("refreshToken");
    if (!token || !refreshToken) {
      queueMicrotask(() =>
        setErrorMessage("Phản hồi đăng nhập Google không hợp lệ.")
      );
      return;
    }

    apiClient.auth
      .getMeWithToken(token)
      .then((user) => {
        setAuthSession(token, refreshToken, user);
        router.replace("/");
      })
      .catch(() =>
        setErrorMessage("Không thể hoàn tất đăng nhập Google.")
      );
  }, [router, searchParams]);

  // If already logged in, redirect away
  React.useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      router.replace("/");
    }
  }, [router]);

  // H-05/Batch 2B1: quay về từ bước thiết lập mật khẩu sau khi xác minh email.
  // Giá trị được suy ra trực tiếp từ URL (không state/effect): ở đây chỉ có một cờ
  // hiển thị thông báo, KHÔNG có token nào được đọc từ URL.
  const passwordSetMessage = searchParams.get("passwordSet")
    ? "Mật khẩu đã được thiết lập. Vui lòng đăng nhập bằng email và mật khẩu mới."
    : null;

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    if (!emailOrPhone.trim()) {
      setErrorMessage("Vui lòng nhập email hoặc số điện thoại.");
      return;
    }
    if (!password) {
      setErrorMessage("Vui lòng nhập mật khẩu.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.auth.login({
        email: emailOrPhone.trim(),
        password,
      });

      setAuthSession(response.token, response.refreshToken, response.user);

      router.push("/");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Tài khoản hoặc mật khẩu không chính xác.");
      } else {
        setErrorMessage("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[500px] mx-auto my-auto py-8">
      <div className="mb-8">
        <h2 className="text-[32px] font-semibold text-[#203c37] tracking-[-1px]">
          Mừng bạn trở lại.
        </h2>
        <p className="text-[15px] text-[#74817b] mt-1.5">
          Chốn ở và những kết nối của bạn vẫn ở đây.
        </p>
      </div>

      {passwordSetMessage && (
        <div className="mb-6 p-4 rounded-[8px] bg-[#eaf2ed] border border-[#cfe3d7] text-[#15594f] text-[13px] flex items-center gap-2.5">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{passwordSetMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 p-4 rounded-[8px] bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-center gap-2.5">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label
            htmlFor="emailOrPhone"
            className="block text-[13px] font-semibold text-[#203c37] mb-2"
          >
            Email hoặc số điện thoại
          </label>
          <input
            id="emailOrPhone"
            type="text"
            autoComplete="username"
            required
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            placeholder="linh.nguyen@gmail.com hoặc 0987654321"
            className="w-full min-h-[48px] px-3.5 py-3 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none transition-colors focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[13px] font-semibold text-[#203c37] mb-2"
          >
            Mật khẩu
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu của bạn"
              className="w-full min-h-[48px] px-3.5 py-3 pr-11 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none transition-colors focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74817b] hover:text-[#203c37] p-1 cursor-pointer"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-[18px] rounded-[4px] border-[#e2e7e1] text-[#15594f] focus:ring-[#15594f] accent-[#15594f]"
            />
            <span className="text-[13px] text-[#203c37]">Ghi nhớ đăng nhập</span>
          </label>

          <Link
            href="/forgot-password"
            className="text-[13px] font-semibold text-[#15594f] hover:underline"
          >
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <span>Đang đăng nhập...</span>
          ) : (
            <>
              <ArrowRight className="size-4" />
              <span>Đăng nhập</span>
            </>
          )}
        </button>
      </form>

      <div className="flex items-center my-6">
        <div className="flex-1 h-px bg-[#e2e7e1]" />
        <span className="px-3 text-[12px] text-[#74817b] uppercase">hoặc tiếp tục với</span>
        <div className="flex-1 h-px bg-[#e2e7e1]" />
      </div>

      {/* Google OAuth: use <a> for full-page navigation to backend endpoint */}
      <a
        href={`${getBaseApiUrl()}/auth/google`}
        className="w-full h-[46px] rounded-[8px] bg-white border border-[#e2e7e1] text-[#203c37] text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-[#f7f6f2]"
      >
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.44 7.35 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.56 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z"
          />
        </svg>
        <span>Google</span>
      </a>

      <p className="text-center text-[14px] text-[#203c37] mt-6">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="text-[#15594f] font-semibold hover:underline"
        >
          Đăng ký miễn phí
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex bg-[#f7f6f2] text-[#203c37]">
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
            MỘT CHỐN Ở HỢP GU
          </div>

          <h1 className="text-[44px] font-semibold leading-[1.18] tracking-[-1.5px] text-white">
            Tìm chốn về.<br />Gặp người hợp.
          </h1>

          <p className="text-[16px] text-[#e3ece6] leading-relaxed max-w-[480px]">
            Bắt đầu cuộc sống thành phố theo cách của bạn, cùng những người bạn muốn sẻ chia trên hệ thống quản lý thuê trọ hiện đại.
          </p>

          <div className="pt-4 border-t border-white/15">
            <p className="text-[13px] text-[#d3dfd5]">
              Hơn 12.000 người thuê đã tìm thấy chốn ở lý tưởng của mình.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:px-[106px] lg:py-[48px] overflow-y-auto">
        <div className="flex justify-end text-[13px] text-[#74817b]">
          <span>Cần giúp đỡ? </span>
          <Link
            href="/tenant/support"
            className="ml-1 text-[#15594f] font-semibold hover:underline"
          >
            Liên hệ 5K-Rental Manager ↗
          </Link>
        </div>

        <React.Suspense fallback={<div className="w-full max-w-[500px] mx-auto py-8 text-center text-[#74817b]">Đang tải...</div>}>
          <LoginForm />
        </React.Suspense>

        <p className="text-[11px] text-[#74817b] text-center max-w-[500px] mx-auto">
          Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư của 5K-Rental Manager.
        </p>
      </main>
    </div>
  );
}