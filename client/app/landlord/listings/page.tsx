"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileText, Eye, Search } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Post, PostStatus, Property, Room } from "@/types/models";
import { Modal } from "@/components/ui/modal";

const STATUS_MAP: Record<PostStatus, { label: string; bg: string; text: string }> = {
  PENDING: { label: "Chờ duyệt", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
  APPROVED: { label: "Đang hiển thị", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  REJECTED: { label: "Từ chối", bg: "bg-[#fbeae6]", text: "text-[#a4422c]" },
  CLOSED: { label: "Đã đóng", bg: "bg-[#f7f6f2]", text: "text-[#74817b]" },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordListingsPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ title: "", description: "", price: "", propertyId: "", roomId: "" });

  React.useEffect(() => {
    apiClient.posts
      .getMyPosts()
      .then((data) => setPosts(data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được bài đăng."))
      .finally(() => setIsLoading(false));
    apiClient.properties.getMyProperties().then(setProperties).catch(() => setProperties([]));
  }, []);

  React.useEffect(() => {
    if (form.propertyId) {
      apiClient.rooms.getByProperty(form.propertyId).then(setRooms).catch(() => setRooms([]));
    }
  }, [form.propertyId]);

  const availableRooms = rooms.filter((room) => room.propertyId === form.propertyId && room.status === "AVAILABLE");
  const filtered = posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await apiClient.posts.create({
      title: form.title,
      description: form.description,
      price: Number(form.price),
      postType: "RENT_OUT",
      propertyId: form.propertyId,
      roomId: form.roomId,
    });
    setPosts((prev) => [created, ...prev]);
    setForm({ title: "", description: "", price: "", propertyId: "", roomId: "" });
    setIsCreateOpen(false);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Không gian</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Tin đăng cho thuê</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý các bài đăng tìm khách thuê phòng trên nền tảng 5K-Rental Manager.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Đăng tin mới</span>
        </button>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm bài đăng theo tiêu đề..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>
      {error && <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[14px] text-[#a4422c]">{error}</div>}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <FileText className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có bài đăng nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Đăng tin để tiếp cận hàng ngàn người đang tìm phòng trọ.</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                  <th className="py-3 px-4">Tiêu đề bài đăng</th>
                  <th className="py-3 px-4">Giá thuê</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Ngày đăng</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
                {filtered.map((post) => {
                  const st = STATUS_MAP[post.status] || STATUS_MAP.PENDING;
                  return (
                    <tr key={post.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium">
                        <Link href={`/rooms/${post.roomId}`} className="hover:text-[#15594f] hover:underline">
                          {post.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#15594f]">
                        {formatCurrency(post.room?.priceMonthly || 0)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#74817b]">
                        {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/rooms/${post.roomId}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15594f] hover:underline"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem tin</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Đăng tin cho thuê" size="lg">
        <form onSubmit={handleCreate} className="space-y-3">
          <input required placeholder="Tiêu đề" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <textarea required placeholder="Mô tả" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <div className="grid grid-cols-3 gap-3">
            <input required type="number" min="0" placeholder="Giá thuê" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded border p-2 text-sm" />
            <select required value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value, roomId: "" })} className="rounded border p-2 text-sm">
              <option value="">Chọn cơ sở</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="rounded border p-2 text-sm" disabled={!form.propertyId}>
              <option value="">Chọn phòng</option>
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {formatCurrency(room.priceMonthly)}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white">Gửi duyệt</button>
        </form>
      </Modal>
    </div>
  );
}
