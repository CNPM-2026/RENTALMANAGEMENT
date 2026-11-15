"use client";

import * as React from "react";
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api";
import { translateKycState } from "@/lib/labels";
import type { KycSubmission } from "@/types/models";
import { AddressFields, AddressValue } from "@/components/address/address-fields";

export interface KycSubmissionFormProps {
  /** Nhãn nhỏ phía trên tiêu đề (khác nhau giữa chủ trọ và thợ). */
  eyebrow: string;
  title: string;
  description: string;
  /** Ghi chú nghiệp vụ riêng của từng role. */
  notice?: React.ReactNode;
  submitLabel?: string;
  successMessage?: string;
  onSubmitted?: (submission: KycSubmission) => void;
}

/**
 * Form nộp hồ sơ CCCD DÙNG CHUNG cho chủ trọ và thợ.
 *
 * Không có nhánh `if (role === ...)` nào ở đây: dữ liệu, API (`/users/kyc`),
 * thư mục lưu trữ private và luồng admin duyệt là một. Khác biệt giữa hai role
 * chỉ là phần chữ nghĩa (truyền qua props) và hệ quả phía server
 * (`kycGate.service`: thợ phải được duyệt trước khi nhận việc).
 */
export function KycSubmissionForm({
  eyebrow,
  title,
  description,
  notice,
  submitLabel = "Gửi yêu cầu kiểm duyệt",
  successMessage = "Đã gửi yêu cầu KYC, vui lòng chờ admin kiểm duyệt.",
  onSubmitted,
}: KycSubmissionFormProps) {
  const [kyc, setKyc] = React.useState<KycSubmission | null>(null);
  const [form, setForm] = React.useState({ idNumber: "", permanentAddress: "" });
  const [permanentLocation, setPermanentLocation] = React.useState<AddressValue>({
    address: "", province: "", district: "", ward: "",
  });
  const [frontId, setFrontId] = React.useState<File | null>(null);
  const [backId, setBackId] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void apiClient.users.getMyKyc().then((value) => {
      if (value) {
        setKyc(value);
        setForm({ idNumber: value.idNumber, permanentAddress: value.permanentAddress });
        setPermanentLocation((current) => ({ ...current, address: value.permanentAddress }));
      }
    }).catch(() => setError("Không tải được hồ sơ KYC."));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (!frontId || !backId) {
        setError("Vui lòng tải lên đủ ảnh CCCD mặt trước và mặt sau.");
        return;
      }
      setIsSubmitting(true);
      const payload = new FormData();
      payload.append("idNumber", form.idNumber.trim());
      const locationText = [permanentLocation.address, permanentLocation.ward, permanentLocation.district, permanentLocation.province]
        .filter(Boolean).join(", ");
      payload.append("permanentAddress", (locationText || form.permanentAddress).trim());
      payload.append("frontId", frontId);
      payload.append("backId", backId);
      const result = await apiClient.users.submitKyc(payload);
      setKyc(result);
      setMessage(successMessage);
      onSubmitted?.(result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể gửi yêu cầu KYC.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusTone = !kyc
    ? "border-[#e2e7e1] bg-white text-[#74817b]"
    : kyc.status === "APPROVED"
      ? "border-[#cfe0d8] bg-[#eaf2ed] text-[#15594f]"
      : kyc.status === "REJECTED"
        ? "border-[#fecaca] bg-[#fee2e2] text-[#991b1b]"
        : "border-[#fbf1dc] bg-[#fdf8ec] text-[#9a6a12]";

  const isVerified = kyc?.status === "APPROVED";
  const isAwaitingReview = kyc?.status === "PENDING";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <p className="text-[12px] text-[#74817b]">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-semibold text-[#203c37]">{title}</h1>
        <p className="mt-1 text-[14px] text-[#74817b]">{description}</p>
      </div>

      {notice && (
        <div className="rounded-[10px] border border-[#e2e7e1] bg-white p-4 text-[13px] text-[#203c37] shadow-xs">
          {notice}
        </div>
      )}

      <div className={`rounded-[10px] border p-4 text-[13px] flex items-start gap-2.5 ${statusTone}`}>
        {kyc?.status === "APPROVED" ? (
          <BadgeCheck className="size-4 shrink-0 mt-0.5" />
        ) : kyc?.status === "REJECTED" ? (
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
        )}
        <div>
          <p className="font-semibold">
            Trạng thái KYC: {kyc ? translateKycState(kyc.status) : "Chưa nộp hồ sơ"}
          </p>
          {kyc?.status === "REJECTED" && kyc.rejectionReason && (
            <p className="mt-0.5">Lý do từ chối: {kyc.rejectionReason}</p>
          )}
          {kyc?.status === "PENDING" && (
            <p className="mt-0.5">
              Hồ sơ đang chờ quản trị viên đối soát. Bạn không thể nộp lại khi hồ sơ đang chờ duyệt.
            </p>
          )}
          {kyc?.status === "REJECTED" && (
            <p className="mt-0.5">Bạn có thể nộp lại hồ sơ bằng biểu mẫu bên dưới.</p>
          )}
          {kyc?.status === "APPROVED" && (
            <p className="mt-0.5">
              Tài khoản đã xác thực KYC. Ảnh CCCD đã được xoá khỏi Cloudinary và mỗi tài khoản chỉ
              được xác thực một lần.
            </p>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-[10px] border border-[#cfe0d8] bg-[#eaf2ed] p-4 text-[13px] text-[#15594f] flex items-center gap-2.5">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="rounded-[10px] border border-[#fecaca] bg-[#fee2e2] p-4 text-[13px] text-[#991b1b] flex items-center gap-2.5">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isVerified ? (
        <div className="rounded-[12px] border border-[#cfe0d8] bg-[#eaf2ed] p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <BadgeCheck className="size-6 shrink-0 text-[#15594f]" />
            <div className="space-y-1.5">
              <h2 className="text-[16px] font-semibold text-[#15594f]">Ảnh CCCD đã xác thực KYC</h2>
              <p className="text-[13px] text-[#203c37] leading-relaxed">
                Hồ sơ danh tính của bạn đã được duyệt. Ảnh CCCD mặt trước/mặt sau đã được xoá khỏi
                Cloudinary và không còn được lưu trong hệ thống. Mỗi tài khoản chỉ được xác thực KYC
                một lần duy nhất.
              </p>
              <dl className="grid grid-cols-1 gap-1 pt-1 text-[13px] text-[#203c37] sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#74817b]">Số CCCD</dt>
                  <dd className="font-semibold">{kyc?.idNumber}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#74817b]">Địa chỉ thường trú</dt>
                  <dd>{kyc?.permanentAddress}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      ) : isAwaitingReview ? (
        <div className="rounded-[12px] border border-[#fbf1dc] bg-[#fdf8ec] p-6 text-[13px] text-[#9a6a12] shadow-xs">
          <p className="font-semibold">Hồ sơ KYC đang được xác thực</p>
          <p className="mt-1 leading-relaxed">
            Quản trị viên đang đối soát ảnh CCCD. Bạn không thể nộp lại hồ sơ trong thời gian này.
            Kết quả sẽ được thông báo khi hoàn tất.
          </p>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-4 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <label className="block text-[13px] font-semibold text-[#203c37]">
          Số CCCD / CMND
          <input
            required
            value={form.idNumber}
            onChange={(event) => setForm({ ...form, idNumber: event.target.value })}
            placeholder="12 chữ số trên CCCD gắn chip"
            minLength={9}
            maxLength={20}
            className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] font-normal text-[#203c37] outline-none focus:border-[#15594f]"
          />
        </label>

        <AddressFields
          value={permanentLocation}
          onChange={(value) => {
            setPermanentLocation(value);
            setForm((current) => ({ ...current, permanentAddress: value.address }));
          }}
          required
        />

        <label className="block text-[13px] font-semibold text-[#203c37]">
          Ảnh CCCD mặt trước
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFrontId(event.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] p-2 text-[13px] font-normal text-[#203c37]"
          />
        </label>
        <label className="block text-[13px] font-semibold text-[#203c37]">
          Ảnh CCCD mặt sau
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setBackId(event.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] p-2 text-[13px] font-normal text-[#203c37]"
          />
        </label>

        <p className="text-[12px] text-[#74817b]">
          Ảnh CCCD được lưu ở chế độ riêng tư và chỉ quản trị viên kiểm duyệt mới xem được.
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </button>
      </form>
      )}
    </div>
  );
}
