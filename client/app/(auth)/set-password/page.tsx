"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Home, Lock, ShieldCheck } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { clearPasswordSetupGrant, peekPasswordSetupGrant } from "@/lib/passwordSetupGrant";

/** Policy tối thiểu giống `register` / `reset-password` (`z.string().min(6)`). */
const MIN_PASSWORD_LENGTH = 6;

function SetPasswordForm() {
  const router = useRouter();

  const [grant, setGrant] = React.useState<string | null>(null);
  const [isGrantChecked, setIsGrantChecked] = React.useState(false);
  const [grantUnusable, setGrantUnusable] = React.useState(false);

  const [password, setPassword] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * H-05/Batch 2B1.1 (F-1): chặn submit trùng một cách ĐỒNG BỘ. `isSubmitting` chỉ có
   * hiệu lực sau khi React render lại, nên hai lần submit trong cùng một tick (Enter +
   * click, double click) vẫn lọt qua nếu chỉ dựa vào state. Ref này bảo đảm tại một
   * thời điểm chỉ có một request redemption cho grant đang giữ.
   */
  const submittingRef = React.useRef(false);

  /**
   * Grant chỉ nằm trong RAM của tab này (xem `lib/passwordSetupGrant.ts`).
   * Đọc KHÔNG tiêu thụ: mount lại trang (back/forward nội bộ, Fast Refresh) vẫn thấy
   * grant còn hạn. Grant bị xóa sau khi server đã đặt mật khẩu thành công, hoặc khi
   * reload làm mất RAM — lúc đó người dùng phải yêu cầu liên kết mới qua `quên mật
   * khẩu`, vì grant không thể tái phát nếu không chứng minh lại quyền sở hữu hộp thư.
   */
  React.useEffect(() => {
    const pending = peekPasswordSetupGrant();
    // Cổng "đã mount" để SSR/hydration không lệch markup: server không có grant trong
    // RAM nên chỉ được render trạng thái "Đang tải..." cho tới sau hydration. Đây là
    // setState đồng bộ duy nhất còn lại trong effect và nó chỉ chạy một lần khi mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrant(pending);
    setGrantUnusable(pending === null);
    setIsGrantChecked(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Một redemption tại một thời điểm: lần submit thứ hai khi request đầu còn bay
    // quay lại ngay, nên không thể có hai request song song trên cùng một grant.
    if (submittingRef.current || isDone) return;

    setError(null);

    if (!grant) {
      setGrantUnusable(true);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await apiClient.auth.setPassword({ token: grant, password });

      // Server đã tăng `authVersion` nên grant này vĩnh viễn không dùng lại được;
      // xóa bản trong RAM. Đây là chỗ DUY NHẤT xóa grant — mọi nhánh lỗi giữ nguyên
      // grant để người dùng thử lại (F-1).
      clearPasswordSetupGrant();
      setGrant(null);
      setIsDone(true);
      setTimeout(() => {
        router.replace("/login?passwordSet=1");
      }, 1200);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        // Backend trả CÙNG một 400 cho mọi thất bại của grant (hết hạn, đã dùng,
        // sai chữ ký, tài khoản bị khóa...), nên message chỉ có thể là thông điệp
        // chung và không tiết lộ trạng thái tài khoản.
        setError(submitError.message || "Không thể thiết lập mật khẩu. Vui lòng thử lại.");
      } else {
        setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (!isGrantChecked) {
    return <p className="text-[14px] text-[#74817b] text-center">Đang tải...</p>;
  }

  if (isDone) {
    return (
      <div className="text-center space-y-6">
        <div className="size-16 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-8" />
        </div>
        <h2 className="text-[28px] font-semibold text-[#203c37]">Đã thiết lập mật khẩu</h2>
        <p className="text-[14px] text-[#74817b] leading-relaxed">
          Mật khẩu mới đã được lưu. Đang chuyển đến trang đăng nhập...
        </p>
      </div>
    );
  }
  if (grantUnusable) {
    return (
      <div className="space-y-6">
        <div className="size-16 rounded-full bg-[#fee2e2] text-[#991b1b] flex items-center justify-center mx-auto">
          <AlertCircle className="size-8" />
        </div>
        <div className="text-center space-y-3">
          <h2 className="text-[28px] font-semibold text-[#203c37]">Liên kết không còn hiệu lực</h2>
          <p className="text-[14px] text-[#74817b] leading-relaxed">
            Phiên thiết lập mật khẩu đã hết hạn hoặc đã được sử dụng. Để bảo vệ tài khoản,
            liên kết này chỉ dùng được một lần và chỉ sống vài phút.
          </p>
          <p className="text-[14px] text-[#74817b] leading-relaxed">
            Vui lòng yêu cầu liên kết mới qua chức năng quên mật khẩu — chúng tôi cần xác minh
            lại quyền truy cập hộp thư của bạn.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-[8px] bg-[#fee2e2] text-[#991b1b] text-[13px]">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center transition-all shadow-sm active:scale-[0.99]"
          >
            Yêu cầu liên kết mới
          </Link>
          <Link
            href="/login"
            className="text-center text-[13px] text-[#74817b] hover:text-[#203c37] hover:underline"
          >
            Quay lại trang Đăng nhập
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[32px] font-semibold text-[#203c37] tracking-[-1px]">
          Thiết lập mật khẩu mới.
        </h2>
        <p className="text-[15px] text-[#74817b] mt-1.5 leading-relaxed">
          Email của bạn đã được xác minh. Chọn một mật khẩu mới để đăng nhập từ nay về sau.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-[8px] bg-[#fee2e2] border border-[#fecaca] text-[#991b1b] text-[13px] flex items-center gap-2.5">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="block text-[13px] font-semibold text-[#203c37] mb-2">
            Mật khẩu mới
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#74817b]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full h-[46px] rounded-[8px] bg-white border border-[#e2e7e1] pl-10 pr-11 text-[14px] text-[#203c37] outline-none transition-colors focus:border-[#15594f] focus:ring-2 focus:ring-[#15594f]/20 shadow-sm"
              placeholder={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#74817b] hover:text-[#203c37] cursor-pointer"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirmation" className="block text-[13px] font-semibold text-[#203c37] mb-2">
            Xác nhận mật khẩu
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#74817b]" />
            <input
              id="confirmation"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full h-[46px] rounded-[8px] bg-white border border-[#e2e7e1] pl-10 pr-10 text-[14px] text-[#203c37] outline-none transition-colors focus:border-[#15594f] focus:ring-2 focus:ring-[#15594f]/20 shadow-sm"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !password || !confirmation}
          className="w-full h-[46px] rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          <ShieldCheck className="size-4" />
          <span>{isSubmitting ? "Đang lưu..." : "Lưu mật khẩu mới"}</span>
        </button>
      </form>

      <div className="p-4 rounded-[8px] bg-[#f2ede3] border border-[#e2e7e1] flex items-start gap-3">
        <AlertCircle className="size-4 text-[#74817b] shrink-0 mt-0.5" />
        <p className="text-[12px] text-[#74817b] leading-relaxed">
          Mật khẩu bạn đã nhập lúc đăng ký không còn hiệu lực. Hãy dùng mật khẩu mới này để đăng nhập.
        </p>
      </div>

      <div className="text-center">
        <Link
          href="/login"
          className="text-[13px] text-[#74817b] hover:text-[#203c37] hover:underline"
        >
          Quay lại trang Đăng nhập
        </Link>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-[#f7f6f2] text-[#203c37]">
      <header className="p-6 sm:p-12 lg:px-[106px] lg:pt-[48px]">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="size-[36px] bg-[#15594f] rounded-[12px] flex items-center justify-center text-white shadow-sm">
            <Home className="size-5" />
          </div>
          <span className="text-[20px] font-bold tracking-[-0.5px] text-[#203c37]">
            5K-Rental Manager
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[500px]">
          <SetPasswordForm />
        </div>
      </main>

      <p className="text-[11px] text-[#74817b] text-center px-6 pb-6">
        5K-Rental Manager — Nền tảng quản lý phòng trọ minh bạch và tin cậy.
      </p>
    </div>
  );
}
