"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Building2, MapPin, DoorOpen, Edit, Trash2, Search, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Property } from "@/types/models";

export default function LandlordPropertiesPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const loadProperties = React.useCallback(() => {
    apiClient.properties
      .getMyProperties()
      .then((data) => setProperties(data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách cơ sở"))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const filtered = properties.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Bất động sản & Cơ sở</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý danh sách các tòa nhà, dãy nhà trọ của bạn.</p>
        </div>
        <Link
          href="/landlord/properties/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start"
        >
          <Plus className="size-4" />
          <span>Thêm cơ sở mới</span>
        </Link>
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên cơ sở hoặc địa chỉ..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>

      {/* Properties Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-[220px] rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Building2 className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có cơ sở nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1 max-w-md mx-auto">
            Bắt đầu bằng cách thêm cơ sở hoặc dãy trọ đầu tiên của bạn để quản lý các phòng và hợp đồng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((property) => (
            <div
              key={property.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs hover:border-[#15594f]/50 transition-all flex flex-col justify-between"
            >
              <img
                src="/images/default-property.svg"
                alt="Ảnh cơ sở mặc định"
                className="mb-4 h-32 w-full rounded-[8px] object-cover"
              />
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="size-10 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center shrink-0">
                    <Building2 className="size-5" />
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                    Hoạt động
                  </span>
                </div>
                <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">{property.name}</h3>
                <p className="text-[13px] text-[#74817b] flex items-center gap-1.5 mt-1">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{property.address}</span>
                </p>
                {property.description && (
                  <p className="text-[12px] text-[#74817b] mt-2 line-clamp-2">{property.description}</p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-[#e2e7e1] flex items-center justify-between">
                <Link
                  href={`/landlord/rooms?propertyId=${property.id}`}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#15594f] hover:underline"
                >
                  <DoorOpen className="size-3.5" />
                  <span>Xem danh sách phòng</span>
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    className="p-1.5 text-[#74817b] hover:text-[#203c37] hover:bg-[#f7f6f2] rounded-[6px]"
                    title="Chỉnh sửa"
                  >
                    <Edit className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
