"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, BadgeCheck, CheckCircle2, Loader2, MapPin, Save, ShieldAlert, Wallet } from "lucide-react";
import { apiClient } from "@/lib/api";
import { SERVICE_CATEGORY_OPTIONS, translateKycState, translateServiceCategory } from "@/lib/labels";
import type { ServiceCategory, StaffProfile, StaffProfilePayload } from "@/types/models";

/**
 * Parse một ô nhập số của người dùng.
 * - Rỗng -> `null` (nghĩa là XOÁ giá trị đã lưu, không phải 0).
 * - Chấp nhận dấu phẩy thập phân kiểu Việt Nam ("1,5" -> 1.5).
 * - Mọi giá trị không phải số đều ném lỗi: KHÔNG bao giờ âm thầm đổi thành 0
 *   hay NaN (`Number('') === 0` chính là cái bẫy cần tránh).
 */
function parseNumberField(raw: string, label: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`${label} không hợp lệ: "${trimmed}" không phải là số.`);
  }
  return value;
}

const EMPTY_FORM = {
  description: "",
  serviceAddress: "",
  latitude: "",
  longitude: "",
  priceMin: "",
  priceMax: "",
};

export default function StaffProfilePage() {
  const [profile, setProfile] = React.useState<StaffProfile | null>(null);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [skills, setSkills] = React.useState<ServiceCategory[]>([]);
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  /** KYC của thợ lấy từ hồ sơ dùng chung; chỉ `APPROVED` mới cho bật nhận việc. */
  const kycStatus = profile?.kycStatus ?? "NONE";
  const isKycApproved = kycStatus === "APPROVED";

  const applyProfile = React.useCallback((data: StaffProfile | null) => {
    setProfile(data);
    setForm({
      description: data?.description ?? "",
      serviceAddress: data?.serviceAddress ?? "",
      latitude: data?.latitude != null ? String(data.latitude) : "",
      longitude: data?.longitude != null ? String(data.longitude) : "",
      priceMin: data?.priceMin != null ? String(data.priceMin) : "",
      priceMax: data?.priceMax != null ? String(data.priceMax) : "",
    });
    setSkills((data?.skills ?? []).map((skill) => skill.category));
    // Mặc định TẮT nhận việc khi chưa có hồ sơ: server chỉ cho bật khi KYC đã
    // duyệt, nên mặc định `true` sẽ làm lần lưu hồ sơ đầu tiên bị 403.
    setIsAvailable(data?.isAvailable ?? false);
  }, []);

  React.useEffect(() => {
    apiClient.staffMarketplace
      .getMe()
      .then(applyProfile)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không tải được hồ sơ thợ."),
      )
      .finally(() => setIsLoading(false));
  }, [applyProfile]);

  const updateField = (field: keyof typeof EMPTY_FORM) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const toggleSkill = (category: ServiceCategory) =>
    setSkills((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const latitude = parseNumberField(form.latitude, "Vĩ độ");
      const longitude = parseNumberField(form.longitude, "Kinh độ");
      if ((latitude === null) !== (longitude === null)) {
        throw new Error("Vui lòng nhập đủ cả vĩ độ và kinh độ, hoặc bỏ trống cả hai.");
      }
      const priceMin = parseNumberField(form.priceMin, "Giá tối thiểu");
      const priceMax = parseNumberField(form.priceMax, "Giá tối đa");
      if (priceMin !== null && priceMax !== null && priceMax < priceMin) {
        throw new Error("Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.");
      }

      const payload: StaffProfilePayload = {
        description: form.description.trim() === "" ? null : form.description.trim(),
        serviceAddress: form.serviceAddress.trim() === "" ? null : form.serviceAddress.trim(),
        latitude,
        longitude,
        priceMin,
        priceMax,
        skills,
        // Không bao giờ gửi `true` khi KYC chưa duyệt: server chặn (403) và
        // trạng thái "đang nhận việc" chỉ có nghĩa khi hồ sơ đã được xác minh.
        isAvailable: isKycApproved ? isAvailable : false,
      };

      const updated = await apiClient.staffMarketplace.upsertMe(payload);
      applyProfile(updated);
      setMessage("Đã lưu hồ sơ thợ.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được hồ sơ thợ.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAvailability = async () => {
    const next = !isAvailable;
    setError(null);
    setMessage(null);
    try {
      const updated = await apiClient.staffMarketplace.updateAvailability(next);
      applyProfile(updated);
      setMessage(next ? "Đang sẵn sàng nhận việc." : "Đã tạm tắt nhận việc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được trạng thái nhận việc.");
    }
  };

  const inputClass =
    "mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] text-[#203c37] outline-none focus:border-[#15594f]";

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
        <Loader2 className="size-4 animate-spin" />
        Đang tải hồ sơ thợ...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Nhà cung cấp dịch vụ độc lập</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Hồ sơ &amp; kỹ năng</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Hồ sơ này hiển thị cho chủ trọ khi họ tìm thợ theo kỹ năng và khoảng cách.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleAvailability}
          disabled={!profile || (!isAvailable && !isKycApproved)}
          title={
            !isKycApproved && !isAvailable
              ? "Cần được duyệt xác minh CCCD (KYC) trước khi bật nhận việc."
              : undefined
          }
          className={`self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-[13px] font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            isAvailable
              ? "bg-[#15594f] text-white hover:bg-[#124b42]"
              : "bg-white text-[#74817b] border border-[#e2e7e1] hover:text-[#203c37]"
          }`}
        >
          {isAvailable ? "Đang nhận việc" : "Tạm tắt nhận việc"}
        </button>
      </div>

      {/* Trạng thái KYC đọc từ bảng dùng chung với chủ trọ (`kyc_submissions`). */}
      <div
        className={`rounded-[10px] border p-4 text-[13px] flex items-start gap-2.5 ${
          isKycApproved
            ? "border-[#cfe0d8] bg-[#eaf2ed] text-[#15594f]"
            : kycStatus === "REJECTED"
              ? "border-[#fecaca] bg-[#fee2e2] text-[#991b1b]"
              : "border-[#fbf1dc] bg-[#fdf8ec] text-[#9a6a12]"
        }`}
      >
        {isKycApproved ? (
          <BadgeCheck className="size-4 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1">
          <p className="font-semibold">Xác minh danh tính (KYC): {translateKycState(kycStatus)}</p>
          <p>
            {isKycApproved
              ? "Hồ sơ của bạn đã được duyệt — bạn có thể bật \"đang nhận việc\" và xuất hiện trong danh sách thợ."
              : "Bạn vẫn cập nhật được hồ sơ, kỹ năng và giá dịch vụ, nhưng phải được duyệt CCCD trước khi bật nhận việc."}
          </p>
          <Link href="/staff/kyc" className="inline-block font-semibold hover:underline">
            {isKycApproved ? "Xem hồ sơ KYC →" : "Nộp / cập nhật hồ sơ KYC →"}
          </Link>
        </div>
      </div>

      {!profile && (
        <div className="rounded-[10px] border border-[#fbf1dc] bg-[#fdf8ec] p-4 text-[13px] text-[#9a6a12]">
          Bạn chưa hoàn thiện hồ sơ thợ. Điền thông tin bên dưới và bấm lưu — bạn có thể
          nhận việc sau khi hồ sơ CCCD được duyệt.
        </div>
      )}

      {error && (
        <div className="rounded-[10px] border border-[#fecaca] bg-[#fee2e2] p-4 text-[13px] text-[#991b1b] flex items-start gap-2.5">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="rounded-[10px] border border-[#cfe0d8] bg-[#eaf2ed] p-4 text-[13px] text-[#15594f] flex items-center gap-2.5">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Kỹ năng / nhóm dịch vụ</h2>
          <p className="text-[12px] text-[#74817b]">
            Chọn các nhóm việc bạn nhận làm. Chủ trọ chỉ tìm thấy bạn qua những nhóm này.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {SERVICE_CATEGORY_OPTIONS.map((category) => (
              <label
                key={category}
                className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[12px] cursor-pointer transition-colors ${
                  skills.includes(category)
                    ? "border-[#15594f] bg-[#eaf2ed] text-[#15594f] font-semibold"
                    : "border-[#e2e7e1] text-[#203c37] hover:bg-[#f7f6f2]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={skills.includes(category)}
                  onChange={() => toggleSkill(category)}
                  className="accent-[#15594f]"
                />
                {translateServiceCategory(category)}
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-[15px] font-semibold text-[#203c37]">Mô tả &amp; kinh nghiệm</h2>
          <label className="block text-[13px] font-semibold text-[#203c37]">
            Giới thiệu (tối thiểu 20 ký tự)
            <textarea
              value={form.description}
              onChange={updateField("description")}
              rows={5}
              placeholder="Ví dụ: 5 năm sửa điện nước cho nhà trọ, nhận việc trong ngày..."
              className={inputClass}
            />
          </label>
        </section>

        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-[15px] font-semibold text-[#203c37] flex items-center gap-2">
            <MapPin className="size-4 text-[#15594f]" />
            Khu vực hành nghề
          </h2>
          <label className="block text-[13px] font-semibold text-[#203c37]">
            Địa chỉ / khu vực làm việc
            <input
              type="text"
              value={form.serviceAddress}
              onChange={updateField("serviceAddress")}
              placeholder="Ví dụ: Quận 7, TP.HCM"
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Vĩ độ (latitude)
              <input
                type="text"
                inputMode="decimal"
                value={form.latitude}
                onChange={updateField("latitude")}
                placeholder="10.762622"
                className={inputClass}
              />
            </label>
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Kinh độ (longitude)
              <input
                type="text"
                inputMode="decimal"
                value={form.longitude}
                onChange={updateField("longitude")}
                placeholder="106.660172"
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[12px] text-[#74817b]">
            Toạ độ dùng để tính khoảng cách tới bất động sản của chủ trọ và không hiển thị công
            khai. Bỏ trống cả hai ô nếu bạn chưa muốn khai báo vị trí.
          </p>
        </section>

        <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-[15px] font-semibold text-[#203c37] flex items-center gap-2">
            <Wallet className="size-4 text-[#15594f]" />
            Khoảng giá mong muốn (VNĐ)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Từ
              <input
                type="text"
                inputMode="decimal"
                value={form.priceMin}
                onChange={updateField("priceMin")}
                placeholder="150000"
                className={inputClass}
              />
            </label>
            <label className="block text-[13px] font-semibold text-[#203c37]">
              Đến
              <input
                type="text"
                inputMode="decimal"
                value={form.priceMax}
                onChange={updateField("priceMax")}
                placeholder="500000"
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[12px] text-[#74817b]">Bỏ trống cả hai ô nếu muốn ghi &quot;thương lượng&quot;.</p>
        </section>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </div>
      </form>
    </div>
  );
}
