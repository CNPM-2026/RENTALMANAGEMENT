"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  Search,
  MapPin,
  Home,
  Users,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Key,
  BadgeCheck,
  FileCheck,
  CalendarCheck,
  Heart,
  ChevronRight,
  Plus,
  Minus,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

type FeaturedRoom = {
  id: string;
  title: string;
  type: string;
  area: number;
  floor: number;
  hasBalcony: boolean;
  address: string;
  price: number;
  deposit: number;
  image: string;
  badge: string;
  rating: number;
};

export default function TenantHomePage() {
  const [activeRoomTab, setActiveRoomTab] = React.useState("ALL");
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);
  const [savedFavorites, setSavedFavorites] = React.useState<string[]>([]);

  function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSavedFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const quickFilters = [
    { label: "Gần trường ĐH", href: "/rooms?amenities=near-university" },
    { label: "Phòng có gác lửng", href: "/rooms?amenities=mezzanine" },
    { label: "Nuôi thú cưng", href: "/rooms?amenities=pet-friendly" },
    { label: "Giờ giấc tự do", href: "/rooms?amenities=free-time" },
    { label: "Full nội thất", href: "/rooms?amenities=furnished" },
  ];

  const [featuredRooms, setFeaturedRooms] = React.useState<FeaturedRoom[]>([]);

  React.useEffect(() => {
    apiClient.posts.getApproved({ postType: "RENT_OUT" })
      .then((posts) => setFeaturedRooms(posts.slice(0, 6).map((post) => ({
        id: post.id,
        title: post.title,
        type: post.room ? "ROOM" : "APARTMENT",
        area: post.room?.area ?? 0,
        floor: 0,
        hasBalcony: false,
        address: post.property?.address ?? "Chưa cập nhật địa chỉ",
        price: post.room?.priceMonthly ?? post.price ?? 0,
        deposit: post.room?.depositAmount ?? 0,
        image: post.images?.find((image) => image.isPrimary)?.imageUrl ?? post.images?.[0]?.imageUrl ?? "/placeholder-room.jpg",
        badge: "ĐANG CHO THUÊ",
        rating: 0,
      }))))
      .catch(() => setFeaturedRooms([]));
  }, []);

  const neighborhoods = [
    {
      id: "binh-thanh",
      name: "Quận Bình Thạnh",
      count: "120+ phòng trống",
      desc: "Gần cụm ĐH Ngoại thương, HUTECH, UEF. Đi Quận 1 chỉ 5 phút.",
      image: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80",
      href: "/rooms?location=Bình+Thạnh",
    },
    {
      id: "quan-1",
      name: "Quận 1 — Trung Tâm",
      count: "45+ phòng trống",
      desc: "Trung tâm tài chính sầm uất, nhịp sống sôi động, tiện nghi đầy đủ.",
      image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80",
      href: "/rooms?location=Quận+1",
    },
    {
      id: "thu-duc",
      name: "TP. Thủ Đức",
      count: "210+ phòng trống",
      desc: "Không gian thoáng đãng, gần Làng Đại học & Khu Công Nghệ Cao.",
      image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
      href: "/rooms?location=Thủ+Đức",
    },
  ];

  const steps = [
    {
      icon: Search,
      step: "01",
      title: "Tìm kiếm thông minh",
      desc: "Lọc phòng theo vị trí, tầm giá và tiện ích mong muốn. Xem bản đồ trực quan với ghim giá tiền rõ ràng.",
    },
    {
      icon: CalendarCheck,
      step: "02",
      title: "Đặt lịch xem phòng",
      desc: "Chọn ngày và khung giờ hẹn chỉ với 1 chạm. Chủ trọ xác nhận và đón tiếp bạn trực tiếp tại phòng.",
    },
    {
      icon: Key,
      step: "03",
      title: "Ký HĐ & Nhận phòng",
      desc: "Ký hợp đồng điện tử minh bạch, đóng cọc an tâm qua cổng đối soát và tận hưởng cuộc sống mới.",
    },
  ];

  const faqs = [
    {
      q: "Đặt lịch xem phòng qua 5K-Rental Manager có mất phí không?",
      a: "Hoàn toàn MIỄN PHÍ 100%. Bạn có thể đặt hẹn trực tiếp với chủ trọ, chọn ngày giờ thuận tiện và đến kiểm tra phòng thực tế mà không phải thanh toán bất kỳ chi phí trung gian nào.",
    },
    {
      q: "Làm sao để biết phòng trọ đã được xác thực thực tế?",
      a: "Các căn phòng có huy hiệu 'ĐÃ XÁC MINH' màu xanh lá đã được đội ngũ 5K-Rental Manager đến tận nơi kiểm tra địa chỉ, chụp ảnh thực tế, đối soát giấy tờ sở hữu/ủy quyền của chủ trọ và hệ thống PCCC.",
    },
    {
      q: "Hợp đồng điện tử trên 5K-Rental Manager có giá trị pháp lý không?",
      a: "Có giá trị pháp lý đầy đủ theo Luật Giao dịch điện tử Việt Nam. Bản hợp đồng tích hợp mã băm xác thực, chữ ký điện tử hai bên và được lưu trữ bảo mật để đối soát bất cứ lúc nào.",
    },
    {
      q: "Tôi có thể đổi hoặc hủy lịch hẹn xem phòng sau khi đã đặt không?",
      a: "Có. Bạn chỉ cần vào mục 'Lịch xem phòng' trong tài khoản cá nhân, bấm 'Đổi lịch hẹn' hoặc 'Hủy lịch hẹn' trước giờ hẹn ít nhất 2 tiếng để hệ thống thông báo kịp thời đến chủ trọ.",
    },
  ];

  const filteredRooms =
    activeRoomTab === "ALL"
      ? featuredRooms
      : featuredRooms.filter((r) => r.type === activeRoomTab);

  return (
    <div className="w-full flex flex-col bg-[#f7f6f2] text-[#203c37]">
      {/* =========================================================================
          1. HERO DISCOVERY SECTION (Figma Node 44:62028, h 688px)
      ========================================================================== */}
      <section className="relative w-full pt-10 pb-20 px-6 lg:px-16 bg-gradient-to-b from-white via-white to-[#f7f6f2] border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto flex flex-col gap-10">
          {/* Top Story Hero Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Story Column */}
            <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
              {/* Brand Promise Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[100px] bg-[#eaf2ed] text-[#15594f] border border-[#d2e4d7] text-[12px] font-semibold tracking-wide shadow-xs">
                <Sparkles className="size-3.5 text-[#15594f]" />
                <span>MỘT CHỐN Ở HỢP GU — 5K-RENTAL MANAGER</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#15594f] leading-[1.2] tracking-tight">
                Tìm chốn về văn minh. <br className="hidden sm:inline" />
                Gặp người bạn hợp lối sống.
              </h1>

              {/* Subtitle */}
              <p className="text-[15px] sm:text-[16px] text-[#74817b] max-w-xl leading-relaxed">
                Nền tảng thuê phòng & tìm bạn ở ghép minh bạch tại TP.HCM và Hà Nội.
                100% phòng được xác minh thực địa, ký hợp đồng số an toàn và hỗ trợ 24/7.
              </p>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-5 pt-1 text-[13px] text-[#203c37] font-medium">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="size-5 text-[#15594f]" />
                  <span>Xác thực thực tế 100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-[#15594f]" />
                  <span>Bảo vệ quyền lợi khách thuê</span>
                </div>
              </div>

              {/* Social Proof Stack */}
              <div className="flex items-center gap-3 pt-2">
                <div className="flex -space-x-2 overflow-hidden">
                  <span className="inline-block size-9 rounded-full ring-2 ring-white bg-[#15594f] text-white text-[11px] font-bold flex items-center justify-center">
                    LN
                  </span>
                  <span className="inline-block size-9 rounded-full ring-2 ring-white bg-[#203c37] text-white text-[11px] font-bold flex items-center justify-center">
                    TA
                  </span>
                  <span className="inline-block size-9 rounded-full ring-2 ring-white bg-[#075985] text-white text-[11px] font-bold flex items-center justify-center">
                    HN
                  </span>
                </div>
                <span className="text-[13px] text-[#74817b]">
                  Nền tảng kết nối người thuê và chủ trọ minh bạch
                </span>
              </div>
            </div>

            {/* Right Featured Room Hero Card */}
            <div className="lg:col-span-5 relative w-full h-[380px] sm:h-[420px] rounded-[16px] overflow-hidden border border-[#e2e7e1] shadow-lg group">
              {featuredRooms[0] ? <img src={featuredRooms[0].image} alt={featuredRooms[0].title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full bg-[#eaf2ed] flex items-center justify-center text-[#74817b]">Chưa có tin đăng nổi bật</div>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

              <div className="absolute top-4 left-4">
                <Badge variant="success" size="md">
                  TIN ĐĂNG MỚI NHẤT
                </Badge>
              </div>

              <div className="absolute bottom-5 left-5 right-5 text-white space-y-1.5">
                <p className="text-[11px] font-semibold text-[#eaf2ed] uppercase tracking-wider">{featuredRooms[0]?.address ?? "Đang cập nhật địa chỉ"}</p>
                <h3 className="text-xl font-bold tracking-tight">{featuredRooms[0]?.title ?? "Chưa có tin đăng nổi bật"}</h3>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-lg font-bold text-white">
                    {featuredRooms[0] ? `${formatCurrency(featuredRooms[0].price, { showUnit: false })} đ` : "—"}<span className="text-[13px] font-normal text-white/80">/tháng</span>
                  </span>
                  <Link href={featuredRooms[0] ? `/rooms/${featuredRooms[0].id}` : "/rooms"}>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#eaf2ed] hover:underline">
                      Xem chi tiết <ArrowUpRight className="size-4" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Hero Search Bar Container (Figma Node 44:62055) */}
          <div className="w-full bg-white rounded-[16px] p-4 sm:p-5 border border-[#e2e7e1] shadow-xl">
            <form
              action="/rooms"
              method="GET"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center"
            >
              {/* Field 1: Location */}
              <div className="flex flex-col text-left px-3.5 py-2 bg-[#f7f6f2] rounded-[8px] border border-[#e2e7e1]">
                <label
                  htmlFor="location"
                  className="text-[10px] font-bold text-[#74817b] uppercase tracking-wider"
                >
                  Khu vực / Quận huyện
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="size-4 text-[#15594f] shrink-0" />
                  <input
                    id="location"
                    name="location"
                    type="text"
                    placeholder="Q. Bình Thạnh, Thủ Đức..."
                    className="w-full bg-transparent text-[13px] text-[#203c37] placeholder:text-[#74817b] outline-none"
                  />
                </div>
              </div>

              {/* Field 2: Room Type */}
              <div className="flex flex-col text-left px-3.5 py-2 bg-[#f7f6f2] rounded-[8px] border border-[#e2e7e1]">
                <label
                  htmlFor="roomType"
                  className="text-[10px] font-bold text-[#74817b] uppercase tracking-wider"
                >
                  Loại hình phòng
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Home className="size-4 text-[#15594f] shrink-0" />
                  <select
                    id="roomType"
                    name="type"
                    className="w-full bg-transparent text-[13px] text-[#203c37] outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="">Tất cả loại hình</option>
                    <option value="ROOM">Phòng trọ gác lửng</option>
                    <option value="STUDIO">Căn hộ mini Studio</option>
                    <option value="APARTMENT">Chung cư nguyên căn</option>
                  </select>
                </div>
              </div>

              {/* Field 3: Price Range */}
              <div className="flex flex-col text-left px-3.5 py-2 bg-[#f7f6f2] rounded-[8px] border border-[#e2e7e1]">
                <label
                  htmlFor="priceRange"
                  className="text-[10px] font-bold text-[#74817b] uppercase tracking-wider"
                >
                  Khoảng giá thuê
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <TrendingUp className="size-4 text-[#15594f] shrink-0" />
                  <select
                    id="priceRange"
                    name="price"
                    className="w-full bg-transparent text-[13px] text-[#203c37] outline-none cursor-pointer"
                    defaultValue=""
                  >
                    <option value="">Tất cả mức giá</option>
                    <option value="0-3000000">Dưới 3 triệu</option>
                    <option value="3000000-5000000">3 - 5 triệu</option>
                    <option value="5000000-8000000">5 - 8 triệu</option>
                    <option value="8000000-15000000">Trên 8 triệu</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="w-full sm:col-span-2 lg:col-span-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full h-[52px] font-semibold text-[14px] shadow-sm"
                  leftIcon={<Search className="size-4" />}
                >
                  Tìm kiếm phòng
                </Button>
              </div>
            </form>

            {/* Quick Filter Tags */}
            <div className="mt-4 pt-3.5 border-t border-[#e2e7e1] flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[#74817b] font-medium">Gợi ý nhanh:</span>
              {quickFilters.map((q) => (
                <Link
                  key={q.label}
                  href={q.href}
                  className="px-2.5 py-1 rounded-[6px] bg-[#f7f6f2] text-[#203c37] hover:bg-[#eaf2ed] hover:text-[#15594f] transition-colors border border-[#e2e7e1]"
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. FEATURED ROOMS SECTION (Figma Node 44:62074, h 719px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-white border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto space-y-8">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
                TUYỂN CHỌN HÔM NAY
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight">
                Không gian sống được yêu thích nhất
              </h2>
              <p className="text-[14px] text-[#74817b]">
                Phòng trọ & căn hộ dịch vụ cao cấp, đầy đủ nội thất và đã kiểm duyệt pháp lý
              </p>
            </div>

            <Link href="/rooms">
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowUpRight className="size-4" />}
              >
                Xem tất cả phòng
              </Button>
            </Link>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#e2e7e1]">
            {[
              { id: "ALL", label: "Tất cả phòng" },
              { id: "STUDIO", label: "Studio mini" },
              { id: "ROOM", label: "Phòng gác lửng" },
              { id: "APARTMENT", label: "Chung cư nguyên căn" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRoomTab(tab.id)}
                className={`px-4 py-2 rounded-[8px] text-[13px] font-medium transition-colors cursor-pointer ${
                  activeRoomTab === tab.id
                    ? "bg-[#15594f] text-white shadow-xs"
                    : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Room Cards Grid (Figma Node 44:62092) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => {
              const isFav = savedFavorites.includes(room.id);
              return (
                <div
                  key={room.id}
                  className="bg-white border border-[#e2e7e1] rounded-[12px] overflow-hidden shadow-xs hover:shadow-md hover:border-[#15594f]/40 transition-all flex flex-col group"
                >
                  {/* Room Thumbnail */}
                  <div className="relative w-full h-[220px] overflow-hidden bg-gray-100">
                    <img
                      src={room.image}
                      alt={room.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="success" size="sm">
                        {room.badge}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(room.id, e)}
                      aria-label="Lưu yêu thích"
                      className="absolute top-3 right-3 size-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#74817b] hover:text-red-500 transition-colors shadow-xs"
                    >
                      <Heart
                        className={`size-4 ${isFav ? "fill-red-500 text-red-500" : ""}`}
                      />
                    </button>
                  </div>

                  {/* Room Information */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <h3 className="text-[16px] font-semibold text-[#203c37] line-clamp-1 group-hover:text-[#15594f] transition-colors">
                        {room.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#74817b] line-clamp-1">
                        <MapPin className="size-3.5 shrink-0 text-[#15594f]" />
                        <span>{room.address}</span>
                      </div>
                    </div>

                    {/* Specs Pills */}
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
                          {formatCurrency(room.price, { showUnit: false })} đ
                        </span>
                        <span className="text-[12px] text-[#74817b]">/tháng</span>
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
        </div>
      </section>

      {/* =========================================================================
          3. EXPLORE NEIGHBORHOODS (Figma Node 44:62165, h 502px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-[#f7f6f2] border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto space-y-8">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
              KHU VỰC TIÊU BIỂU
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#203c37]">
              Khám phá theo quận & khu đô thị
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {neighborhoods.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className="bg-white border border-[#e2e7e1] rounded-[14px] overflow-hidden shadow-xs hover:shadow-md hover:border-[#15594f]/50 transition-all flex flex-col group"
              >
                <div className="relative w-full h-[180px] overflow-hidden">
                  <img
                    src={n.image}
                    alt={n.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3">
                    <span className="px-2.5 py-1 rounded-[100px] bg-white/90 text-[#15594f] text-[11px] font-semibold shadow-xs">
                      {n.count}
                    </span>
                  </div>
                </div>
                <div className="p-5 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#203c37] group-hover:text-[#15594f] transition-colors">
                      {n.name}
                    </h3>
                    <p className="text-[13px] text-[#74817b] mt-1 leading-relaxed">
                      {n.desc}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15594f] pt-2">
                    Khám phá phòng ngay <ChevronRight className="size-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. RENTAL PROCESS STEPS (Figma Node 44:62191, h 399px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-white border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
              QUY TRÌNH TINH GỌN
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#203c37]">
              Hành trình thuê phòng 3 bước
            </h2>
            <p className="text-[14px] text-[#74817b]">
              Trải nghiệm thuê phòng trọ minh bạch, loại bỏ hoàn toàn môi giới lừa đảo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((st) => (
              <div
                key={st.step}
                className="p-6 rounded-[12px] bg-[#f7f6f2] border border-[#e2e7e1] space-y-3 relative hover:border-[#15594f]/40 transition-colors"
              >
                <div className="size-12 rounded-[10px] bg-[#15594f] text-white flex items-center justify-center shadow-xs">
                  <st.icon className="size-6" />
                </div>
                <span className="absolute top-6 right-6 text-2xl font-bold text-[#15594f]/20">
                  {st.step}
                </span>
                <h3 className="text-lg font-bold text-[#203c37]">{st.title}</h3>
                <p className="text-[13px] text-[#74817b] leading-relaxed">
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. ROOMMATE MATCHING PROMO (Figma Node 44:62208, h 548px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-[#f7f6f2] border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Visual Candidate Preview Card */}
          <div className="lg:col-span-5 relative h-[360px] sm:h-[400px] rounded-[16px] overflow-hidden border border-[#e2e7e1] shadow-md">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80"
              alt="Bạn cùng phòng tương thích"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-[12px] bg-white/95 backdrop-blur-xs text-[#203c37] border border-[#e2e7e1] shadow-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold">Minh Phương & Trâm Anh</span>
                <Badge variant="success" size="sm">
                  92% HỢP GU
                </Badge>
              </div>
              <p className="text-[12px] text-[#74817b]">
                Ngủ sớm (trước 23h) • Không hút thuốc • Thích nấu ăn cuối tuần
              </p>
            </div>
          </div>

          {/* Pitch & Call to Action */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <span className="px-3 py-1 rounded-[100px] text-[11px] font-bold uppercase tracking-wider bg-[#eaf2ed] text-[#15594f]">
              TÍNH NĂNG Ở GHÉP THÔNG MINH
            </span>

            <h2 className="text-3xl font-bold text-[#203c37] leading-tight">
              Tìm bạn cùng phòng hợp phong cách sống
            </h2>

            <p className="text-[15px] text-[#74817b] leading-relaxed">
              Không còn nỗi lo gặp phải bạn cùng phòng khắc khẩu. Thuật toán phân tích
              thói quen sinh hoạt đối chiếu 12 tiêu chí giúp bạn chọn bạn ở ghép chuẩn gu.
            </p>

            <div className="space-y-3 text-[14px] text-[#203c37]">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4.5 text-[#15594f] shrink-0" />
                <span>Khảo sát 10 câu hỏi về giờ giấc, thú cưng và chi tiêu</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4.5 text-[#15594f] shrink-0" />
                <span>Chấm điểm tương thích từ 0 - 100% minh bạch</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-4.5 text-[#15594f] shrink-0" />
                <span>Nhắn tin trò chuyện bảo mật trước khi quyết định dọn vào</span>
              </div>
            </div>

            <div className="pt-2">
              <Link href="/roommates">
                <Button
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="size-4" />}
                >
                  Khám phá bạn ở ghép
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. TRUST & SAFETY COMMITMENTS (Figma Node 44:62237, h 330px)
      ========================================================================== */}
      <section className="py-14 px-6 lg:px-16 bg-white border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto space-y-8">
          <div className="text-center space-y-1">
            <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
              CAM KẾT BẢO VỆ
            </span>
            <h2 className="text-2xl font-bold text-[#203c37]">
              An tâm trọn vẹn khi thuê cùng 5K-Rental Manager
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-[12px] border border-[#e2e7e1] bg-[#f7f6f2] space-y-2.5">
              <BadgeCheck className="size-7 text-[#15594f]" />
              <h3 className="text-base font-bold text-[#203c37]">Xác minh thực tế 100%</h3>
              <p className="text-[13px] text-[#74817b] leading-relaxed">
                Tất cả tin đăng đều có ảnh thật, địa chỉ rõ ràng và được kiểm tra bởi chuyên viên.
              </p>
            </div>

            <div className="p-6 rounded-[12px] border border-[#e2e7e1] bg-[#f7f6f2] space-y-2.5">
              <FileCheck className="size-7 text-[#15594f]" />
              <h3 className="text-base font-bold text-[#203c37]">Hợp đồng số minh bạch</h3>
              <p className="text-[13px] text-[#74817b] leading-relaxed">
                Ký kết hợp đồng điện tử có giá trị pháp lý, rõ ràng quyền lợi và mức cọc.
              </p>
            </div>

            <div className="p-6 rounded-[12px] border border-[#e2e7e1] bg-[#f7f6f2] space-y-2.5">
              <ShieldCheck className="size-7 text-[#15594f]" />
              <h3 className="text-base font-bold text-[#203c37]">Bảo vệ quyền lợi khách thuê</h3>
              <p className="text-[13px] text-[#74817b] leading-relaxed">
                Đội ngũ hỗ trợ giải quyết sự cố, bảo trì và hòa giải tranh chấp 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. TENANT TESTIMONIAL (Figma Node 44:62254, h 321px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-[#f7f6f2] border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-2">
            <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
              CÂU CHUYỆN KHÁCH THUÊ
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#203c37]">
              Lắng nghe cảm nhận từ những bạn trẻ đã tìm được phòng
            </h2>
            <div className="pt-2">
              <Badge variant="success" size="md">
                100% ĐÁNH GIÁ THỰC TẾ
              </Badge>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-[16px] border border-[#e2e7e1] shadow-xs space-y-4">
            <p className="text-[15px] sm:text-[16px] text-[#203c37] italic leading-relaxed">
              &ldquo;Tìm phòng qua 5K-Rental Manager thực sự rất nhanh và yên tâm. Mọi hình ảnh đều đúng thực tế, không có tình trạng kê giá hay đổi phòng phút chót. Tính năng ghép bạn cùng phòng cũng giúp mình tìm được một bạn học cùng ngành rất hợp tính.&rdquo;
            </p>

            <div className="flex items-center gap-3 pt-2">
              <div className="size-11 rounded-full bg-[#15594f] text-white font-bold flex items-center justify-center text-[13px]">
                HN
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-[#203c37]">Hoàng Nam</h3>
                <p className="text-[12px] text-[#74817b]">Sinh viên năm 3 ĐH Ngoại Thương — Thuê phòng tại Q. Bình Thạnh</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. FREQUENTLY ASKED QUESTIONS (Figma Node 44:62268, h 395px)
      ========================================================================== */}
      <section className="py-16 px-6 lg:px-16 bg-white border-b border-[#e2e7e1]">
        <div className="max-w-[1312px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-2">
            <span className="text-[11px] font-bold tracking-wider text-[#15594f] uppercase">
              GIẢI ĐÁP THẮC MẮC
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#203c37]">
              Câu hỏi thường gặp
            </h2>
            <p className="text-[14px] text-[#74817b] leading-relaxed">
              Mọi điều bạn cần biết về quy trình tìm phòng, đặt lịch xem và ký hợp đồng thuê trên 5K-Rental Manager.
            </p>
          </div>

          <div className="lg:col-span-7 space-y-3">
            {faqs.map((f, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={f.q}
                  className="rounded-[10px] border border-[#e2e7e1] overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between text-left gap-4 bg-[#f7f6f2]/50 hover:bg-[#f7f6f2] transition-colors cursor-pointer"
                  >
                    <span className="text-[14px] font-semibold text-[#203c37]">
                      {f.q}
                    </span>
                    {isOpen ? (
                      <Minus className="size-4 text-[#15594f] shrink-0" />
                    ) : (
                      <Plus className="size-4 text-[#74817b] shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-1 bg-white text-[13px] text-[#74817b] leading-relaxed border-t border-[#e2e7e1]">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. BOTTOM CTA BANNER (Figma Node 44:62297, h 221px)
      ========================================================================== */}
      <section className="py-14 px-6 lg:px-16 bg-[#15594f] text-white">
        <div className="max-w-[1312px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Sẵn sàng tìm không gian sống lý tưởng?
            </h2>
            <p className="text-[14px] text-[#e3ece6] max-w-xl">
              Gia nhập cùng hơn 12,000+ người thuê và chủ nhà thông thái trên 5K-Rental Manager ngay hôm nay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/rooms">
              <Button
                variant="outline"
                size="lg"
                className="bg-white text-[#15594f] hover:bg-[#eaf2ed] border-transparent font-bold text-[15px]"
                rightIcon={<ArrowRight className="size-4" />}
              >
                Bắt đầu tìm phòng ngay
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
