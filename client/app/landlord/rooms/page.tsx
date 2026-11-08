"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, DoorOpen, Search, Filter, Home, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Amenity, Property, Room, RoomStatus } from "@/types/models";
import { Modal } from "@/components/ui/modal";

const STATUS_CONFIG: Record<RoomStatus, { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  AVAILABLE: { label: "Phòng trống", bg: "bg-[#eaf2ed]", text: "text-[#15594f]", icon: CheckCircle2 },
  RENTED: { label: "Đang thuê", bg: "bg-[#e8f0fb]", text: "text-[#2d5d8c]", icon: Clock },
  MAINTENANCE: { label: "Bảo trì", bg: "bg-[#fbeae6]", text: "text-[#a4422c]", icon: AlertCircle },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordRoomsPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [createError, setCreateError] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    roomNumber: "",
    priceMonthly: "",
    area: "",
    maxOccupants: "1",
    electricityRate: "",
    waterRate: "",
    internetFee: "",
    serviceFee: "",
    parkingFee: "",
    amenityIds: [] as string[],
  });

  React.useEffect(() => {
    apiClient.rooms.getAllAmenities().then((data) => setAmenities(data ?? [])).catch(() => setAmenities([]));
    apiClient.properties
      .getMyProperties()
      .then((props) => {
        setProperties(props ?? []);
        if (props && props.length > 0) {
          setSelectedPropertyId(props[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    if (!selectedPropertyId) return;
    let isCancelled = false;
    apiClient.rooms
      .getByProperty(selectedPropertyId)
      .then((data) => {
        if (!isCancelled) {
          const uniqueRooms = Array.from(new Map((data ?? []).map((room) => [room.id, room])).values());
          setRooms(uniqueRooms);
        }
      })
      .catch(() => {
        if (!isCancelled) setRooms([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedPropertyId]);

  const filteredRooms = rooms.filter((r) => {
    const matchSearch = r.roomNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    return matchSearch && matchStatus;
  }).filter((room, index, list) => list.findIndex((candidate) => candidate.id === room.id) === index);
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPropertyId || isCreating) return;
    setCreateError("");
    setIsCreating(true);
    try {
      const priceMonthly = Number(form.priceMonthly);
      if (!Number.isFinite(priceMonthly) || priceMonthly < 0 || priceMonthly >= 100_000_000) {
        setCreateError("Giá thuê phải nhỏ hơn 100.000.000.");
        return;
      }
      const created = await apiClient.rooms.create({
        propertyId: selectedPropertyId,
        roomNumber: form.roomNumber,
        priceMonthly,
        area: Number(form.area),
        maxOccupants: Number(form.maxOccupants),
        electricityRate: Number(form.electricityRate) || undefined,
        waterRate: Number(form.waterRate) || undefined,
        internetFee: Number(form.internetFee) || undefined,
        serviceFee: Number(form.serviceFee) || undefined,
        parkingFee: Number(form.parkingFee) || undefined,
        amenityIds: form.amenityIds,
      });
      setRooms((prev) => Array.from(new Map([...prev, created].map((room) => [room.id, room])).values()));
      setForm({ roomNumber: "", priceMonthly: "", area: "", maxOccupants: "1", electricityRate: "", waterRate: "", internetFee: "", serviceFee: "", parkingFee: "", amenityIds: [] });
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Không thể tạo phòng.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (room: Room) => {
    if (!window.confirm(`Xóa phòng ${room.roomNumber}? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.rooms.delete(room.id);
      setRooms((current) => current.filter((item) => item.id !== room.id));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Không thể xóa phòng.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Tòa nhà · Tầng · Phòng</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý sơ đồ phòng, trạng thái sử dụng và giá thuê.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Thêm phòng mới</span>
        </button>
      </div>
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Thêm phòng mới">
        <form onSubmit={handleCreate} className="space-y-3">
          <input required placeholder="Số phòng" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <input required type="number" min="0" max="99999999.99" step="0.01" placeholder="Giá thuê/tháng" value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" min="1" placeholder="Diện tích (m²)" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="rounded border p-2 text-sm" />
            <input required type="number" min="1" placeholder="Số người tối đa" value={form.maxOccupants} onChange={(e) => setForm({ ...form, maxOccupants: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0" placeholder="Điện (đ/kWh)" value={form.electricityRate} onChange={(e) => setForm({ ...form, electricityRate: e.target.value })} className="rounded border p-2 text-sm" />
            <input type="number" min="0" placeholder="Nước (đ/m³)" value={form.waterRate} onChange={(e) => setForm({ ...form, waterRate: e.target.value })} className="rounded border p-2 text-sm" />
            <input type="number" min="0" placeholder="Internet/tháng" value={form.internetFee} onChange={(e) => setForm({ ...form, internetFee: e.target.value })} className="rounded border p-2 text-sm" />
            <input type="number" min="0" placeholder="Dịch vụ/tháng" value={form.serviceFee} onChange={(e) => setForm({ ...form, serviceFee: e.target.value })} className="rounded border p-2 text-sm" />
            <input type="number" min="0" placeholder="Gửi xe/tháng" value={form.parkingFee} onChange={(e) => setForm({ ...form, parkingFee: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          {amenities.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tiện ích phòng</legend>
              <div className="grid grid-cols-2 gap-2">
                {amenities.map((amenity) => (
                  <label key={amenity.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.amenityIds.includes(amenity.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        amenityIds: event.target.checked
                          ? [...current.amenityIds, amenity.id]
                          : current.amenityIds.filter((id) => id !== amenity.id),
                      }))}
                    />
                    {amenity.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <button type="submit" disabled={isCreating} className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isCreating ? "Đang tạo..." : "Thêm phòng"}
          </button>
        </form>
      </Modal>

      {/* Property Selector & Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <div className="min-w-[200px]">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="w-full text-[13px] font-medium text-[#203c37] bg-[#f7f6f2] px-3 py-2 rounded-[7px] border border-[#e2e7e1] outline-none cursor-pointer"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-[#f7f6f2] rounded-[7px] border border-[#e2e7e1] min-w-[180px]">
          <Search className="size-3.5 text-[#74817b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo số phòng..."
            className="w-full text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {["ALL", "AVAILABLE", "RENTED", "MAINTENANCE"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-[#15594f] text-white"
                  : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
              }`}
            >
              {st === "ALL" ? "Tất cả" : STATUS_CONFIG[st as RoomStatus]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Room Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-[160px] rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <DoorOpen className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có phòng nào phù hợp</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Chọn cơ sở khác hoặc tạo thêm phòng cho cơ sở này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.AVAILABLE;
            const Icon = cfg.icon;
            return (
              <div
                key={room.id}
                className="rounded-[10px] border border-[#e2e7e1] bg-white p-4 shadow-xs hover:border-[#15594f]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[18px] font-bold text-[#203c37]">Phòng {room.roomNumber}</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                      <Icon className="size-3" />
                      <span>{cfg.label}</span>
                    </span>
                  </div>
                  <p className="text-[12px] text-[#74817b] mt-1">
                    Diện tích: {room.area} m² • Tối đa {room.maxOccupants} người
                  </p>
                  <p className="text-[15px] font-semibold text-[#15594f] mt-3">
                    {formatCurrency(room.priceMonthly)} <span className="text-[11px] font-normal text-[#74817b]">/ tháng</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e2e7e1] flex items-center justify-between text-[12px]">
                  <span className="text-[#74817b]">Cọc: {formatCurrency(room.priceMonthly)}</span>
                  <div className="flex items-center gap-3">
                    <Link href={`/rooms/${room.id}`} className="text-[#15594f] font-semibold hover:underline">Chi tiết</Link>
                    <button type="button" onClick={() => void handleDelete(room)} className="font-semibold text-red-600 hover:underline">Xóa</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
