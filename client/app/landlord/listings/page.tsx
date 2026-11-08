"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FileText, Eye, Search, Trash2 } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [images, setImages] = React.useState<File[]>([]);
  const [form, setForm] = React.useState({ title: "", description: "", propertyId: "", roomId: "" });

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
    if (isSubmitting) return;
    if (!form.propertyId || !form.roomId) {
      setError("Vui lòng chọn nhà trọ và phòng cần đăng.");
      return;
    }
    if (form.description.trim().length < 10) {
      setError("Mô tả phải có ít nhất 10 ký tự.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append("title", form.title.trim());
      payload.append("description", form.description.trim());
      payload.append("postType", "RENT_OUT");
      payload.append("propertyId", form.propertyId);
      payload.append("roomId", form.roomId);
      images.forEach((image) => payload.append("images", image));
      const created = await apiClient.posts.create(payload);
      setPosts((prev) => [created, ...prev]);
      setForm({ title: "", description: "", propertyId: "", roomId: "" });
      setImages([]);
      setIsCreateOpen(false);
    } catch (createError) {
      if (createError instanceof ApiError && createError.errors?.length) {
        setError(createError.errors.map((item) => `${item.field}: ${item.message}`).join(" • "));
      } else {
        setError(createError instanceof Error ? createError.message : "Không thể đăng tin.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (post: Post) => {
    if (!window.confirm(`Xóa bài đăng "${post.title}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.posts.delete(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xóa bài đăng.");
    }
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
                        <Link href={`/rooms/${post.id}`} className="hover:text-[#15594f] hover:underline">
                          {post.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#15594f]">
                        {formatCurrency(Number(post.room?.priceMonthly ?? post.price ?? 0))}
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
                          href={`/rooms/${post.id}`}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15594f] hover:underline"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem tin</span>
                        </Link>
                        <button type="button" onClick={() => void handleDelete(post)} className="ml-3 inline-flex items-center gap-1 text-[12px] font-medium text-red-600 hover:underline">
                          <Trash2 className="size-3.5" />
                          <span>Xóa</span>
                        </button>
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
          <textarea
            required
            minLength={10}
            placeholder="Mô tả (ít nhất 10 ký tự)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border p-2 text-sm"
          />
          <div>
            <label className="block text-sm font-medium text-[#203c37] mb-1">Ảnh phòng (tối đa 10 ảnh)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 10))}
              className="w-full rounded border p-2 text-sm"
            />
            <p className="mt-1 text-xs text-[#74817b]">{images.length}/10 ảnh đã chọn</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select required value={form.propertyId} onChange={(e) => setForm({ ...form, propertyId: e.target.value, roomId: "" })} className="rounded border p-2 text-sm">
              <option value="">Chọn cơ sở</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="rounded border p-2 text-sm" disabled={!form.propertyId}>
              <option value="">Chọn phòng</option>
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.roomNumber} · {formatCurrency(room.priceMonthly)}</option>)}
            </select>
          </div>
          <p className="text-xs text-[#74817b]">Giá bài đăng được lấy tự động từ giá phòng đã thiết lập.</p>
          <button type="submit" disabled={isSubmitting} className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? "Đang gửi..." : "Gửi duyệt"}</button>
        </form>
      </Modal>
    </div>
  );
}
