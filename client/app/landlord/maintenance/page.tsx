"use client";

import * as React from "react";
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, DoorOpen } from "lucide-react";
import { apiClient } from "@/lib/api";

interface MaintenanceItem {
  id: string;
  roomNumber: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
}

export default function LandlordMaintenancePage() {
  const [items, setItems] = React.useState<MaintenanceItem[]>([
    {
      id: "1",
      roomNumber: "201",
      title: "Hỏng vòi nước bồn rửa mặt",
      description: "Nước bị rò rỉ dưới chân vòi, cần thợ qua thay gioăng hoặc thay vòi mới.",
      priority: "MEDIUM",
      status: "IN_PROGRESS",
      createdAt: "2026-11-04T08:30:00Z",
    },
    {
      id: "2",
      roomNumber: "305",
      title: "Điều hòa không mát / thổi gió thường",
      description: "Khách báo điều hòa kêu to và không mát từ tối qua.",
      priority: "HIGH",
      status: "PENDING",
      createdAt: "2026-11-05T02:15:00Z",
    },
    {
      id: "3",
      roomNumber: "102",
      title: "Bóng đèn hành lang bị chập",
      description: "Đã thay bóng đèn LED mới 18W.",
      priority: "LOW",
      status: "COMPLETED",
      createdAt: "2026-11-02T10:00:00Z",
    },
  ]);

  const handleUpdateStatus = (id: string, newStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED") => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
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
          onClick={() => alert("Mở form ghi nhận sự cố mới")}
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
                  Phòng {item.roomNumber}
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
