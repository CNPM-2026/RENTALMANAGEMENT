"use client";

import * as React from "react";
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, DoorOpen } from "lucide-react";
import { apiClient } from "@/lib/api";
import { MaintenanceRequest, Room } from "@/types/models";
import { Modal } from "@/components/ui/modal";

export default function LandlordMaintenancePage() {
  const [items, setItems] = React.useState<MaintenanceRequest[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ roomId: "", title: "", description: "", priority: "MEDIUM" });

  React.useEffect(() => {
    apiClient.maintenance.getMine().then(setItems).catch(() => setItems([]));
    apiClient.properties.getMyProperties()
      .then(async (properties) => {
        const roomLists = await Promise.all((properties ?? []).map((property) => apiClient.rooms.getByProperty(property.id)));
        setRooms(roomLists.flat());
      })
      .catch(() => setRooms([]));
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") => {
    const updated = await apiClient.maintenance.updateStatus(id, newStatus);
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...updated } : item));
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await apiClient.maintenance.create({ ...form, priority: form.priority as "LOW" | "MEDIUM" | "HIGH" });
    setItems((prev) => [created, ...prev]);
    setForm({ roomId: "", title: "", description: "", priority: "MEDIUM" });
    setIsCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Sửa chữa & Bảo trì</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Tiếp nhận sự cố kỹ thuật từ khách thuê và điều phối thợ sửa chữa.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Tạo phiếu bảo trì</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[16px] text-[#203c37]">{item.title}</span>
                <span className="text-[12px] font-semibold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <DoorOpen className="size-3" />
                  Phòng {item.room?.roomNumber ?? "---"}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    item.priority === "HIGH"
                      ? "bg-[#fbeae6] text-[#a4422c]"
                      : item.priority === "MEDIUM"
                      ? "bg-[#fbf1dc] text-[#9a6a12]"
                      : "bg-[#f7f6f2] text-[#74817b]"
                  }`}
                >
                  {item.priority === "HIGH" ? "Khẩn cấp" : item.priority === "MEDIUM" ? "Bình thường" : "Thấp"}
                </span>
              </div>
              <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo phiếu bảo trì">
                <form onSubmit={handleCreate} className="space-y-3">
                  <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="w-full rounded border p-2 text-sm">
                    <option value="">Chọn phòng</option>
                    {rooms.map((room) => <option key={room.id} value={room.id}>Phòng {room.roomNumber}</option>)}
                  </select>
                  <input required placeholder="Tiêu đề" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border p-2 text-sm" />
                  <textarea required placeholder="Mô tả sự cố" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded border p-2 text-sm" />
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded border p-2 text-sm">
                    <option value="LOW">Thấp</option><option value="MEDIUM">Bình thường</option><option value="HIGH">Khẩn cấp</option>
                  </select>
                  <button type="submit" className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white">Tạo phiếu</button>
                </form>
              </Modal>
              <p className="text-[13px] text-[#74817b]">{item.description}</p>
              <p className="text-[11px] text-[#74817b]">
                Ghi nhận lúc: {new Date(item.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {item.status !== "COMPLETED" ? (
                <button
                  onClick={() => handleUpdateStatus(item.id, "COMPLETED")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#15594f] text-white text-[12px] font-medium hover:bg-[#124b42] cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Đã xử lý xong</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] bg-[#eaf2ed] px-3 py-1.5 rounded-[7px]">
                  <CheckCircle2 className="size-3.5" />
                  <span>Hoàn thành</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
