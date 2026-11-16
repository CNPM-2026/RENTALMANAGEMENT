"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Building2, MapPin, DoorOpen, Edit, Search, Sparkles, Check, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Property, Amenity } from "@/types/models";
import { Modal } from "@/components/ui/modal";
import { AddressFields } from "@/components/address/address-fields";

export default function LandlordPropertiesPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Edit Modal State
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [editForm, setEditForm] = React.useState({
    name: "",
    address: "",
    province: "",
    district: "",
    ward: "",
    description: "",
    rules: "",
  });
  const [selectedAmenityIds, setSelectedAmenityIds] = React.useState<string[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const loadProperties = React.useCallback(() => {
    apiClient.properties
      .getMyProperties()
      .then((data) => setProperties(data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách cơ sở"))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadProperties();
    apiClient.rooms.getAllAmenities().then((data) => setAmenities(data ?? [])).catch(() => setAmenities([]));
  }, [loadProperties]);

  const openEditModal = (property: Property) => {
    setEditingProperty(property);
    setEditForm({
      name: property.name,
      address: property.address,
      province: property.province,
      district: property.district,
      ward: property.ward,
      description: property.description || "",
      rules: property.rules || "",
    });
    setSelectedAmenityIds(property.propertyAmenities?.map((pa) => pa.amenityId) || []);
    setSaveError(null);
  };

  const toggleAmenity = (id: string) => {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProperty) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      await apiClient.properties.update(editingProperty.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        province: editForm.province.trim(),
        district: editForm.district.trim(),
        ward: editForm.ward.trim(),
        description: editForm.description.trim() || undefined,
        rules: editForm.rules.trim() || undefined,
        amenityIds: selectedAmenityIds,
      });
      setEditingProperty(null);
      loadProperties();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Không thể cập nhật cơ sở.");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Bất động sản & Cơ sở</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý danh sách các tòa nhà, dãy nhà trọ và tiện ích chung.</p>
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
            <div key={n} className="h-[260px] rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
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
          {filtered.map((property) => {
            const propAmenities = property.propertyAmenities || [];
            return (
              <div
                key={property.id}
                className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs hover:border-[#15594f]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="size-10 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center shrink-0">
                      <Building2 className="size-5" />
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                      {property._count?.rooms ?? 0} phòng
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

                  {/* Building Amenities badges */}
                  <div className="mt-3.5 pt-3 border-t border-[#f0f4f1]">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#15594f] uppercase tracking-wider mb-2">
                      <Sparkles className="size-3.5" />
                      <span>Tiện ích chung ({propAmenities.length})</span>
                    </div>
                    {propAmenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {propAmenities.slice(0, 5).map((pa) => (
                          <span
                            key={pa.amenityId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f7f6f2] border border-[#e2e7e1] text-[11px] text-[#203c37]"
                          >
                            <Check className="size-3 text-[#15594f]" />
                            {pa.amenity?.name}
                          </span>
                        ))}
                        {propAmenities.length > 5 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#f7f6f2] text-[11px] text-[#74817b]">
                            +{propAmenities.length - 5}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#74817b] italic">Chưa cấu hình tiện ích chung</p>
                    )}
                  </div>
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
                      onClick={() => openEditModal(property)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-[#15594f] hover:bg-[#eaf2ed] rounded-[6px] transition-colors cursor-pointer"
                      title="Chỉnh sửa tiện ích & thông tin"
                    >
                      <Edit className="size-3.5" />
                      <span>Sửa</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Property & Common Amenities Modal */}
      <Modal
        isOpen={Boolean(editingProperty)}
        onClose={() => setEditingProperty(null)}
        title="Chỉnh sửa cơ sở & Tiện ích chung"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          {saveError && (
            <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-3.5 py-2.5 text-xs text-[#a4422c]">
              {saveError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#203c37] mb-1">Tên cơ sở *</label>
            <input
              required
              minLength={2}
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full rounded-lg border border-[#e2e7e1] px-3 py-2 text-xs outline-none focus:border-[#15594f]"
            />
          </div>

          <AddressFields
            value={editForm}
            onChange={(address) => setEditForm((current) => ({ ...current, ...address }))}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-[#203c37] mb-1">Mô tả</label>
            <textarea
              rows={2}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full rounded-lg border border-[#e2e7e1] px-3 py-2 text-xs outline-none focus:border-[#15594f]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#203c37] mb-1">Nội quy</label>
            <textarea
              rows={2}
              value={editForm.rules}
              onChange={(e) => setEditForm({ ...editForm, rules: e.target.value })}
              className="w-full rounded-lg border border-[#e2e7e1] px-3 py-2 text-xs outline-none focus:border-[#15594f]"
            />
          </div>

          {/* Building Amenities Multi-Select Grid */}
          <div className="pt-2 border-t border-[#e2e7e1]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="size-4 text-[#15594f]" />
              <label className="text-xs font-semibold text-[#203c37]">
                Tiện ích chung của tòa nhà ({selectedAmenityIds.length} đã chọn)
              </label>
            </div>
            <p className="text-[11px] text-[#74817b] mb-2.5">
              Chọn các tiện ích toàn khu (thang máy, bảo vệ, camera, máy giặt chung...) để hiển thị cho người thuê.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {amenities.map((amenity) => {
                const isSelected = selectedAmenityIds.includes(amenity.id);
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "border-[#15594f] bg-[#eaf2ed] text-[#15594f] font-semibold"
                        : "border-[#e2e7e1] bg-white text-[#203c37] hover:border-[#15594f]/40"
                    }`}
                  >
                    <div
                      className={`size-3.5 rounded flex items-center justify-center border transition-colors ${
                        isSelected ? "bg-[#15594f] border-[#15594f] text-white" : "border-[#74817b]/40"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5" />}
                    </div>
                    <span className="truncate">{amenity.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#e2e7e1]">
            <button
              type="button"
              onClick={() => setEditingProperty(null)}
              className="rounded-lg border border-[#e2e7e1] px-4 py-2 text-xs font-semibold text-[#74817b] hover:bg-[#f7f6f2]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[#15594f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}