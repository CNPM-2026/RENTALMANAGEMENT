"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search,
  MapPin,
  Map,
  SlidersHorizontal,
  Heart,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

type RoomCard = {
  id: string;
  title: string;
  type: string;
  area: number;
  floor: number;
  hasBalcony: boolean;
  petFriendly: boolean;
  address: string;
  district: string;
  price: number;
  deposit: number;
  image: string;
  verified: boolean;
  amenities: string[];
};

const AVAILABLE_AMENITIES = [
  "Máy lạnh",
  "Tủ lạnh",
  "Máy giặt",
  "Gác lửng",
  "Ban công",
  "Thang máy",
  "Giờ tự do",
  "Bảo vệ 24/7",
  "Khóa vân tay",
  "Chỗ để xe",
];

function RoomsDiscoveryContent() {
  const searchParams = useSearchParams();

  // Search and Filter States
  const [keyword, setKeyword] = React.useState(searchParams.get("location") || "");
  const [district, setDistrict] = React.useState(searchParams.get("district") || "");
  const [roomType, setRoomType] = React.useState(searchParams.get("type") || "");
  const initialPrice = searchParams.get("price")?.split("-");
  const [minPrice, setMinPrice] = React.useState(initialPrice && initialPrice.length === 2 ? Number(initialPrice[0]) || 0 : 0);
  const [maxPrice, setMaxPrice] = React.useState(initialPrice && initialPrice.length === 2 ? Number(initialPrice[1]) || 12000000 : 12000000);
  const [selectedAmenities, setSelectedAmenities] = React.useState<string[]>([]);
  const [petFriendly, setPetFriendly] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("NEWEST");
  const [savedFavorites, setSavedFavorites] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [rooms, setRooms] = React.useState<RoomCard[]>([]);

  React.useEffect(() => {
    apiClient.posts.search({
      keyword: keyword || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      district: district || undefined,
      page: currentPage,
      limit: 50,
    }).then((response) => setRooms(response.data.map((post) => ({
      id: post.id,
      title: post.title,
      type: post.room ? "ROOM" : "APARTMENT",
      area: post.room?.area ?? 0,
      floor: 0,
      hasBalcony: false,
      petFriendly: false,
      address: post.property?.address ?? "Chưa cập nhật địa chỉ",
      district: post.property?.district ?? "",
      price: post.price ?? post.room?.priceMonthly ?? 0,
      deposit: post.room?.depositAmount ?? 0,
      image: post.images?.[0]?.imageUrl ?? "/placeholder-room.jpg",
      verified: post.status === "APPROVED",
      amenities: post.room?.roomAmenities?.map((item) => item.amenity?.name ?? "").filter(Boolean) ?? [],
    })))).catch(() => setRooms([]));
  }, [keyword, district, minPrice, maxPrice, currentPage]);

  function handleAmenityToggle(amenity: string) {
    setSelectedAmenities((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity]
    );
  }

  function handleResetFilters() {
    setKeyword("");
    setDistrict("");
    setRoomType("");
    setMinPrice(0);
    setMaxPrice(12000000);
    setSelectedAmenities([]);
    setPetFriendly(false);
    setSortBy("NEWEST");
    setCurrentPage(1);
  }

  function handleFavoriteToggle(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSavedFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Filter computation
  const filteredRooms = React.useMemo(() => {
    return rooms.filter((room) => {
      // Keyword / Location match
      if (keyword.trim()) {
        const kw = keyword.toLowerCase().trim();
        const matchTitle = room.title.toLowerCase().includes(kw);
        const matchAddr = room.address.toLowerCase().includes(kw);
        if (!matchTitle && !matchAddr) return false;
      }

      // District match
      if (district && room.district !== district) {
        return false;
      }

      // Room Type match
      if (roomType && room.type !== roomType) {
        return false;
      }

      // Price range match
      if (room.price < minPrice || room.price > maxPrice) {
        return false;
      }

      // Pet Friendly match
      if (petFriendly && !room.petFriendly) {
        return false;
      }

      // Amenities match (all selected must be present)
      if (selectedAmenities.length > 0) {
        const hasAll = selectedAmenities.every((a) =>
          room.amenities.includes(a)
        );
        if (!hasAll) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "PRICE_ASC") return a.price - b.price;
      if (sortBy === "PRICE_DESC") return b.price - a.price;
      if (sortBy === "AREA_DESC") return b.area - a.area;
      return 0; // Default NEWEST
    });
  }, [rooms, keyword, district, roomType, minPrice, maxPrice, petFriendly, selectedAmenities, sortBy]);

  return (
    <div className="w-full min-h-screen bg-[#f7f6f2] text-[#203c37] py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-[1312px] mx-auto space-y-6">
        {/* =======================================================================
            1. BREADCRUMBS & PAGE TITLE (Figma Node 44:62677)
        ======================================================================== */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">Tìm phòng trọ & căn hộ</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight">
                Khám phá phòng trọ & căn hộ
              </h1>
              <p className="text-[14px] text-[#74817b] mt-0.5">
                Tìm kiếm và lọc phòng theo nhu cầu thực tế của bạn tại TP.HCM & Hà Nội
              </p>
            </div>

            {/* Switch to Map View Button */}
            <Link href="/rooms/map">
              <Button
                variant="outline"
                size="md"
                className="bg-white hover:bg-[#eaf2ed] text-[#15594f] border-[#e2e7e1] font-semibold"
                leftIcon={<Map className="size-4" />}
              >
                Xem trên bản đồ
              </Button>
            </Link>
          </div>
        </div>

        {/* =======================================================================
            2. TOP KEYWORD SEARCH BAR (Figma Node 44:62684)
        ======================================================================== */}
        <div className="bg-white p-3.5 rounded-[12px] border border-[#e2e7e1] shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-[#f7f6f2] rounded-[8px] border border-[#e2e7e1]">
            <MapPin className="size-5 text-[#15594f] shrink-0" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Nhập tên đường, quận huyện, trường ĐH (VD: Bình Thạnh, HUTECH, Điện Biên Phủ)..."
              className="w-full bg-transparent text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            className="sm:w-36 font-semibold"
            leftIcon={<Search className="size-4" />}
          >
            Tìm kiếm
          </Button>
        </div>

        {/* =======================================================================
            3. MAIN CONTENT: 2-COLUMN LAYOUT (Figma Node 44:62695)
        ======================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* -------------------------------------------------------------------
              LEFT COLUMN: MULTI-CRITERIA FILTER SIDEBAR (270px on desktop)
          -------------------------------------------------------------------- */}
          <aside className="lg:col-span-4 xl:col-span-3 bg-white p-5 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="size-4.5 text-[#15594f]" />
                <h2 className="text-[16px] font-bold text-[#203c37]">Bộ lọc nâng cao</h2>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 text-[12px] text-[#74817b] hover:text-[#15594f] cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Đặt lại</span>
              </button>
            </div>

            {/* Filter 1: District Select */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider block">
                Khu vực / Quận huyện
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full h-[42px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] outline-none cursor-pointer"
              >
                <option value="">Tất cả quận huyện</option>
                <option value="Bình Thạnh">Quận Bình Thạnh</option>
                <option value="Quận 1">Quận 1</option>
                <option value="Thủ Đức">TP. Thủ Đức</option>
                <option value="Phú Nhuận">Quận Phú Nhuận</option>
                <option value="Tân Bình">Quận Tân Bình</option>
                <option value="Quận 7">Quận 7</option>
              </select>
            </div>

            {/* Filter 2: Room Type */}
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider block">
                Loại hình phòng
              </label>
              <select
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                className="w-full h-[42px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] outline-none cursor-pointer"
              >
                <option value="">Tất cả loại hình</option>
                <option value="STUDIO">Căn hộ mini Studio</option>
                <option value="ROOM">Phòng trọ gác lửng</option>
                <option value="APARTMENT">Chung cư nguyên căn</option>
              </select>
            </div>

            {/* Filter 3: Price Range Dual Slider & Chips */}
            <div className="space-y-3 pt-2 border-t border-[#e2e7e1]">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider">
                  Khoảng giá thuê
                </label>
                <span className="text-[12px] font-bold text-[#15594f]">
                  {(minPrice / 1000000).toFixed(1)} tr — {(maxPrice / 1000000).toFixed(1)} tr
                </span>
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0"
                max="15000000"
                step="500000"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#15594f] cursor-pointer"
              />

              {/* Quick Price Buttons */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice(0);
                    setMaxPrice(3500000);
                  }}
                  className="px-2 py-1.5 rounded-[6px] bg-[#f7f6f2] text-[#203c37] hover:bg-[#eaf2ed] text-center border border-[#e2e7e1]"
                >
                  Dưới 3.5 triệu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice(3500000);
                    setMaxPrice(6000000);
                  }}
                  className="px-2 py-1.5 rounded-[6px] bg-[#f7f6f2] text-[#203c37] hover:bg-[#eaf2ed] text-center border border-[#e2e7e1]"
                >
                  3.5 - 6 triệu
                </button>
              </div>
            </div>

            {/* Filter 4: Pet Friendly Toggle */}
            <div className="pt-2 border-t border-[#e2e7e1]">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={petFriendly}
                  onChange={(e) => setPetFriendly(e.target.checked)}
                  className="size-4 accent-[#15594f] rounded-[4px]"
                />
                <span className="text-[13px] font-semibold text-[#203c37]">
                  Cho phép nuôi thú cưng
                </span>
              </label>
            </div>

            {/* Filter 5: Amenities Checklist */}
            <div className="space-y-2.5 pt-2 border-t border-[#e2e7e1]">
              <label className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider block">
                Tiện ích phòng
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {AVAILABLE_AMENITIES.map((amenity) => {
                  const isChecked = selectedAmenities.includes(amenity);
                  return (
                    <label
                      key={amenity}
                      className="flex items-center gap-2.5 text-[13px] text-[#203c37] cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="size-4 accent-[#15594f] rounded-[4px]"
                      />
                      <span>{amenity}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full font-semibold"
            >
              Áp dụng bộ lọc ({filteredRooms.length})
            </Button>
          </aside>

          {/* -------------------------------------------------------------------
              RIGHT COLUMN: ROOM CARDS GRID & SORT TABS (Figma Node 44:62756)
          -------------------------------------------------------------------- */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Results Header Strip */}
            <div className="bg-white p-4 rounded-[12px] border border-[#e2e7e1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div>
                <p className="text-[14px] text-[#203c37]">
                  Tìm thấy{" "}
                  <strong className="text-[#15594f] font-bold">
                    {filteredRooms.length}
                  </strong>{" "}
                  căn phòng phù hợp
                </p>
              </div>

              {/* Sort Tabs */}
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-[#74817b] text-[12px]">Sắp xếp theo:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-[36px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[6px] text-[13px] text-[#203c37] outline-none cursor-pointer font-medium"
                >
                  <option value="NEWEST">Mới nhất</option>
                  <option value="PRICE_ASC">Giá tăng dần</option>
                  <option value="PRICE_DESC">Giá giảm dần</option>
                  <option value="AREA_DESC">Diện tích lớn nhất</option>
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {(district || roomType || petFriendly || selectedAmenities.length > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-[#74817b]">Đang lọc:</span>
                {district && (
                  <Badge variant="neutral" size="sm">
                    Khu vực: {district}
                  </Badge>
                )}
                {roomType && (
                  <Badge variant="neutral" size="sm">
                    Loại: {roomType}
                  </Badge>
                )}
                {petFriendly && (
                  <Badge variant="neutral" size="sm">
                    Nuôi thú cưng
                  </Badge>
                )}
                {selectedAmenities.map((a) => (
                  <Badge key={a} variant="neutral" size="sm">
                    {a}
                  </Badge>
                ))}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[12px] text-[#15594f] font-medium underline ml-2 cursor-pointer"
                >
                  Xóa tất cả bộ lọc
                </button>
              </div>
            )}

            {/* Room Cards Grid */}
            {filteredRooms.length === 0 ? (
              <div className="bg-white p-12 rounded-[14px] border border-[#e2e7e1] text-center space-y-4 shadow-xs">
                <div className="size-14 rounded-full bg-[#f7f6f2] text-[#74817b] flex items-center justify-center mx-auto">
                  <Search className="size-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#203c37]">
                    Không tìm thấy phòng phù hợp
                  </h3>
                  <p className="text-[13px] text-[#74817b] max-w-md mx-auto">
                    Vui lòng nới lỏng khoảng giá, thay đổi quận huyện hoặc xóa bớt các tiêu chí tiện ích đã chọn.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  Đặt lại tất cả bộ lọc
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredRooms.map((room) => {
                  const isFav = savedFavorites.includes(room.id);
                  return (
                    <div
                      key={room.id}
                      className="bg-white border border-[#e2e7e1] rounded-[12px] overflow-hidden shadow-xs hover:shadow-md hover:border-[#15594f]/40 transition-all flex flex-col group"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full h-[200px] overflow-hidden bg-gray-100">
                        <img
                          src={room.image}
                          alt={room.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-3 left-3">
                          {room.verified ? (
                            <Badge variant="success" size="sm">
                              XÁC THỰC
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              TIÊU CHUẨN
                            </Badge>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleFavoriteToggle(room.id, e)}
                          aria-label="Lưu yêu thích"
                          className="absolute top-3 right-3 size-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#74817b] hover:text-red-500 transition-colors shadow-xs"
                        >
                          <Heart
                            className={`size-4 ${isFav ? "fill-red-500 text-red-500" : ""}`}
                          />
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <h3 className="text-[15px] font-semibold text-[#203c37] line-clamp-1 group-hover:text-[#15594f] transition-colors">
                            {room.title}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[12px] text-[#74817b] line-clamp-1">
                            <MapPin className="size-3.5 shrink-0 text-[#15594f]" />
                            <span>{room.address}</span>
                          </div>
                        </div>

                        {/* Specs */}
                        <div className="flex items-center gap-2 text-[11px] text-[#203c37]">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#f7f6f2] border border-[#e2e7e1]">
                            {room.area} m²
                          </span>
                          <span className="px-2 py-0.5 rounded-[4px] bg-[#f7f6f2] border border-[#e2e7e1]">
                            Tầng {room.floor}
                          </span>
                          {room.hasBalcony && (
                            <span className="px-2 py-0.5 rounded-[4px] bg-[#eaf2ed] text-[#15594f] font-medium border border-[#d2e4d7]">
                              Ban công
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#e2e7e1] flex items-center justify-between">
                          <div>
                            <span className="text-base font-bold text-[#15594f]">
                              {room.price.toLocaleString("vi-VN")} đ
                            </span>
                            <span className="text-[11px] text-[#74817b]">/tháng</span>
                          </div>
                          <Link href={`/rooms/${room.id}`}>
                            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15594f] hover:underline">
                              Xem phòng <ArrowUpRight className="size-4" />
                            </span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {filteredRooms.length > 0 && (
              <div className="pt-6 border-t border-[#e2e7e1] flex items-center justify-between">
                <span className="text-[13px] text-[#74817b]">
                  Trang {currentPage} / 3
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    leftIcon={<ChevronLeft className="size-4" />}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-9 px-0"
                  >
                    1
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-9 px-0"
                    onClick={() => setCurrentPage(2)}
                  >
                    2
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-9 px-0"
                    onClick={() => setCurrentPage(3)}
                  >
                    3
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 3}
                    onClick={() => setCurrentPage((p) => Math.min(3, p + 1))}
                    rightIcon={<ChevronRight className="size-4" />}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function RoomsDiscoveryPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f6f2] flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải danh sách phòng...
        </div>
      }
    >
      <RoomsDiscoveryContent />
    </React.Suspense>
  );
}
