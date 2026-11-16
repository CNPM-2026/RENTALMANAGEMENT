"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Sparkles, Check } from "lucide-react";
import { apiClient } from "@/lib/api";
import { CreatePropertyPayload, Amenity } from "@/types/models";
import { AddressFields } from "@/components/address/address-fields";

const initialForm: CreatePropertyPayload = {
  name: "",
  address: "",
  province: "",
  district: "",
  ward: "",
  description: "",
  rules: "",
};

export default function NewLandlordPropertyPage() {
  const router = useRouter();
  const [form, setForm] = React.useState(initialForm);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    apiClient.rooms
      .getAllAmenities()
      .then((data) => setAmenities(data ?? []))
      .catch(() => setAmenities([]));
  }, []);

  const toggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const updateField = (field: keyof CreatePropertyPayload, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await apiClient.properties.create({
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        province: form.province.trim(),
        district: form.district.trim(),
        ward: form.ward.trim(),
        description: form.description?.trim() || undefined,
        rules: form.rules?.trim() || undefined,
        amenityIds: selectedAmenityIds,
      });
      router.push("/landlord/properties");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo cơ sở mới.");
      setIsSaving(false);
    }
  };

  const inputClassName =
    "w-full min-h-[46px] rounded-[8px] border border-[#e2e7e1] bg-white px-3.5 py-2.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f]";

  return (
    <div className="max-w-[900px] space-y-6">
      <div>
        <Link
          href="/landlord/properties"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#74817b] hover:text-[#15594f]"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách cơ sở
        </Link>
        <h1 className="mt-4 text-[26px] font-semibold text-[#203c37]">Thêm cơ sở mới</h1>
        <p className="mt-1 text-[14px] text-[#74817b]">
          Nhập thông tin tòa nhà hoặc dãy trọ để bắt đầu quản lý phòng.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-sm">
        {error && (
          <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#203c37]">Tên cơ sở *</span>
            <input
              required
              minLength={2}
              maxLength={150}
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Ví dụ: Nhà trọ Bình Thạnh"
              className={inputClassName}
            />
          </label>

          <AddressFields value={form} onChange={(address) => setForm((current) => ({ ...current, ...address }))} required />

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#203c37]">Mô tả</span>
            <textarea
              rows={4}
              maxLength={5000}
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Mô tả tiện ích, vị trí hoặc điểm nổi bật của cơ sở..."
              className={`${inputClassName} resize-y`}
            />
          </label>

          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#203c37]">Nội quy</span>
            <textarea
              rows={4}
              maxLength={5000}
              value={form.rules}
              onChange={(event) => updateField("rules", event.target.value)}
              placeholder="Ví dụ: giờ giấc, quy định vật nuôi, hút thuốc..."
              className={`${inputClassName} resize-y`}
            />
          </label>

          {/* Tiện ích chung của tòa nhà */}
          <div className="space-y-2 sm:col-span-2 pt-2 border-t border-[#e2e7e1]">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#15594f]" />
              <span className="text-[14px] font-semibold text-[#203c37]">Tiện ích chung của tòa nhà / khu trọ</span>
            </div>
            <p className="text-[12px] text-[#74817b]">
              Chọn các tiện ích dùng chung trong tòa nhà mà khách thuê phòng sẽ được hưởng.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
              {amenities.map((amenity) => {
                const isSelected = selectedAmenityIds.includes(amenity.id);
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-[8px] border text-left text-[13px] transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#15594f] bg-[#eaf2ed] text-[#15594f] font-semibold shadow-xs"
                        : "border-[#e2e7e1] bg-white text-[#203c37] hover:border-[#15594f]/50 hover:bg-[#f7f6f2]"
                    }`}
                  >
                    <div
                      className={`size-4 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? "bg-[#15594f] border-[#15594f] text-white" : "border-[#74817b]/40 bg-white"
                      }`}
                    >
                      {isSelected && <Check className="size-3" />}
                    </div>
                    <span className="truncate">{amenity.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#e2e7e1] pt-5">
          <Link
            href="/landlord/properties"
            className="inline-flex h-[44px] items-center rounded-[8px] border border-[#e2e7e1] px-5 text-[13px] font-semibold text-[#203c37] hover:bg-[#f7f6f2]"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-[44px] items-center gap-2 rounded-[8px] bg-[#15594f] px-5 text-[13px] font-semibold text-white hover:bg-[#124b42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" />
            {isSaving ? "Đang lưu..." : "Tạo cơ sở"}
          </button>
        </div>
      </form>
    </div>
  );
}
