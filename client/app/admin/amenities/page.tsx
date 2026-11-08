"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Amenity } from "@/types/models";

export default function AdminAmenitiesPage() {
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    void apiClient.admin.getAmenities()
      .then((data) => {
        if (active) setAmenities(data ?? []);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Không thể tải tiện ích.");
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const created = await apiClient.admin.createAmenity({ name });
      setAmenities((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Không thể tạo tiện ích.");
    }
  };

  const handleDelete = async (id: string) => {
    setError("");
    try {
      await apiClient.admin.deleteAmenity(id);
      setAmenities((current) => current.filter((amenity) => amenity.id !== id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa tiện ích.");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Quản trị hệ thống</p>
        <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">Tiện ích phòng</h1>
        <p className="mt-0.5 text-[14px] text-[#74817b]">Tạo danh mục tiện ích để chủ trọ gắn vào phòng.</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2 rounded-[12px] border border-[#e2e7e1] bg-white p-4 shadow-xs">
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ví dụ: Điều hòa"
          className="min-w-0 flex-1 rounded border p-2 text-sm"
        />
        <button type="submit" className="inline-flex items-center gap-1 rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white">
          <Plus className="size-4" /> Thêm
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="divide-y rounded-[12px] border border-[#e2e7e1] bg-white shadow-xs">
        {amenities.map((amenity) => (
          <div key={amenity.id} className="flex items-center justify-between p-4 text-sm text-[#203c37]">
            <span>{amenity.name}</span>
            <button type="button" onClick={() => void handleDelete(amenity.id)} className="text-red-600 hover:text-red-800" aria-label={`Xóa ${amenity.name}`}>
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {amenities.length === 0 && <p className="p-4 text-sm text-[#74817b]">Chưa có tiện ích nào.</p>}
      </div>
    </div>
  );
}
