"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Filter, MapPin, Wallet } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { SERVICE_CATEGORY_OPTIONS, translateServiceCategory } from "@/lib/labels";
import type { ServiceCategory, StaffProfile } from "@/types/models";

/**
 * KHÁM PHÁ THỢ (Batch 2) — phía chủ trọ.
 *
 * Khoảng cách do SERVER tính bằng Haversine từ toạ độ chủ trọ gửi lên. Khi thợ
 * chưa khai báo toạ độ, server trả `distanceKm = null` và UI hiển thị "chưa rõ";
 * không có phép suy diễn nào ở client. Danh sách chỉ chứa thợ role STAFF đang
 * hoạt động và đã được duyệt KYC (lọc ở server).
 */
const DEFAULT_FILTERS = {
  search: "",
  category: "" as ServiceCategory | "",
  isAvailable: true,
  latitude: "",
  longitude: "",
  radiusKm: "",
};

function parseOptionalNumber(raw: string, label: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.includes(".") ? trimmed : trimmed.replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`${label} không hợp lệ: "${trimmed}" không phải là số.`);
  return value;
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : null;
}

export default function LandlordStaffMarketplacePage() {
  const [staff, setStaff] = React.useState<StaffProfile[]>([]);
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [applied, setApplied] = React.useState(DEFAULT_FILTERS);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    () =>
      Promise.resolve()
        .then(() => {
          const latitude = parseOptionalNumber(applied.latitude, "Vĩ độ");
          const longitude = parseOptionalNumber(applied.longitude, "Kinh độ");
          if ((latitude === null) !== (longitude === null)) {
            throw new Error("Vui lòng nhập đủ cả vĩ độ và kinh độ, hoặc bỏ trống cả hai.");
          }
          const radiusKm = parseOptionalNumber(applied.radiusKm, "Bán kính");
          return {
            page: 1,
            limit: 50,
            ...(applied.search.trim() ? { search: applied.search.trim() } : {}),
            ...(applied.category ? { category: applied.category as ServiceCategory } : {}),
            ...(applied.isAvailable ? { isAvailable: true } : {}),
            ...(latitude !== null && longitude !== null
              ? {
                  latitude,
                  longitude,
                  sort: "nearest" as const,
                  ...(radiusKm !== null ? { radiusKm } : {}),
                }
              : {}),
          };
        })
        .then((query) => apiClient.staffMarketplace.browse(query))
        .then((result) => {
          setStaff(result.data ?? []);
          setError(null);
        })
        .catch((err: unknown) => {
          setStaff([]);
          setError(err instanceof Error ? err.message : "Không tải được danh sách thợ.");
        }),
    [applied],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Vận hành</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Tìm thợ theo kỹ năng &amp; khoảng cách</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Chỉ thợ đã xác minh CCCD (KYC) và đang hoạt động mới xuất hiện trong danh sách này.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...filters });
        }}
        className="rounded-[12px] border border-[#e2e7e1] bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Tìm theo tên thợ
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="VD: Minh"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Kỹ năng
            <select
              value={filters.category}
              onChange={(event) => setFilters({ ...filters, category: event.target.value as ServiceCategory | "" })}
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            >
              <option value="">Tất cả kỹ năng</option>
              {SERVICE_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {translateServiceCategory(category)}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-6 flex items-center gap-2 text-[12px] font-semibold text-[#203c37]">
            <input
              type="checkbox"
              checked={filters.isAvailable}
              onChange={(event) => setFilters({ ...filters, isAvailable: event.target.checked })}
            />
            Chỉ thợ đang nhận việc
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Vĩ độ cơ sở
            <input
              value={filters.latitude}
              onChange={(event) => setFilters({ ...filters, latitude: event.target.value })}
              placeholder="21.0278"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Kinh độ cơ sở
            <input
              value={filters.longitude}
              onChange={(event) => setFilters({ ...filters, longitude: event.target.value })}
              placeholder="105.8342"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
          <label className="block text-[12px] font-semibold text-[#203c37]">
            Bán kính (km)
            <input
              value={filters.radiusKm}
              onChange={(event) => setFilters({ ...filters, radiusKm: event.target.value })}
              placeholder="10"
              className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm font-normal outline-none focus:border-[#15594f]"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#124b42] cursor-pointer"
          >
            <Filter className="size-4" />
            <span>Tìm thợ</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setApplied(DEFAULT_FILTERS);
            }}
            className="rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-[13px] font-medium text-[#74817b] hover:bg-[#f7f6f2] cursor-pointer"
          >
            Xoá bộ lọc
          </button>
        </div>
        <p className="text-[12px] text-[#74817b]">
          Có toạ độ: server lọc theo bán kính rồi sắp xếp gần → xa. Không có toạ độ: danh sách xếp theo mức độ sẵn sàng.
        </p>
      </form>


      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staff.length === 0 && (
          <p className="md:col-span-3 rounded-[12px] border border-dashed border-[#e2e7e1] bg-white p-6 text-center text-[13px] text-[#74817b]">
            Không tìm thấy thợ phù hợp. Thử nới bán kính hoặc bỏ bộ lọc kỹ năng.
          </p>
        )}

        {staff.map((profile) => {
          const priceMin = formatMoney(profile.priceMin);
          const priceMax = formatMoney(profile.priceMax);
          const skills = profile.skills?.map((skill) => translateServiceCategory(skill.category)) ?? [];
          return (
            <div key={profile.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <Avatar
                    src={profile.user?.avatarUrl}
                    alt={profile.user?.fullName ?? "Thợ"}
                    className="size-10 rounded-full border border-[#e2e7e1] object-cover"
                  />
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      profile.isAvailable ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#f7f6f2] text-[#74817b]"
                    }`}
                  >
                    {profile.isAvailable ? "Đang nhận việc" : "Tạm nghỉ"}
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">
                  <Link href={`/users/${profile.userId}`} className="hover:text-[#15594f] hover:underline">
                    {profile.user?.fullName ?? "Thợ"}
                  </Link>
                </h3>
                <p className="text-[12px] font-medium text-[#15594f]">{skills.length ? skills.join(" · ") : "Chưa khai báo kỹ năng"}</p>

                {profile.description ? (
                  <p className="mt-2 text-[12px] text-[#74817b] line-clamp-3">{profile.description}</p>
                ) : null}

                <div className="mt-3 space-y-1 text-[12px] text-[#74817b]">
                  <p className="flex items-center gap-2">
                    <MapPin className="size-3.5 text-[#203c37]" />
                    <span>{profile.serviceAddress ?? "Chưa khai báo khu vực"}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <BadgeCheck className="size-3.5 text-[#15594f]" />
                    <span>Đã xác minh CCCD</span>
                  </p>
                  {priceMin || priceMax ? (
                    <p className="flex items-center gap-2">
                      <Wallet className="size-3.5 text-[#203c37]" />
                      <span>
                        {priceMin ?? "…"} – {priceMax ?? "…"}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e2e7e1] text-[12px] font-semibold">
                {profile.distanceKm === null || profile.distanceKm === undefined ? (
                  <span className="text-[#74817b]">Khoảng cách: chưa xác định</span>
                ) : (
                  <span className="text-[#15594f]">Cách bạn khoảng {profile.distanceKm} km</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
