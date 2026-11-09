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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { apiClient, ApiError } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { Post } from "@/types/models";
import { formatCurrency } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";

function RoomDetailContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || "room-ban-mai-1";

  const [isSaved, setIsSaved] = React.useState(false);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [copiedShare, setCopiedShare] = React.useState(false);
  const [post, setPost] = React.useState<Post | null>(null);
  const [roomImages, setRoomImages] = React.useState<string[]>([]);
  const [reviewSummary, setReviewSummary] = React.useState<{ averageRating: number; totalReviews: number; reviews: import("@/types/models").Review[] } | null>(null);

  React.useEffect(() => {
    apiClient.posts.getById(roomId).then((value) => {
      setPost(value);
      setRoomImages(value.images?.map((image) => image.imageUrl) ?? []);
      void apiClient.reviews.getByTarget("POST", value.id).then(setReviewSummary).catch(() => setReviewSummary(null));
    }).catch(() => setPost(null));
  }, [roomId]);

  React.useEffect(() => {
    if (!getAuthToken()) return;
    apiClient.favorites.getMyFavorites()
      .then((items) => setIsSaved(items.some((item) => item.postId === roomId)))
      .catch((error) => {
        if (!(error instanceof ApiError && error.status === 403)) setIsSaved(false);
      });
  }, [roomId]);
  const roomName = post?.title ?? "Tin đăng";
  const roomAddress = post?.property?.address ?? "Chưa cập nhật địa chỉ";
  const ROOM_IMAGES = roomImages;

  function handleShare() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f6f2] text-[#203c37] py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-[1312px] mx-auto space-y-6">
        {/* =======================================================================
            1. BREADCRUMBS & TOP TITLE BAR (Figma Node 44:63105)
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
            <span className="text-[#203c37] font-medium">{roomName}</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight">
                {roomName}
              </h1>
              <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
                <MapPin className="size-4 text-[#15594f] shrink-0" />
                <span>{roomAddress}</span>
              </div>
            </div>

            {/* Actions: Save & Share */}
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!getAuthToken()) {
                    router.push("/login");
                    return;
                  }
                  const wasSaved = isSaved;
                  setIsSaved(!wasSaved);
                  apiClient.favorites.toggle(roomId).catch(() => setIsSaved(wasSaved));
                }}
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

          {/* Verification Badge Bar (Figma Node 44:63115) */}
          <div className="flex items-center gap-3 pt-2">
            <Badge variant="success" size="md">
              <BadgeCheck className="size-4 inline mr-1" />
              ĐÃ XÁC MINH PHÁP LÝ & VỊ TRÍ THỰC TẾ
            </Badge>
            <span className="text-[12px] text-[#74817b]">
              Cập nhật lần cuối: 2 ngày trước • Mã phòng: <strong className="text-[#203c37]">BM-302</strong>
            </span>
          </div>
        </div>

        {/* =======================================================================
            2. PHOTO GALLERY (Figma Node 44:63119, h 420px)
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
              src={roomImages[0] ?? "/images/default-room.svg"}
              alt={roomName}
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
                src={roomImages[1] ?? roomImages[0] ?? "/images/default-room.svg"}
                alt="Nội thất phòng"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div
              className="relative h-full overflow-hidden cursor-pointer group"
              onClick={() => {
                setActiveImageIndex(2);
                setGalleryOpen(true);
              }}
            >
              <img
                src={roomImages[2] ?? roomImages[0] ?? "/images/default-room.svg"}
                alt="Góc làm việc"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white backdrop-blur-[1px] group-hover:bg-black/50 transition-colors">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-white/20 backdrop-blur-md text-[13px] font-semibold">
                  <Images className="size-4" />
                  <span>Xem toàn bộ 5 ảnh</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            3. TWO-COLUMN DETAILS & STICKY CTA (Figma Node 44:63129)
        ======================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* -------------------------------------------------------------------
              LEFT COLUMN: SPECS, DESCRIPTION, AMENITIES, LOCATION (910px)
          -------------------------------------------------------------------- */}
          <div className="lg:col-span-8 space-y-6">
            {/* 4 Specs KPI Cards (Figma Node 44:63131) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Maximize2 className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Diện tích
                </p>
                <p className="text-lg font-bold text-[#203c37]">28 m²</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Users className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Sức chứa tối đa
                </p>
                <p className="text-lg font-bold text-[#203c37]">2 người</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <BedDouble className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Loại giường
                </p>
                <p className="text-lg font-bold text-[#203c37]">Giường đôi 1m6</p>
              </div>

              <div className="p-4 rounded-[12px] bg-white border border-[#e2e7e1] space-y-1 text-left">
                <Sun className="size-5 text-[#15594f]" />
                <p className="text-[11px] text-[#74817b] uppercase font-bold tracking-wider">
                  Hướng ban công
                </p>
                <p className="text-lg font-bold text-[#203c37]">Đông đón nắng</p>
              </div>
            </div>

            {/* Room Description (Figma Node 44:63144) */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-3">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Mô tả chi tiết căn phòng
              </h2>
              <div className="text-[14px] text-[#203c37] leading-relaxed space-y-3">
                <p>{post?.description || "Chủ trọ chưa cập nhật mô tả cho tin đăng này."}</p>
              </div>
            </div>

            {/* Amenities Grid (Figma Node 44:63148) */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Trang thiết bị & Tiện ích
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[14px]">
                {/* In-room Amenities */}
                <div className="space-y-2.5">
                  <h3 className="text-[13px] font-bold text-[#15594f] uppercase tracking-wider">
                    Trong phòng riêng
                  </h3>
                  <div className="space-y-2 text-[#203c37]">
                    {(post?.room?.roomAmenities ?? []).map((item) => (
                      <div key={`${item.roomId}-${item.amenityId}`} className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-[#15594f] shrink-0" />
                        <span>{item.amenity?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Building Shared Amenities */}
                <div className="space-y-2.5">
                  <h3 className="text-[13px] font-bold text-[#15594f] uppercase tracking-wider">
                    Tiện ích chung tòa nhà
                  </h3>
                  <div className="space-y-2 text-[#203c37]">
                    <p className="text-[#74817b]">Chưa cập nhật tiện ích chung.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Costs Breakdown Table (Figma Node 44:63159) */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <h2 className="text-[17px] font-bold text-[#203c37]">
                Biểu phí & Chi phí dịch vụ hàng tháng
              </h2>
              <div className="divide-y divide-[#e2e7e1] text-[14px]">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền thuê phòng cố định</span>
                  <span className="font-bold text-[#15594f]">{formatCurrency(Number(post?.room?.priceMonthly ?? post?.price ?? 0))}/tháng</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền điện sinh hoạt</span>
                  <span className="font-semibold text-[#203c37]">
                    {post?.room?.electricityRate ? `${formatCurrency(Number(post.room.electricityRate))} / kWh` : "Chưa cập nhật"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền nước sinh hoạt</span>
                  <span className="font-semibold text-[#203c37]">
                    {post?.room?.waterRate ? `${formatCurrency(Number(post.room.waterRate))} / m³` : "Chưa cập nhật"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Phí dịch vụ</span>
                  <span className="font-semibold text-[#203c37]">
                    {post?.room?.serviceFee ? `${formatCurrency(Number(post.room.serviceFee))} / tháng` : "Chưa cập nhật"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Internet cáp quang Wifi tốc độ cao</span>
                  <span className="font-semibold text-[#203c37]">
                    {post?.room?.internetFee ? `${formatCurrency(Number(post.room.internetFee))} / tháng` : "Chưa cập nhật"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Phí gửi xe</span>
                  <span className="font-semibold text-[#203c37]">
                    {post?.room?.parkingFee ? `${formatCurrency(Number(post.room.parkingFee))} / tháng` : "Chưa cập nhật"}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-[#203c37]">Tiền đặt cọc giữ phòng (Cam kết)</span>
                  <span className="font-bold text-[#15594f]">{formatCurrency(Number(post?.room?.priceMonthly ?? post?.price ?? 0))} (1 tháng tiền phòng)</span>
                </div>
              </div>

              <div className="p-3 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-2.5 text-[12px] text-[#15594f]">
                <Info className="size-4 shrink-0" />
                <span>Tiền cọc được giữ an toàn và hoàn trả 100% khi thanh lý hợp đồng đúng hạn.</span>
              </div>
            </div>

            {/* Location & Map Preview (Figma Node 44:63183) */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-[#203c37]">
                  Vị trí & Tiện ích lân cận
                </h2>
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#15594f] hover:underline"
                >
                  Mở Google Maps <ExternalLink className="size-3.5" />
                </a>
              </div>

              {/* Map Illustration Container */}
              <div className="relative w-full h-[220px] rounded-[10px] overflow-hidden border border-[#e2e7e1] bg-[#eef1ed] flex items-center justify-center">
                <div className="text-center space-y-2 p-4">
                  <div className="size-10 rounded-full bg-[#15594f] text-white flex items-center justify-center mx-auto shadow-md">
                    <MapPin className="size-5" />
                  </div>
                  <p className="text-[13px] font-bold text-[#203c37]">
                    {roomAddress}
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    500m đến ĐH Ngoại Thương • 700m đến ĐH HUTECH • 5 phút đến Landmark 81
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] text-[#74817b]">
                  Nếu phát hiện tin giả mạo hoặc sai lệch địa chỉ, vui lòng báo cáo.
                </span>
                <Link href={`/tenant/safety/report?targetType=POST&targetId=${encodeURIComponent(post?.id ?? "")}&targetUrl=${encodeURIComponent(`/rooms/${roomId}`)}`}>
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#991b1b] hover:underline">
                    <Flag className="size-3" />
                    Báo cáo tin đăng
                  </span>
                </Link>
              </div>
            </div>

            {/* Tenant Reviews Section */}
            <div className="p-6 rounded-[14px] bg-white border border-[#e2e7e1] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[17px] font-bold text-[#203c37]">
                    Đánh giá từ khách thuê trước
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="size-4 fill-amber-500 text-amber-500" />
                      ))}
                    </div>
                    <span className="text-[14px] font-bold text-[#203c37]">{(reviewSummary?.averageRating ?? 0).toFixed(1)} / 5.0</span>
                    <span className="text-[12px] text-[#74817b]">({reviewSummary?.totalReviews ?? 0} đánh giá)</span>
                  </div>
                </div>
              </div>

              {/* Sample Review */}
              {reviewSummary?.reviews.map((review) => <div key={review.id} className="pt-3 border-t border-[#e2e7e1] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar src={review.reviewer?.avatarUrl} alt={review.reviewer?.fullName ?? "Người thuê"} className="size-8 rounded-full object-cover" />
                    <div>
                      <h4 className="text-[13px] font-bold text-[#203c37]">{review.reviewer?.fullName ?? "Người thuê"}</h4>
                      <p className="text-[11px] text-[#74817b]">{new Date(review.createdAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-[#74817b]">{review.rating}/5</span>
                </div>
                <p className="text-[13px] text-[#203c37] leading-relaxed">
                  {review.comment ?? "Người thuê chưa để lại nội dung đánh giá."}
                </p>
              </div>)}
            </div>
          </div>

          {/* -------------------------------------------------------------------
              RIGHT STICKY COLUMN: BOOKING & RENTAL APPLICATION CTA (370px)
          -------------------------------------------------------------------- */}
          <aside className="lg:col-span-4 sticky top-24 space-y-5">
            {/* Main Sticky Action Box (Figma Node 44:63195) */}
            <div className="bg-white p-6 rounded-[16px] border border-[#e2e7e1] shadow-lg space-y-5">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#15594f] uppercase tracking-wider">
                  GIÁ THUÊ NIÊM YẾT
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#15594f]">
                    {formatCurrency(Number(post?.room?.priceMonthly ?? post?.price ?? 0))}
                  </span>
                  <span className="text-[14px] text-[#74817b]">/ tháng</span>
                </div>
                <p className="text-[12px] text-[#74817b]">
                  Tiền cọc: 1 tháng tiền phòng ({formatCurrency(Number(post?.room?.priceMonthly ?? post?.price ?? 0))})
                </p>
              </div>

              <div className="h-px bg-[#e2e7e1]" />

              {/* Action Buttons */}
              <div className="space-y-3">
                {post?.status === "APPROVED" && (
                  <>
                    <Link href={`/rooms/${roomId}/book-viewing`} className="block">
                      <Button variant="primary" size="lg" className="w-full font-bold shadow-md h-[48px]" leftIcon={<CalendarDays className="size-4.5" />}>
                        Đặt lịch xem phòng
                      </Button>
                    </Link>
                    <Link href={`/rooms/${roomId}/apply`} className="block">
                      <Button variant="secondary" size="lg" className="w-full font-bold h-[48px] border border-[#d2e4d7]" leftIcon={<FileCheck className="size-4.5" />}>
                        Gửi yêu cầu thuê phòng
                      </Button>
                    </Link>
                  </>
                )}
              </div>

              <p className="text-[11px] text-center text-[#74817b]">
                Xem phòng hoàn toàn miễn phí • Không mất phí trung gian môi giới
              </p>
            </div>

            {/* Landlord Profile Card (Figma Node 44:63208) */}
            <div className="bg-white p-5 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <Avatar src={post?.author?.avatarUrl} alt={post?.author?.fullName ?? "Chủ trọ"} className="size-12 rounded-full object-cover shadow-xs" />
                <div className="space-y-0.5">
                  <h3 className="text-[14px] font-bold text-[#203c37]">
                    {post?.author?.fullName ?? "Chủ trọ"}
                  </h3>
                  <Badge variant="success" size="sm">
                    CHỦ TRỌ ĐÃ XÁC MINH KYC
                  </Badge>
                </div>
              </div>

              <div className="divide-y divide-[#e2e7e1] text-[12px] pt-1">
                <div className="py-1.5 flex justify-between">
                  <span className="text-[#74817b]">Tỷ lệ phản hồi</span>
                  <span className="font-semibold text-[#203c37]">98%</span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[#74817b]">Thời gian phản hồi</span>
                  <span className="font-semibold text-[#203c37]">Trong vòng 15 phút</span>
                </div>
              </div>

              {post?.status === "APPROVED" && <Button
                variant="outline"
                size="sm"
                className="w-full font-medium"
                leftIcon={<MessageCircle className="size-4 text-[#15594f]" />}
                onClick={async () => {
                  if (!post?.author?.id) return;
                  const conversation = await apiClient.chats.getOrCreateConversationWithUser(post.author.id);
                  router.push(`/tenant/messages?conversation=${conversation.id}`);
                }}
              >
                Nhắn tin với chủ trọ
              </Button>}
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
              src={ROOM_IMAGES[activeImageIndex]}
              alt={`Ảnh chi tiết ${activeImageIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-[8px]"
            />

            {/* Prev Button */}
            <button
              onClick={() =>
                setActiveImageIndex((i) => (i === 0 ? ROOM_IMAGES.length - 1 : i - 1))
              }
              className="absolute left-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="size-6" />
            </button>

            {/* Next Button */}
            <button
              onClick={() =>
                setActiveImageIndex((i) => (i === ROOM_IMAGES.length - 1 ? 0 : i + 1))
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer"
              aria-label="Ảnh kế tiếp"
            >
              <ChevronRight className="size-6" />
            </button>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-2 mt-4">
            {ROOM_IMAGES.map((_, idx) => (
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
