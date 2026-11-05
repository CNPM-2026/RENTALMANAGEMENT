"use client";

import * as React from "react";
import { Zap, Droplets, Plus, Search, Calendar } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Property, Room } from "@/types/models";

export default function LandlordUtilitiesPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
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
        if (!isCancelled) setRooms(data ?? []);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Điện nước & Dịch vụ</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Nhập và chốt chỉ số công tơ điện, đồng hồ nước hàng tháng.</p>
        </div>
        <button
          onClick={() => alert("Mở form ghi chỉ số nhanh")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Chốt số đồng hồ tháng này</span>
        </button>
      </div>

      <div className="bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="w-full sm:w-[260px] text-[13px] font-medium text-[#203c37] bg-[#f7f6f2] px-3 py-2 rounded-[7px] border border-[#e2e7e1] outline-none cursor-pointer"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Zap className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có phòng nào để ghi chỉ số</h3>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                <th className="py-3 px-4">Số phòng</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Chỉ số Điện (kWh)</th>
                <th className="py-3 px-4">Chỉ số Nước (m³)</th>
                <th className="py-3 px-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold">Phòng {room.roomNumber}</td>
                  <td className="py-3.5 px-4">
                    <span className="text-[12px] text-[#74817b]">{room.status === "RENTED" ? "Đang ở" : "Trống"}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <input
                      type="number"
                      placeholder="Số điện mới"
                      className="w-28 px-2 py-1 text-[13px] border border-[#e2e7e1] rounded-[6px] bg-[#f7f6f2] outline-none"
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <input
                      type="number"
                      placeholder="Số nước mới"
                      className="w-28 px-2 py-1 text-[13px] border border-[#e2e7e1] rounded-[6px] bg-[#f7f6f2] outline-none"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => alert(`Lưu chỉ số phòng ${room.roomNumber} thành công`)}
                      className="px-3 py-1 rounded-[6px] bg-[#15594f] text-white text-[12px] font-medium hover:bg-[#124b42] cursor-pointer"
                    >
                      Lưu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
