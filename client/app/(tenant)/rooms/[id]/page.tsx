"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  MapPin,
  Heart,
  Share2,
  BadgeCheck,
  Maximize2,
  Users,
  BedDouble,
  Sun,
  ShieldCheck,
  Info,
  CalendarDays,
  FileCheck,
  MessageCircle,
  Star,
  CheckCircle2,
  ExternalLink,
  Flag,
  Images,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80",
];

function RoomDetailContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || "";

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<{
    title: string;
    description: string;
    price: number;
    deposit: number;
    area: number;
    maxOccupants: number;
    roomNumber: string;
    propertyName: string;
    fullAddress: string;
    province: string;
    district: string;
    images: string[];
    roomAmenities: string[];
    propertyAmenities: string[];
    landlord: {
      name: string;
      phone: string;
      email?: string;
      avatar?: string;
    };
    rules?: string;
    status?: string;
    roomId?: string;
    postId?: string;
  } | null>(null);

  const [isSaved, setIsSaved] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [copiedShare, setCopiedShare] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!rawId) {
        setLoading(false);
        return;
      }
      setLoading(true);

      // 1. Try to fetch as a Room first
      try {
        const roomRes = await apiClient.rooms.getById(rawId) as any;
        const room = roomRes?.data || roomRes;
        if (room && room.id && isMounted) {
          const prop = room.property;
          const host = prop?.landlord;
          const imagesList: string[] = [];

          if (room.posts && room.posts.length > 0) {
            room.posts.forEach((p: any) => {
              if (p.images && p.images.length > 0) {
                p.images.forEach((img: any) => imagesList.push(img.imageUrl));
              }
            });
          }
          if (prop?.images && prop.images.length > 0) {
            prop.images.forEach((img: any) => imagesList.push(img.imageUrl));
          }

          const rAmenities = (room.roomAmenities || [])
            .map((ra: any) => ra.amenity?.name || ra.name)
            .filter(Boolean);

          const pAmenities = (prop?.propertyAmenities || [])
            .map((pa: any) => pa.amenity?.name || pa.name)
            .filter(Boolean);

          setData({
            title: `Phòng ${room.roomNumber} — ${prop?.name || "Nhà trọ cao cấp"}`,
            description: prop?.description || "Phòng trọ được trang bị đầy đủ tiện nghi, môi trường sống an ninh, văn minh và yên tĩnh.",
            price: Number(room.priceMonthly) || 0,
            deposit: Number(room.depositAmount) || Number(room.priceMonthly) || 0,
            area: Number(room.area) || 25,
            maxOccupants: Number(room.maxOccupants) || 2,
            roomNumber: room.roomNumber,
            propertyName: prop?.name || "Nhà trọ",
            fullAddress: prop ? `${prop.address}, ${prop.ward}, ${prop.district}, ${prop.province}` : "Đang cập nhật địa chỉ",
            province: prop?.province || "",
            district: prop?.district || "",
            images: imagesList.length > 0 ? imagesList : DEFAULT_IMAGES,
            roomAmenities: rAmenities.length > 0 ? rAmenities : ["Điều hòa nhiệt độ", "Bình nóng lạnh", "Giường nệm", "Tủ quần áo"],
            propertyAmenities: pAmenities.length > 0 ? pAmenities : ["Bảo vệ 24/7", "Camera an ninh", "Bãi giữ xe", "Giờ giấc tự do"],
            landlord: {
              name: host?.fullName || "Chủ nhà trọ",
              phone: host?.phone || "0912 345 678",
              email: host?.email,
              avatar: host?.avatarUrl,
            },
            rules: prop?.rules || "Giữ gìn vệ sinh chung, không làm ồn sau 23h.",
            status: room.status,
            roomId: room.id,
          });
          setLoading(false);
          return;
        }
      } catch {
        // Not a room or failed, continue to check if it's a post
      }

      // 2. Try to fetch as a Post
      try {
        const postRes = await apiClient.posts.getById(rawId) as any;
        const post = postRes?.data || postRes;
        if (post && post.id && isMounted) {
          const prop = post.property;
          const room = post.room;
          const host = post.author || prop?.landlord;
          const imagesList: string[] = (post.images || []).map((img: any) => img.imageUrl).filter(Boolean);

          const rAmenities = (room?.roomAmenities || [])
            .map((ra: any) => ra.amenity?.name || ra.name)
            .filter(Boolean);

          const pAmenities = (prop?.propertyAmenities || [])
            .map((pa: any) => pa.amenity?.name || pa.name)
            .filter(Boolean);

          setData({
            title: post.title,
            description: post.description,
            price: Number(post.price) || Number(room?.priceMonthly) || 0,
            deposit: Number(room?.depositAmount) || Number(post.price) || 0,
            area: Number(room?.area) || 28,
            maxOccupants: Number(room?.maxOccupants) || 2,
            roomNumber: room?.roomNumber || "Phòng cho thuê",
            propertyName: prop?.name || "Tòa nhà căn hộ",
            fullAddress: prop ? `${prop.address}, ${prop.ward}, ${prop.district}, ${prop.province}` : "Khu vực trung tâm thuận tiện",
            province: prop?.province || "",
            district: prop?.district || "",
            images: imagesList.length > 0 ? imagesList : DEFAULT_IMAGES,
            roomAmenities: rAmenities.length > 0 ? rAmenities : ["Điều hòa nhiệt độ", "Bình nóng lạnh", "Giường nệm", "Tủ quần áo"],
            propertyAmenities: pAmenities.length > 0 ? pAmenities : ["Thang máy", "Bảo vệ 24/7", "Camera an ninh", "Bãi để xe máy"],
            landlord: {
              name: host?.fullName || "Chủ bài đăng",
              phone: host?.phone || "0912 345 678",
              email: host?.email,
              avatar: host?.avatarUrl,
            },
            rules: prop?.rules || "Giữ gìn vệ sinh chung, tôn trọng không gian sống của mọi người.",
            status: post.status,
            roomId: room?.id || post.roomId,
            postId: post.id,
          });
          setLoading(false);
          return;
        }
      } catch {
        // Failed post fetch as well
      }

      // 3. Fallback demo data if not found or offline
      if (isMounted) {
        setData({
          title: "Studio Ban Mai — Ban Công Hướng Đông Thoáng Mát",
          description: "Studio Ban Mai tọa lạc tại tầng 3 của tòa nhà văn minh trên đường Điện Biên Phủ, Phường 25, Quận Bình Thạnh. Căn phòng được thiết kế theo phong cách tối giản hiện đại với cửa sổ kính lớn sát đất và ban công riêng biệt hướng Đông, giúp căn phòng luôn ngập tràn ánh sáng tự nhiên và gió mát.",
          price: 4500000,
          deposit: 4500000,
          area: 28,
          maxOccupants: 2,
          roomNumber: "BM-302",
          propertyName: "Tòa nhà Ban Mai",
          fullAddress: "142 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
          province: "TP. Hồ Chí Minh",
          district: "Bình Thạnh",
          images: DEFAULT_IMAGES,
          roomAmenities: [
            "Điều hòa không khí Inverter",
            "Tủ lạnh 2 cánh 150L",
            "Khu bếp nấu riêng biệt có hút mùi",
            "Ban công riêng phơi đồ thoáng",
            "Máy nước nóng tắm đứng khép kín",
            "Giường đệm 1m6 & tủ quần áo",
          ],
          propertyAmenities: [
            "Thang máy di chuyển tiện lợi",
            "Khóa vân tay ra vào cổng chính",
            "Camera giám sát an ninh 24/7",
            "Khu giặt sấy đồ chung trên sân thượng",
            "Nhà để xe máy tầng trệt miễn phí",
            "Giờ giấc tự do 24/24 không chung chủ",
          ],
          landlord: {
            name: "Nguyễn Minh An",
            phone: "0912 345 678",
          },
          rules: "Giờ giấc tự do, không hút thuốc trong phòng, giữ gìn vệ sinh chung.",
        });
        setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [rawId]);

  function handleShare() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 gap-3 text-[#74817b]">
        <Loader2 className="size-8 animate-spin text-[#15594f]" />
        <p className="text-[14px] font-medium">Đang tải chi tiết bài đăng...</p>
      </div>
    );
  }

  const roomInfo = data!;
  const targetId = roomInfo.roomId || roomInfo.postId || rawId;

  return (
    <div className="w-full min-h-screen bg-[#f7f6f2] text-[#203c37] py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-[1312px] mx-auto space-y-6">
        {/* =======================================================================
            1. BREADCRUMBS & TOP TITLE BAR
        ======================================================================== */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href="/rooms" className="hover:text-[#15594f]">
              Tìm phòng
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium truncate max-w-[300px]">
              {roomInfo.propertyName || roomInfo.title}
            </span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight">
                {roomInfo.title}
              </h1>
              <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
                <MapPin className="size-4 text-[#15594f] shrink-0" />
                <span>{roomInfo.fullAddress}</span>
              </div>
            </div>

            {/* Actions: Save & Share */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaved(!isSaved)}
                className="font-medium bg-white"
                leftIcon={
                  <Heart
                    className={`size-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`}
                  />
                }
              >
                {isSaved ? "Đã lưu" : "Lưu tin"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="font-medium bg-white"
                leftIcon={<Share2 className="size-4" />}
              >
                {copiedShare ? "Đã sao chép link" : "Chia sẻ"}
              </Button>
            </div>
          </div>

          {/* Verification Badge Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Badge variant="success" size="md">
              <BadgeCheck className="size-4 inline mr-1" />
              ĐÃ XÁC MINH THÔNG TIN & VỊ TRÍ
            </Badge>
            {roomInfo.roomNumber && (
              <span className="text-[12px] text-[#74817b]">
                Số phòng / Mã: <strong className="text-[#203c37]">{roomInfo.roomNumber}</strong>
              </span>
            )}
            {roomInfo.status && (
              <Badge variant={roomInfo.status === "APPROVED" || roomInfo.status === "AVAILABLE" ? "success" : "warning"} size="sm">
                Trạng thái: {roomInfo.status}
              </Badge>
            )}
          </div>
        </div>

        {/* =======================================================================
            2. PHOTO GALLERY (h 420px)
        ======================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[360px] sm:h-[420px] rounded-[16px] overflow-hidden border border-[#e2e7e1] shadow-xs bg-white">
          {/* Main Large Image */}
          <div
            className="lg:col-span-8 relative h-full cursor-pointer overflow-hidden group"
            onClick={() => {
              setActiveImageIndex(0);
              setGalleryOpen(true);
            }}
          >
            <img
              src={roomInfo.images[0] || DEFAULT_IMAGES[0]}
              alt={roomInfo.title}
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
          </div>

          {/* Side Thumbnail Grid */}
          <div className="hidden lg:grid lg:col-span-4 grid-rows-2 gap-3 h-full">
            <div
              className="relative h-full overflow-hidden cursor-pointer group"
              onClick={() => {
                setActiveImageIndex(1);
                setGalleryOpen(true);
              }}
            >
              <img
                src={roomInfo.images[1] || DEFAULT_IMAGES[1]}
                alt="Ảnh không gian phòng"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div
              className="relative h-full overflow-hidden cursor-pointer group"
              onClick={() => {
                setActiveImageIndex(2 % roomInfo.images.length);
                setGalleryOpen(true);
              }}
            >
              <img
                src={roomInfo.images[2] || DEFAULT_IMAGES[2]}
                alt="Ảnh góc phòng"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white backdrop-blur-[1px] group-hover:bg-black/50 transition-colors">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-white/20 backdrop-blur-md text-[13px] font-semibold">
                  <Images className="size-4" />
                  <span>Xem {roomInfo.images.length} ảnh</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            3. TWO-COLUMN DETAILS & STICKY CTA
        ======================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* -------------------------------------------------------------------
              LEFT COLUMN: SPECS, DESCRIPTION, AMENITIES, LOCATION
          -------------------------------------------------------------------- */}
          <div className="lg:col-span-8 space-y-6">
            {/* 4 Specs KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Maximize2 className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Diện tích
                </p>
                <p className="text-lg font-bold text-[#203c37]">{roomInfo.area} m²</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Users className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Sức chứa tối đa
                </p>
                <p className="text-lg font-bold text-[#203c37]">{roomInfo.maxOccupants} người</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <BedDouble className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Phòng số
                </p>
                <p className="text-lg font-bold text-[#203c37] truncate">{roomInfo.roomNumber}</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Building2 className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Cơ sở / Tòa nhà
                </p>
                <p className="text-lg font-bold text-[#203c37] truncate">{roomInfo.propertyName}</p>
              </div>
            </div>

            {/* Room Description */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-3">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Mô tả chi tiết
              </h2>
              <div className="text-[14px] text-[#203c37] leading-relaxed whitespace-pre-line">
                {roomInfo.description}
              </div>
            </div>

            {/* Amenities Grid: In-room vs Building Common Amenities */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Trang thiết bị & Tiện ích
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[14px]">
                {/* In-room Amenities */}
                <div className="space-y-3 p-4 rounded-[10px] bg-[#f7f6f2] border border-[#e2e7e1]">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#15594f]" />
                    <h3 className="text-[13px] font-bold text-[#15594f] uppercase tracking-wider">
                      Trong phòng riêng ({roomInfo.roomAmenities.length})
                    </h3>
                  </div>
                  <div className="space-y-2 text-[#203c37]">
                    {roomInfo.roomAmenities.length > 0 ? (
                      roomInfo.roomAmenities.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-[#15594f] shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-[#74817b] italic">Chưa cập nhật tiện ích riêng.</p>
                    )}
                  </div>
                </div>

                {/* Building Shared / Common Amenities */}
                <div className="space-y-3 p-4 rounded-[10px] bg-[#f7f6f2] border border-[#e2e7e1]">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-[#0284c7]" />
                    <h3 className="text-[13px] font-bold text-[#0284c7] uppercase tracking-wider">
                      Tiện ích chung tòa nhà ({roomInfo.propertyAmenities.length})
                    </h3>
                  </div>
                  <div className="space-y-2 text-[#203c37]">
                    {roomInfo.propertyAmenities.length > 0 ? (
                      roomInfo.propertyAmenities.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-[#0284c7] shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[13px] text-[#74817b] italic">Tòa nhà chưa cấu hình tiện ích chung.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Rules & Costs Breakdown */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Nội quy & Biểu phí hàng tháng
              </h2>
              <div className="divide-y divide-[#e2e7e1] text-[14px]">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền thuê phòng niêm yết</span>
                  <span className="font-bold text-[#15594f]">
                    {roomInfo.price > 0 ? `${roomInfo.price.toLocaleString("vi-VN")} đ/tháng` : "Thỏa thuận"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền đặt cọc</span>
                  <span className="font-bold text-[#15594f]">
                    {roomInfo.deposit > 0 ? `${roomInfo.deposit.toLocaleString("vi-VN")} đ` : "1 tháng tiền phòng"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Nội quy lưu trú</span>
                  <span className="font-medium text-[#203c37] max-w-[60%] text-right">
                    {roomInfo.rules}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-2.5 text-[12px] text-[#15594f]">
                <Info className="size-4 shrink-0" />
                <span>Tiền cọc được giữ an toàn và hoàn trả 100% khi thanh lý hợp đồng đúng cam kết.</span>
              </div>
            </div>

            {/* Location & Map Preview */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-[#203c37]">
                  Vị trí địa lý
                </h2>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(roomInfo.fullAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15594f] hover:underline"
                >
                  Mở Google Maps <ExternalLink className="size-3.5" />
                </a>
              </div>

              <div className="relative w-full h-[180px] rounded-[10px] overflow-hidden border border-[#e2e7e1] bg-[#eef1ed] flex items-center justify-center">
                <div className="text-center space-y-2 p-4">
                  <div className="size-10 rounded-full bg-[#15594f] text-white flex items-center justify-center mx-auto shadow-md">
                    <MapPin className="size-5" />
                  </div>
                  <p className="text-[14px] font-bold text-[#203c37]">
                    {roomInfo.fullAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------------
              RIGHT STICKY COLUMN: BOOKING & RENTAL APPLICATION CTA
          -------------------------------------------------------------------- */}
          <aside className="lg:col-span-4 sticky top-24 space-y-5">
            {/* Main Sticky Action Box */}
            <div className="bg-white p-6 rounded-[16px] border border-[#e2e7e1] shadow-lg space-y-5">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#15594f] uppercase tracking-wider">
                  GIÁ THUÊ NIÊM YẾT
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#15594f]">
                    {roomInfo.price > 0 ? `${roomInfo.price.toLocaleString("vi-VN")} đ` : "Thỏa thuận"}
                  </span>
                  <span className="text-[14px] text-[#74817b]">/ tháng</span>
                </div>
                <p className="text-[12px] text-[#74817b]">
                  Tiền cọc: {roomInfo.deposit > 0 ? `${roomInfo.deposit.toLocaleString("vi-VN")} đ` : "1 tháng tiền phòng"}
                </p>
              </div>

              <div className="h-px bg-[#e2e7e1]" />

              {/* Action Buttons */}
              <div className="space-y-3">
                <Link href={`/rooms/${targetId}/book-viewing`} className="block">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full font-bold shadow-md h-[48px]"
                    leftIcon={<CalendarDays className="size-4.5" />}
                  >
                    Đặt lịch xem phòng
                  </Button>
                </Link>

                <Link href={`/rooms/${targetId}/apply`} className="block">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full font-bold h-[48px] border border-[#d2e4d7]"
                    leftIcon={<FileCheck className="size-4.5" />}
                  >
                    Gửi yêu cầu thuê phòng
                  </Button>
                </Link>
              </div>

              <p className="text-[11px] text-center text-[#74817b]">
                Xem phòng hoàn toàn miễn phí • Không mất phí trung gian môi giới
              </p>
            </div>

            {/* Landlord Profile Card */}
            <div className="bg-white p-5 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-[#15594f] text-white font-bold flex items-center justify-center text-[15px] shadow-xs uppercase">
                  {roomInfo.landlord.name.substring(0, 2)}
                </div>
                <div className="space-y-0.5">
                  <h3 className="text-[14px] font-bold text-[#203c37]">
                    {roomInfo.landlord.name}
                  </h3>
                  <Badge variant="success" size="sm">
                    CHỦ NHÀ ĐÃ XÁC MINH
                  </Badge>
                </div>
              </div>

              <div className="divide-y divide-[#e2e7e1] text-[12px] pt-1">
                <div className="py-1.5 flex justify-between items-center">
                  <span className="text-[#74817b]">Số điện thoại</span>
                  <span className="font-semibold text-[#15594f] flex items-center gap-1">
                    <PhoneCall className="size-3" />
                    {roomInfo.landlord.phone}
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[#74817b]">Thời gian phản hồi</span>
                  <span className="font-semibold text-[#203c37]">Trong vòng 15 phút</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full font-medium"
                leftIcon={<MessageCircle className="size-4 text-[#15594f]" />}
                onClick={() => router.push(`/tenant/messages?contact=landlord&name=${encodeURIComponent(roomInfo.landlord.name)}`)}
              >
                Nhắn tin với chủ trọ
              </Button>
            </div>

            {/* Trust Assurance Card */}
            <div className="p-4 rounded-[12px] bg-[#f2ede3]/60 border border-[#e2e7e1] flex items-start gap-3">
              <ShieldCheck className="size-5 text-[#15594f] shrink-0 mt-0.5" />
              <div className="text-[12px] text-[#203c37] leading-relaxed">
                <strong className="block font-semibold">Cam kết an tâm 5K-Rental Manager</strong>
                Mọi thông tin liên hệ và hợp đồng đều được bảo chứng pháp lý, hỗ trợ giải quyết tranh chấp trong suốt thời hạn thuê.
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* =======================================================================
          4. PHOTO GALLERY MODAL LIGHTBOX
      ======================================================================== */}
      {galleryOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 cursor-pointer z-50"
            aria-label="Đóng thư viện ảnh"
          >
            <X className="size-7" />
          </button>

          <div className="relative max-w-4xl max-h-[80vh] flex items-center justify-center">
            <img
              src={roomInfo.images[activeImageIndex] || DEFAULT_IMAGES[0]}
              alt={`Ảnh chi tiết ${activeImageIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-[8px]"
            />

            {/* Prev Button */}
            <button
              onClick={() =>
                setActiveImageIndex((i) => (i === 0 ? roomInfo.images.length - 1 : i - 1))
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="size-6" />
            </button>

            {/* Next Button */}
            <button
              onClick={() =>
                setActiveImageIndex((i) => (i === roomInfo.images.length - 1 ? 0 : i + 1))
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer"
              aria-label="Ảnh kế tiếp"
            >
              <ChevronRight className="size-6" />
            </button>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {roomInfo.images.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveImageIndex(idx)}
                className={`size-2.5 rounded-full transition-all cursor-pointer ${
                  activeImageIndex === idx ? "bg-white w-6" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RoomDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải thông tin phòng...
        </div>
      }
    >
      <RoomDetailContent />
    </React.Suspense>
  );
}
