"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { KycSubmission } from "@/types/models";

export default function LandlordKycPage() {
  const [kyc, setKyc] = React.useState<KycSubmission | null>(null);
  const [form, setForm] = React.useState({ idNumber: "", permanentAddress: "" });
  const [frontId, setFrontId] = React.useState<File | null>(null);
  const [backId, setBackId] = React.useState<File | null>(null);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void apiClient.users.getMyKyc().then((value) => {
      if (value) {
        setKyc(value);
        setForm({ idNumber: value.idNumber, permanentAddress: value.permanentAddress });
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
      const payload = new FormData();
      payload.append("idNumber", form.idNumber.trim());
      payload.append("permanentAddress", form.permanentAddress.trim());
      payload.append("frontId", frontId);
      payload.append("backId", backId);
      const result = await apiClient.users.submitKyc(payload);
      setKyc(result);
      setMessage("Đã gửi yêu cầu KYC, vui lòng chờ admin kiểm duyệt.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể gửi yêu cầu KYC.");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tài khoản chủ trọ</p>
        <h1 className="mt-1 text-[26px] font-semibold text-[#203c37]">Yêu cầu kiểm duyệt KYC</h1>
        <p className="mt-1 text-sm text-[#74817b]">Gửi thông tin định danh để admin xác minh tài khoản chủ trọ.</p>
      </div>
      {kyc && <p className="rounded border bg-white p-3 text-sm">Trạng thái: <strong>{kyc.status === "PENDING" ? "Đang chờ duyệt" : kyc.status === "APPROVED" ? "Đã duyệt" : "Bị từ chối"}</strong>{kyc.rejectionReason && ` - ${kyc.rejectionReason}`}</p>}
      {message && <p className="text-sm text-[#15594f]">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={submit} className="space-y-4 rounded-[12px] border bg-white p-6 shadow-sm">
        <input required placeholder="Số CCCD" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} className="w-full rounded border p-2 text-sm" />
        <textarea required placeholder="Địa chỉ thường trú" value={form.permanentAddress} onChange={(e) => setForm({ ...form, permanentAddress: e.target.value })} className="w-full rounded border p-2 text-sm" />
        <label className="block text-sm font-medium">Ảnh CCCD mặt trước<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFrontId(e.target.files?.[0] ?? null)} className="mt-1 w-full rounded border p-2 text-sm" /></label>
        <label className="block text-sm font-medium">Ảnh CCCD mặt sau<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setBackId(e.target.files?.[0] ?? null)} className="mt-1 w-full rounded border p-2 text-sm" /></label>
        <button type="submit" className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white">Gửi yêu cầu kiểm duyệt</button>
      </form>
    </div>
  );
}
