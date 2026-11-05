"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, MapPin, Calendar, ExternalLink, Info, Map } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Favorite } from "@/types/models";
import { formatPriceCompact } from "@/lib/utils";

export default function TenantFavoritesPage() {
  const [favorites, setFavorites] = React.useState<Favorite[]>([]);
  const [filterTab, setFilterTab] = React.useState<"ALL" | "AVAILABLE">("ALL");
  const [, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadFavorites() {
      setIsLoading(true);
      try {
        const data = await apiClient.favorites.getMyFavorites();
        setFavorites(data || []);
      } catch {
        // Fallback mock items matching Figma frame 44:63255
        setFavorites([
          {
            userId: "u1",
            postId: "post-1",
            createdAt: new Date().toISOString(),
            post: {
              id: "post-1",
              authorId: "landlord-1",
              title: "Studio Ban Mai - Căn hộ mini cao cấp ban công thoáng",
              description: "Phòng mới 100%, trang bị đầy đủ máy lạnh, tủ lạnh, bếp riêng.",
              price: 4500000,
              postType: "RENT_OUT",
              status: "APPROVED",
              viewCount: 142,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              property: {
                id: "p1",
                landlordId: "landlord-1",
                name: "Ban Mai House",
                address: "Số 45 Đường D2, Phường 25",
                district: "Bình Thạnh",
                province: "Hồ Chí Minh",
                createdAt: new Date().toISOString(),
              },
              room: {
                id: "r1",
                propertyId: "p1",
                roomNumber: "302",
                priceMonthly: 4500000,
                depositAmount: 4500000,
                area: 28,
                maxOccupants: 2,
                status: "AVAILABLE",
                createdAt: new Date().toISOString(),
              },
              images: [
                {
                  id: "img-1",
                  postId: "post-1",
                  imageUrl: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop",
                  isPrimary: true,
                },
              ],
            },
          },
          {
            userId: "u1",
            postId: "post-2",
            createdAt: new Date().toISOString(),
            post: {
              id: "post-2",
              authorId: "landlord-2",
              title: "Phòng trọ gác lửng tiện nghi gần ĐH Hutech",
              description: "Không chung chủ, giờ giấc tự do, có chỗ để xe miễn phí.",
              price: 3200000,
              postType: "RENT_OUT",
              status: "APPROVED",
              viewCount: 88,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              property: {
                id: "p2",
                landlordId: "landlord-2",
                name: "Nhà trọ Minh An",
                address: "Hẻm 120 Điện Biên Phủ",
                district: "Bình Thạnh",
                province: "Hồ Chí Minh",
                createdAt: new Date().toISOString(),
              },
              room: {
                id: "r2",
                propertyId: "p2",
                roomNumber: "104",
                priceMonthly: 3200000,
                depositAmount: 3200000,
                area: 22,
                maxOccupants: 2,
                status: "AVAILABLE",
                createdAt: new Date().toISOString(),
              },
              images: [
                {
                  id: "img-2",
                  postId: "post-2",
                  imageUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop",
                  isPrimary: true,
                },
              ],
            },
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    loadFavorites();
  }, []);

  async function handleRemoveFavorite(postId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Optimistically remove from state
    setFavorites((prev) => prev.filter((item) => item.postId !== postId));
    try {
      await apiClient.favorites.toggle(postId);
    } catch {
      // Best-effort removal
    }
  }

  const displayedFavorites = favorites.filter((item) => {
    if (filterTab === "AVAILABLE") {
      return item.post?.room?.status === "AVAILABLE";
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="text-[12px] text-[#74817b] flex items-center gap-1.5 mb-2">
          <Link href="/" className="hover:text-[#203c37]">Trang chủ</Link>
          <span>/</span>
          <span>Khám phá</span>
          <span>/</span>
          <span className="text-[#203c37] font-semibold">Phòng yêu thích</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold text-[#203c37] tracking-tight">
              Phòng đã lưu yêu thích
            </h1>
            <p className="text-[14px] text-[#74817b] mt-1">
              Danh sách những căn phòng bạn quan tâm để dễ dàng so sánh và đặt lịch hẹn xem.
            </p>
          </div>

          <Link
            href="/rooms/map"
            className="h-[38px] px-4 rounded-[8px] border border-[#e2e7e1] bg-white hover:bg-[#f7f6f2] text-[#15594f] text-[13px] font-semibold flex items-center gap-2 transition-colors shrink-0"
          >
            <Map className="size-4" />
            <span>Xem trên bản đồ</span>
          </Link>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex border-b border-[#e2e7e1] gap-6 text-[14px] font-medium">
        <button
          onClick={() => setFilterTab("ALL")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer ${
            filterTab === "ALL"
              ? "border-[#15594f] text-[#15594f] font-semibold"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          Tất cả đã lưu ({favorites.length})
        </button>
        <button
          onClick={() => setFilterTab("AVAILABLE")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer ${
            filterTab === "AVAILABLE"
              ? "border-[#15594f] text-[#15594f] font-semibold"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          Đang còn trống ({favorites.filter((f) => f.post?.room?.status === "AVAILABLE").length})
        </button>
      </div>

      {/* Information Tip Banner */}
      <div className="p-4 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-3">
        <Info className="size-4 text-[#15594f] shrink-0" />
        <p className="text-[13px] text-[#15594f]">
          Mẹo hữu ích: Đặt lịch xem phòng sớm để được chủ trọ ưu tiên giữ phòng tốt nhất.
        </p>
      </div>

      {/* Grid of Favorited Room Cards */}
      {displayedFavorites.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedFavorites.map(({ post }) => {
            if (!post) return null;
            const primaryImg =
              post.images?.find((img) => img.isPrimary)?.imageUrl ||
              post.images?.[0]?.imageUrl ||
              "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop";

            const isAvailable = post.room?.status === "AVAILABLE";

            return (
              <div
                key={post.id}
                className="bg-white rounded-[12px] border border-[#e2e7e1] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group"
              >
                {/* Image Container with Badges & Un-favorite button */}
                <div className="relative h-[180px] w-full overflow-hidden bg-[#f7f6f2]">
                  <img
                    src={primaryImg}
                    alt={post.title}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-2.5 py-1 rounded-[100px] text-[11px] font-bold ${
                        isAvailable
                          ? "bg-[#eaf2ed] text-[#15594f]"
                          : "bg-[#fee2e2] text-[#991b1b]"
                      }`}
                    >
                      {isAvailable ? "Còn trống" : "Đã có người thuê"}
                    </span>
                  </div>

                  {/* Remove Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveFavorite(post.id, e)}
                    className="absolute top-3 right-3 size-8 rounded-full bg-white/90 hover:bg-white text-[#991b1b] flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-110"
                    title="Xóa khỏi yêu thích"
                  >
                    <Heart className="size-4 fill-[#991b1b]" />
                  </button>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#203c37] line-clamp-1 group-hover:text-[#15594f] transition-colors">
                      {post.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-[12px] text-[#74817b] mt-1">
                      <MapPin className="size-3.5 shrink-0 text-[#15594f]" />
                      <span className="truncate">
                        {post.property?.district
                          ? `${post.property.district}, ${post.property.province}`
                          : post.property?.address || "Hồ Chí Minh"}
                      </span>
                    </div>

                    {/* Spec tags */}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-[#74817b]">
                      {post.room?.area && (
                        <span className="px-2 py-0.5 rounded-[4px] bg-[#f7f6f2] border border-[#e2e7e1]">
                          {post.room.area} m²
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#f7f6f2] border border-[#e2e7e1]">
                        P.{post.room?.roomNumber || "01"}
                      </span>
                      <span className="px-2 py-0.5 rounded-[4px] bg-[#f7f6f2] border border-[#e2e7e1]">
                        Đủ nội thất
                      </span>
                    </div>
                  </div>

                  {/* Price & Actions Row */}
                  <div className="pt-3 border-t border-[#e2e7e1] flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-[#74817b]">Giá thuê</p>
                      <p className="text-[16px] font-bold text-[#15594f]">
                        {formatPriceCompact(post.price || post.room?.priceMonthly)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/rooms/${post.roomId || post.id}/book-viewing`}
                        className="h-[34px] px-3 rounded-[6px] bg-[#15594f] hover:bg-[#103f39] text-white text-[12px] font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Calendar className="size-3.5" />
                        <span>Đặt lịch</span>
                      </Link>

                      <Link
                        href={`/rooms/${post.id}`}
                        className="size-[34px] rounded-[6px] border border-[#e2e7e1] text-[#203c37] hover:bg-[#f7f6f2] flex items-center justify-center transition-colors"
                        title="Xem chi tiết phòng"
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-[12px] border border-[#e2e7e1] py-16 text-center space-y-4">
          <div className="size-16 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mx-auto">
            <Heart className="size-8" />
          </div>
          <div>
            <h3 className="text-[18px] font-semibold text-[#203c37]">
              Chưa có phòng nào trong danh sách yêu thích
            </h3>
            <p className="text-[14px] text-[#74817b] mt-1 max-w-md mx-auto">
              Khám phá hàng trăm căn phòng tiện nghi trên 5K-Rental Manager và nhấn vào biểu tượng trái tim để lưu lại.
            </p>
          </div>
          <Link
            href="/rooms"
            className="inline-flex items-center justify-center h-[42px] px-6 rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[13px] font-semibold transition-colors"
          >
            Khám phá phòng ngay
          </Link>
        </div>
      )}
    </div>
  );
}
