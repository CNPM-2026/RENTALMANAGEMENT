"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, DoorOpen, Search, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Amenity, Property, Room, RoomStatus } from "@/types/models";
import { RoomFormMode, RoomFormModal } from "@/components/landlord/room-form-modal";

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
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [formMode, setFormMode] = React.useState<RoomFormMode>("create");
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [verifiedOccupants, setVerifiedOccupants] = React.useState<number | null>(null);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [createError, setCreateError] = React.useState("");

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
  const openCreate = () => {
    setFormMode("create");
    setEditingRoom(null);
    setVerifiedOccupants(null);
    setCreateError("");
    setIsFormOpen(true);
  };

  const openEdit = async (room: Room) => {
    setFormMode("edit");
    setEditingRoom(room);
    setVerifiedOccupants(null);
    setCreateError("");
    setIsFormOpen(true);
    // Chỉ để hiển thị cảnh báo sức chứa; server vẫn là chốt chặn cuối cùng.
    try {
      const data = await apiClient.occupancyDeclarations.getByRoom(room.id);
      const current = data?.current;
      setVerifiedOccupants(current && current.status === "VERIFIED" ? current.occupants : null);
    } catch {
      setVerifiedOccupants(null);
    }
  };

  const handleSaved = (saved: Room, mode: RoomFormMode) => {
    setRooms((prev) =>
      Array.from(new Map([...prev, saved].map((room) => [room.id, room])).values()).sort((a, b) =>
        a.roomNumber.localeCompare(b.roomNumber, "vi", { numeric: true }),
      ),
    );
    if (mode === "create") setCreateError("");
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
          onClick={openCreate}
          disabled={!selectedPropertyId}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" />
          <span>Thêm phòng mới</span>
        </button>
      </div>

      {createError && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {createError}
        </p>
      )}
      <RoomFormModal
        // Remount khi mở/đổi phòng: state form được khởi tạo từ props, không cần
        // đồng bộ bằng effect (tránh setState trong effect và dữ liệu cũ sót lại).
        key={`${formMode}-${editingRoom?.id ?? "new"}-${isFormOpen ? "open" : "closed"}`}
        isOpen={isFormOpen}
        mode={formMode}
        propertyId={selectedPropertyId}
        room={editingRoom}
        amenities={amenities}
        verifiedOccupants={verifiedOccupants}
        onClose={() => setIsFormOpen(false)}
        onSaved={handleSaved}
      />


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
                  {/* Giá điện/nước là đầu vào của hoá đơn — hiện ngay trên thẻ để phát hiện phòng chưa cấu hình. */}
                  <p className="text-[11px] text-[#74817b] mt-1.5">
                    Điện:{" "}
                    {room.electricityRate === null || room.electricityRate === undefined
                      ? <span className="text-[#a4422c] font-medium">chưa đặt</span>
                      : `${formatCurrency(room.electricityRate)}/kWh`}
                    {" · "}
                    Nước:{" "}
                    {room.waterRate === null || room.waterRate === undefined
                      ? <span className="text-[#a4422c] font-medium">chưa đặt</span>
                      : `${formatCurrency(room.waterRate)}/m³`}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#e2e7e1] flex items-center justify-between text-[12px]">
                  <span className="text-[#74817b]">Cọc: {formatCurrency(room.depositAmount ?? room.priceMonthly)}</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => void openEdit(room)} className="font-semibold text-[#15594f] hover:underline">Sửa</button>
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
