"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  Building2,
  MapPin,
  DoorOpen,
  Edit,
  Search,
  CheckCircle2,
  X,
  ShieldCheck,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Property, Amenity } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function LandlordPropertiesPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [formSubmitting, setFormSubmitting] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [province, setProvince] = React.useState("TP. Hồ Chí Minh");
  const [district, setDistrict] = React.useState("Bình Thạnh");
  const [ward, setWard] = React.useState("Phường 25");
  const [description, setDescription] = React.useState("");
  const [rules, setRules] = React.useState("");
  const [selectedAmenityIds, setSelectedAmenityIds] = React.useState<string[]>([]);

  const loadProperties = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [propsData, amenitiesData] = await Promise.all([
        apiClient.properties.getMyProperties(),
        apiClient.rooms.getAllAmenities().catch(() => []),
      ]);
      setProperties(propsData ?? []);
      setAmenities(amenitiesData ?? []);
    } catch (err: any) {
      setError(err?.message || "Không tải được danh sách cơ sở");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  function handleOpenCreateModal() {
    setEditingProperty(null);
    setName("");
    setAddress("");
    setProvince("TP. Hồ Chí Minh");
    setDistrict("Bình Thạnh");
    setWard("Phường 25");
    setDescription("");
    setRules("Giờ giấc tự do, không làm ồn sau 23h, giữ gìn vệ sinh chung.");
    setSelectedAmenityIds([]);
    setModalError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(prop: Property) {
    setEditingProperty(prop);
    setName(prop.name);
    setAddress(prop.address);
    setProvince(prop.province || "TP. Hồ Chí Minh");
    setDistrict(prop.district || "Bình Thạnh");
    setWard(prop.ward || "Phường 25");
    setDescription(prop.description || "");
    setRules(prop.rules || "");
    const currentAmenityIds = (prop.propertyAmenities || []).map((pa) => pa.amenityId);
    setSelectedAmenityIds(currentAmenityIds);
    setModalError(null);
    setIsModalOpen(true);
  }

  function toggleAmenity(id: string) {
    setSelectedAmenityIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setModalError("Vui lòng điền tên tòa nhà và địa chỉ chi tiết.");
      return;
    }

    setFormSubmitting(true);
    setModalError(null);

    const payload = {
      name: name.trim(),
      address: address.trim(),
      province: province.trim(),
      district: district.trim(),
      ward: ward.trim(),
      description: description.trim() || undefined,
      rules: rules.trim() || undefined,
      amenityIds: selectedAmenityIds,
    };

    try {
      if (editingProperty) {
        await apiClient.properties.update(editingProperty.id, payload);
      } else {
        await apiClient.properties.create(payload);
      }
      setIsModalOpen(false);
      await loadProperties();
    } catch (err: any) {
      setModalError(err?.data?.message || err?.message || "Đã có lỗi xảy ra khi lưu cơ sở.");
    } finally {
      setFormSubmitting(false);
    }
  }

  const filtered = properties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian & Tòa nhà</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Bất động sản & Cơ sở</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Quản lý danh sách các tòa nhà, dãy nhà trọ và cấu hình tiện ích chung.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenCreateModal}
          className="self-start shadow-sm"
          leftIcon={<Plus className="size-4" />}
        >
          Thêm cơ sở mới
        </Button>
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
            Bắt đầu bằng cách thêm cơ sở hoặc tòa nhà đầu tiên của bạn để thiết lập tiện ích chung và các phòng cho thuê.
          </p>
          <Button
            variant="outline"
            onClick={handleOpenCreateModal}
            className="mt-4"
            leftIcon={<Plus className="size-4" />}
          >
            Thêm cơ sở ngay
          </Button>
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
                      Hoạt động
                    </span>
                  </div>

                  <h3 className="text-[16px] font-bold text-[#203c37] mt-3">{property.name}</h3>
                  <p className="text-[13px] text-[#74817b] flex items-center gap-1.5 mt-1">
                    <MapPin className="size-3.5 shrink-0 text-[#15594f]" />
                    <span className="truncate">{property.address}</span>
                  </p>

                  {property.description && (
                    <p className="text-[12px] text-[#74817b] mt-2 line-clamp-2 leading-relaxed">
                      {property.description}
                    </p>
                  )}

                  {/* Common Building Amenities Section */}
                  <div className="mt-4 pt-3 border-t border-[#e2e7e1]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="size-3.5 text-[#0284c7]" />
                      <span className="text-[11px] font-bold text-[#0284c7] uppercase tracking-wider">
                        Tiện ích chung ({propAmenities.length})
                      </span>
                    </div>

                    {propAmenities.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {propAmenities.slice(0, 4).map((pa) => (
                          <span
                            key={pa.amenityId}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[4px] bg-[#f0f9ff] text-[#0369a1] border border-[#bae6fd]"
                          >
                            <CheckCircle2 className="size-3 text-[#0284c7]" />
                            {pa.amenity?.name || "Tiện ích"}
                          </span>
                        ))}
                        {propAmenities.length > 4 && (
                          <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] text-[#64748b]">
                            +{propAmenities.length - 4} khác
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#94a3b8] italic">
                        Chưa thiết lập tiện ích tòa nhà.
                      </p>
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
                      onClick={() => handleOpenEditModal(property)}
                      className="p-1.5 text-[#74817b] hover:text-[#15594f] hover:bg-[#eaf2ed] rounded-[6px] transition-colors"
                      title="Chỉnh sửa & cấu hình tiện ích"
                    >
                      <Edit className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =======================================================================
          MODAL: THÊM / CHỈNH SỬA CƠ SỞ & TIỆN ÍCH CHUNG TÒA NHÀ
      ======================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-[680px] rounded-[16px] shadow-2xl border border-[#e2e7e1] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#e2e7e1] flex items-center justify-between bg-[#fbfbfa]">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center">
                  <Building2 className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-[#203c37]">
                    {editingProperty ? "Chỉnh sửa cơ sở & Tiện ích chung" : "Thêm cơ sở / Tòa nhà mới"}
                  </h3>
                  <p className="text-[12px] text-[#74817b]">
                    Cấu hình thông tin tòa nhà và các tiện ích dùng chung cho khách thuê
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-[6px] text-[#74817b] hover:text-[#203c37] hover:bg-[#e2e7e1]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {modalError && (
                <div className="p-3.5 rounded-[8px] bg-[#fee2e2] border border-[#fca5a5] flex items-center gap-2 text-[#991b1b] text-[13px]">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* 1. Basic Info */}
              <div className="space-y-4">
                <Input
                  label="Tên tòa nhà / Dãy trọ *"
                  placeholder="VD: Căn hộ Ban Mai - Cơ sở 2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Input
                  label="Địa chỉ chi tiết *"
                  placeholder="VD: 142 Điện Biên Phủ"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Tỉnh / Thành phố *"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    required
                  />
                  <Input
                    label="Quận / Huyện *"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                  />
                  <Input
                    label="Phường / Xã *"
                    value={ward}
                    onChange={(e) => setWard(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* 2. Tiện ích chung của tòa nhà (Multi-select) */}
              <div className="pt-3 border-t border-[#e2e7e1] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-[#0284c7]" />
                    <label className="text-[14px] font-bold text-[#203c37]">
                      Tiện ích chung của tòa nhà
                    </label>
                  </div>
                  <span className="text-[12px] text-[#0284c7] font-semibold">
                    Đã chọn: {selectedAmenityIds.length}
                  </span>
                </div>
                <p className="text-[12px] text-[#74817b]">
                  Chọn các tiện ích dùng chung trong khuôn viên tòa nhà để hiển thị trên tin đăng và thông tin phòng:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {amenities.map((item) => {
                    const isChecked = selectedAmenityIds.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAmenity(item.id)}
                        className={`p-2.5 rounded-[8px] border text-left text-[12px] font-medium transition-all flex items-center gap-2 cursor-pointer ${
                          isChecked
                            ? "bg-[#f0f9ff] border-[#0284c7] text-[#0369a1] shadow-xs"
                            : "bg-[#fbfbfa] border-[#e2e7e1] text-[#203c37] hover:border-[#15594f]/40"
                        }`}
                      >
                        <div
                          className={`size-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                            isChecked
                              ? "bg-[#0284c7] border-[#0284c7] text-white"
                              : "border-[#94a3b8] bg-white"
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="size-3" />}
                        </div>
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Description & Rules */}
              <div className="pt-3 border-t border-[#e2e7e1] space-y-4">
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Mô tả tổng quan về tòa nhà
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="VD: Tòa nhà 5 tầng mới xây, thang máy tốc độ cao, camera an ninh 24/7..."
                    className="w-full p-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] placeholder:text-[#94a3b8] outline-none focus:border-[#15594f]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Nội quy chung của cơ sở
                  </label>
                  <textarea
                    rows={2}
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                    placeholder="VD: Giờ giấc tự do, khóa cổng cẩn thận, không làm ồn sau 23h..."
                    className="w-full p-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] placeholder:text-[#94a3b8] outline-none focus:border-[#15594f]"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#e2e7e1] flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={formSubmitting}
                  className="font-bold shadow-xs"
                >
                  {editingProperty ? "Lưu thay đổi" : "Tạo cơ sở mới"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
