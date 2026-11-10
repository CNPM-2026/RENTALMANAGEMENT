"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Eye,
  FileText,
  Home,
  MapPin,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { Post, PostStatus } from "@/types/models";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

const STATUS_CONFIG: Record<
  PostStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Chờ duyệt",
    bg: "bg-[#fbf1dc]",
    text: "text-[#9a6a12]",
    border: "border-[#f4deb4]",
    icon: Clock,
  },
  APPROVED: {
    label: "Đang hiển thị",
    bg: "bg-[#eaf2ed]",
    text: "text-[#15594f]",
    border: "border-[#cce1d5]",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Bị từ chối duyệt",
    bg: "bg-[#fbeae6]",
    text: "text-[#a4422c]",
    border: "border-[#f6cbc1]",
    icon: XCircle,
  },
  CLOSED: {
    label: "Đã đóng",
    bg: "bg-[#f7f6f2]",
    text: "text-[#74817b]",
    border: "border-[#e2e7e1]",
    icon: Clock,
  },
};

function LandlordListingDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [post, setPost] = React.useState<Post | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit modal state
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

  const fetchPost = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.posts.getById(id);
      setPost(data);
      setEditTitle(data.title);
      setEditDescription(data.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được thông tin bài đăng.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (editDescription.trim().length < 10) {
      setEditError("Mô tả bài đăng phải có ít nhất 10 ký tự.");
      return;
    }

    setIsSubmitting(true);
    setEditError(null);
    try {
      const payload = new FormData();
      payload.append("title", editTitle.trim());
      payload.append("description", editDescription.trim());
      const updated = await apiClient.posts.update(post.id, payload);
      setPost(updated);
      setIsEditOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.errors?.length) {
        setEditError(err.errors.map((item) => `${item.field}: ${item.message}`).join(" • "));
      } else {
        setEditError(err instanceof Error ? err.message : "Không thể cập nhật bài đăng.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài đăng "${post.title}"?`)) return;

    try {
      await apiClient.posts.delete(post.id);
      router.push("/landlord/listings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa bài đăng.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        <div className="h-6 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-72 rounded-xl bg-gray-100 animate-pulse" />
          <div className="h-72 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center space-y-4">
        <div className="size-14 rounded-full bg-[#fbeae6] text-[#a4422c] flex items-center justify-center mx-auto">
          <AlertTriangle className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-[#203c37]">Không tìm thấy bài đăng</h2>
        <p className="text-sm text-[#74817b]">{error || "Bài đăng không tồn tại hoặc bạn không có quyền truy cập."}</p>
        <div>
          <Link
            href="/landlord/listings"
            className="inline-flex items-center gap-2 rounded-lg bg-[#15594f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#124b42]"
          >
            <ArrowLeft className="size-4" />
            <span>Quay lại danh sách tin đăng</span>
          </Link>
        </div>
      </div>
    );
  }

  const st = STATUS_CONFIG[post.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = st.icon;
  const images = post.images ?? [];
  const room = post.room;
  const property = post.property;
  const monthlyPrice = Number(room?.priceMonthly ?? post.price ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-xs text-[#74817b]">
          <Link href="/landlord/dashboard" className="hover:text-[#203c37]">
            Vận hành
          </Link>
          <span>/</span>
          <Link href="/landlord/listings" className="hover:text-[#203c37]">
            Tin đăng cho thuê
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#203c37] truncate max-w-[200px]">{post.title}</span>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/landlord/listings"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e7e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#203c37] hover:bg-[#f7f6f2] transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Danh sách tin</span>
          </Link>
          {post.status === "APPROVED" && (
            <Link
              href={`/rooms/${post.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#15594f] bg-[#eaf2ed] px-3.5 py-2 text-xs font-semibold text-[#15594f] hover:bg-[#dfebe3] transition-colors"
            >
              <ExternalLink className="size-3.5" />
              <span>Xem trang công khai</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#15594f] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#124b42] transition-colors"
          >
            <Pencil className="size-3.5" />
            <span>Chỉnh sửa</span>
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="size-3.5" />
            <span>Xóa</span>
          </button>
        </div>
      </div>

      {/* REJECTION / STATUS BANNER */}
      {post.status === "REJECTED" && (
        <div className="rounded-xl border border-[#f6cbc1] bg-[#fbeae6] p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-full bg-[#f6cbc1] text-[#a4422c] flex items-center justify-center shrink-0">
              <XCircle className="size-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#a4422c]">Bài đăng đã bị từ chối duyệt</h3>
                <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-bold text-[#a4422c] border border-[#f6cbc1]">
                  REJECTED
                </span>
              </div>
              <p className="text-sm text-[#7f3221] leading-relaxed">
                Bài đăng này không đáp ứng tiêu chuẩn cộng đồng hoặc thông tin phòng/ảnh chưa đầy đủ, chưa chính xác.
                Vui lòng kiểm tra lại nội dung, bấm <strong className="font-semibold underline cursor-pointer" onClick={() => setIsEditOpen(true)}>Chỉnh sửa</strong> để cập nhật lại bài đăng hoặc liên hệ Quản trị viên để được hỗ trợ.
              </p>
            </div>
          </div>
        </div>
      )}

      {post.status === "PENDING" && (
        <div className="rounded-xl border border-[#f4deb4] bg-[#fbf1dc] p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-full bg-[#f4deb4] text-[#9a6a12] flex items-center justify-center shrink-0">
              <Clock className="size-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-bold text-[#9a6a12]">Bài đăng đang chờ xét duyệt</h3>
              <p className="text-sm text-[#7a540f] leading-relaxed">
                Bài đăng đã được gửi lên hệ thống và đang chờ Quản trị viên kiểm tra nội dung trước khi xuất hiện trên trang tìm phòng công khai.
              </p>
            </div>
          </div>
        </div>
      )}

      {post.status === "APPROVED" && (
        <div className="rounded-xl border border-[#cce1d5] bg-[#eaf2ed] p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="size-10 rounded-full bg-[#cce1d5] text-[#15594f] flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-base font-bold text-[#15594f]">Bài đăng đang hiển thị công khai</h3>
              <p className="text-sm text-[#114941] leading-relaxed">
                Người tìm phòng có thể tìm thấy bài đăng này, đặt lịch xem phòng và gửi yêu cầu thuê trực tuyến.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Images, Title, Description) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Header Card */}
          <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                  <StatusIcon className="size-3.5" />
                  {st.label}
                </span>
                <h1 className="text-2xl font-bold text-[#203c37] leading-tight pt-1">
                  {post.title}
                </h1>
                {property && (
                  <p className="flex items-center gap-1.5 text-sm text-[#74817b]">
                    <MapPin className="size-4 text-[#15594f] shrink-0" />
                    <span>{property.address}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Images Gallery */}
            {images.length > 0 ? (
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-[#203c37]">Hình ảnh phòng ({images.length})</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      onClick={() => setSelectedImage(img.imageUrl)}
                      className="group relative aspect-4/3 overflow-hidden rounded-lg border border-[#e2e7e1] bg-gray-100 cursor-pointer shadow-xs hover:border-[#15594f] transition-all"
                    >
                      <img
                        src={img.imageUrl}
                        alt={`Ảnh ${idx + 1}`}
                        className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {img.isPrimary && (
                        <span className="absolute top-2 left-2 rounded bg-[#15594f] px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          Ảnh chính
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#e2e7e1] p-6 text-center text-sm text-[#74817b]">
                Chưa có ảnh nào được tải lên cho bài đăng này.
              </div>
            )}

            {/* Description */}
            <div className="space-y-2 pt-2 border-t border-[#eef3ef]">
              <h3 className="text-sm font-semibold text-[#203c37]">Mô tả chi tiết</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#4a5854]">
                {post.description}
              </p>
            </div>
          </div>

          {/* Room Amenities Card */}
          {room?.roomAmenities && room.roomAmenities.length > 0 && (
            <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-[#203c37] flex items-center gap-2">
                <Sparkles className="size-4 text-[#15594f]" />
                <span>Tiện ích phòng có sẵn ({room.roomAmenities.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2 pt-1">
                {room.roomAmenities.map((ra, idx) => (
                  <span
                    key={ra.amenityId || idx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e7e1] bg-[#f7f6f2] px-3 py-1.5 text-xs font-medium text-[#203c37]"
                  >
                    <CheckCircle2 className="size-3.5 text-[#15594f]" />
                    <span>{ra.amenity?.name ?? "Tiện ích"}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Property & Room summary, Pricing, Stats) */}
        <div className="space-y-6">
          {/* Price Card */}
          <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-4">
            <div>
              <p className="text-xs text-[#74817b]">Giá thuê niêm yết</p>
              <p className="text-2xl font-bold text-[#15594f] mt-1">
                {formatCurrency(monthlyPrice)}
                <span className="text-xs font-normal text-[#74817b]"> / tháng</span>
              </p>
            </div>

            <div className="divide-y divide-[#eef3ef] border-t border-[#eef3ef] text-xs pt-3 space-y-2.5">
              <div className="flex justify-between pt-2">
                <span className="text-[#74817b]">Loại tin:</span>
                <span className="font-semibold text-[#203c37]">
                  {post.postType === "RENT_OUT" ? "Cho thuê phòng" : post.postType}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[#74817b]">Lượt xem:</span>
                <span className="font-semibold text-[#203c37] flex items-center gap-1">
                  <Eye className="size-3 text-[#15594f]" />
                  {post.viewCount} lượt
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[#74817b]">Ngày đăng:</span>
                <span className="font-medium text-[#203c37]">
                  {formatDate(post.createdAt, "datetime")}
                </span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[#74817b]">Cập nhật:</span>
                <span className="font-medium text-[#203c37]">
                  {formatDate(post.updatedAt, "datetime")}
                </span>
              </div>
            </div>
          </div>

          {/* Property & Room Details */}
          <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-[#203c37] flex items-center gap-2">
              <Building className="size-4 text-[#15594f]" />
              <span>Thông tin phòng & Cơ sở</span>
            </h3>

            <div className="space-y-3 text-xs">
              {property && (
                <div>
                  <p className="text-[#74817b]">Cơ sở / Nhà trọ:</p>
                  <p className="font-semibold text-sm text-[#203c37] mt-0.5">{property.name}</p>
                  <p className="text-[#74817b] mt-0.5">{property.address}</p>
                </div>
              )}

              {room && (
                <div className="pt-2 border-t border-[#eef3ef] space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#74817b]">Số phòng:</span>
                    <span className="font-bold text-[#15594f] text-sm">Phòng {room.roomNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#74817b]">Diện tích:</span>
                    <span className="font-medium text-[#203c37]">{room.area} m²</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#74817b]">Sức chứa tối đa:</span>
                    <span className="font-medium text-[#203c37]">{room.maxOccupants} người</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#74817b]">Trạng thái phòng:</span>
                    <span className="font-semibold text-[#15594f]">{room.status}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Helpful tips if rejected */}
          {post.status === "REJECTED" && (
            <div className="rounded-xl border border-[#e2e7e1] bg-[#f7f6f2] p-5 text-xs text-[#52605b] space-y-2">
              <h4 className="font-semibold text-[#203c37] flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-[#a4422c]" />
                <span>Mẹo duyệt tin thành công</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 leading-relaxed">
                <li>Tiêu đề cần rõ ràng, ghi rõ địa điểm và đặc điểm nổi bật.</li>
                <li>Mô tả tối thiểu 10 ký tự, nêu rõ chi phí điện, nước, tiện ích.</li>
                <li>Ảnh phòng cần chụp thật, sáng sủa, không mờ hoặc dính logo bên thứ ba.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Edit Listing Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Chỉnh sửa bài đăng" size="lg">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#203c37] mb-1">
              Tiêu đề bài đăng
            </label>
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-[#e2e7e1] p-2.5 text-sm outline-none focus:border-[#15594f]"
              placeholder="Nhập tiêu đề bài đăng"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#203c37] mb-1">
              Mô tả chi tiết (tối thiểu 10 ký tự)
            </label>
            <textarea
              required
              rows={6}
              minLength={10}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full rounded-lg border border-[#e2e7e1] p-2.5 text-sm outline-none focus:border-[#15594f]"
              placeholder="Mô tả đặc điểm phòng, tiện nghi, quy định phòng trọ..."
            />
          </div>

          {editError && (
            <div className="rounded-lg border border-[#f6cbc1] bg-[#fbeae6] p-3 text-xs text-[#a4422c]">
              {editError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e7e1]">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-lg border border-[#e2e7e1] px-4 py-2 text-xs font-semibold text-[#74817b] hover:bg-[#f7f6f2]"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-[#15594f] px-5 py-2 text-xs font-semibold text-white hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      {selectedImage && (
        <Modal isOpen={Boolean(selectedImage)} onClose={() => setSelectedImage(null)} title="Xem hình ảnh" size="lg">
          <div className="aspect-16/10 w-full overflow-hidden rounded-lg bg-black flex items-center justify-center">
            <img src={selectedImage} alt="Ảnh phòng" className="max-h-[75vh] w-auto object-contain" />
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function LandlordListingDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[#74817b]">
          Đang tải thông tin bài đăng...
        </div>
      }
    >
      <LandlordListingDetailContent />
    </React.Suspense>
  );
}
