"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await response.json();
      setMessage(
        response.ok
          ? "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."
          : body.message ?? "Không thể đặt lại mật khẩu.",
      );
    } catch {
      setMessage("Không thể kết nối tới máy chủ. Vui lòng thử lại.");
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
          <p className="rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
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
