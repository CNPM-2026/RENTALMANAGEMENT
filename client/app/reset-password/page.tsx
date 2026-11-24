"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { apiClient, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate: nếu không có token thì hiện 403
  if (!token) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-[16px] border border-[#e2e7e1] bg-white p-8 text-center shadow-sm space-y-4">
          <p className="text-6xl font-extrabold text-[#991b1b]">403</p>
          <h1 className="text-2xl font-bold text-[#203c37]">Không có quyền truy cập</h1>
          <p className="text-sm text-[#74817b] leading-relaxed">
            Liên kết đặt lại mật khẩu không hợp lệ hoặc thiếu mã token xác thực. Vui lòng kiểm tra lại liên kết trong email hoặc gửi lại yêu cầu đặt lại mật khẩu.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/forgot-password"
              className="inline-flex justify-center rounded-[8px] bg-[#15594f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#124b42]"
            >
              Yêu cầu cấp lại mã
            </Link>
            <Link
              href="/login"
              className="inline-flex justify-center rounded-[8px] border border-[#e2e7e1] px-4 py-2.5 text-sm font-semibold text-[#203c37] hover:bg-[#f7f6f2]"
            >
              Về trang đăng nhập
            </Link>
          </div>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!token) {
      setMessage("Liên kết đặt lại mật khẩu không có mã hợp lệ.");
      return;
    }
    if (password !== confirmation) {
      setMessage("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (password.length < 6) {
      setMessage("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiClient.auth.resetPassword({ token, password });
      setIsSuccess(true);
      setMessage(
        response.message ?? "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setMessage(err.message || "Không thể đặt lại mật khẩu.");
      } else {
        setMessage("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-5 rounded-2xl bg-white p-8 shadow-lg"
      >
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Đặt lại mật khẩu
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Nhập mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {isSuccess ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2.5 p-3.5 rounded-lg bg-[#eaf2ed] text-[#15594f] text-sm">
              <CheckCircle2 className="size-5 shrink-0" />
              <span>{message}</span>
            </div>
            <Link
              href="/login"
              className="block w-full text-center rounded-lg bg-[#15594f] px-4 py-2.5 font-medium text-white hover:bg-[#124b42]"
            >
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-zinc-700">
              Mật khẩu mới
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Xác nhận mật khẩu
              <input
                required
                minLength={6}
                type="password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none focus:border-blue-500"
              />
            </label>

            {message && (
              <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang xử lý..." : "Đổi mật khẩu"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6">
          Đang tải...
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
