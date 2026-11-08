"use client";

import * as React from "react";
import Link from "next/link";
import {
  List,
  MapPin,
  SlidersHorizontal,
  Heart,
  ArrowUpRight,
  ZoomIn,
  ZoomOut,
  Compass,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Post } from "@/types/models";

interface MapRoom {
  id: string;
  title: string;
  price: number;
  formattedPrice: string;
  area: number;
  floor: number;
  hasBalcony: boolean;
  address: string;
  image: string;
  verified: boolean;
  xPercent: number; // For SVG map rendering
  yPercent: number;
  landmark: string;
}

const MAP_ROOMS: MapRoom[] = [];
/*
  {
    id: "studio-ban-mai",
    title: "Studio Ban Mai — Ban Công Hướng Đông",
    price: 4500000,
    formattedPrice: "4.5 tr",
    area: 28,
    floor: 3,
    hasBalcony: true,
    address: "142 Điện Biên Phủ, Phường 25, Bình Thạnh",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
    verified: true,
    xPercent: 38,
    yPercent: 42,
    landmark: "Gần ĐH Ngoại Thương (Cơ sở 2)",
  },
  {
    id: "can-ho-sunshine",
    title: "Căn Hộ Sunshine — Trung Tâm Quận 1",
    price: 6200000,
    formattedPrice: "6.2 tr",
    area: 35,
    floor: 5,
    hasBalcony: true,
    address: "88 Nguyễn Du, Phường Bến Nghé, Quận 1",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80",
    verified: true,
    xPercent: 28,
    yPercent: 68,
    landmark: "Gần Nhà thờ Đức Bà & Dinh Độc Lập",
  },
  {
    id: "gac-lung-thu-duc",
    title: "Phòng Trọ Gác Lửng Xanh — Giờ Tự Do",
    price: 3200000,
    formattedPrice: "3.2 tr",
    area: 22,
    floor: 2,
    hasBalcony: false,
    address: "24 Đường số 6, Linh Trung, TP. Thủ Đức",
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=80",
    verified: false,
    xPercent: 72,
    yPercent: 28,
    landmark: "Gần Làng Đại học Quốc gia",
  },
  {
    id: "mini-phu-nhuan",
    title: "Phòng Mini Hiện Đại — Sát Cầu Kiệu",
    price: 3800000,
    formattedPrice: "3.8 tr",
    area: 20,
    floor: 2,
    hasBalcony: false,
    address: "45 Phan Xích Long, Phường 2, Phú Nhuận",
    image: "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80",
    verified: true,
    xPercent: 22,
    yPercent: 34,
    landmark: "Phố ẩm thực Phan Xích Long",
  },
  {
    id: "studio-tan-binh",
    title: "Studio Cửa Sổ Lớn — Gần Sân Bay",
    price: 5000000,
    formattedPrice: "5.0 tr",
    area: 30,
    floor: 4,
    hasBalcony: true,
    address: "12 Bạch Đằng, Phường 2, Tân Bình",
    image: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80",
    verified: true,
    xPercent: 18,
    yPercent: 18,
    landmark: "Gần Công viên Gia Định & Sân bay TSN",
  },
  {
    id: "can-ho-quan-7",
    title: "Căn Hộ Dịch Vụ — Phú Mỹ Hưng",
    price: 7500000,
    formattedPrice: "7.5 tr",
    area: 42,
    floor: 7,
    hasBalcony: true,
    address: "102 Nguyễn Lương Bằng, Tân Phú, Quận 7",
    image: "https://images.unsplash.com/photo-1502005229762-ee1b2b81b858?auto=format&fit=crop&w=600&q=80",
    verified: true,
    xPercent: 54,
    yPercent: 82,
    landmark: "Gần Hồ Bán Nguyệt & Cầu Ánh Sao",
  },
];
*/

export default function RoomsMapPage() {
  const [rooms, setRooms] = React.useState<MapRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>("");
  const [activeFilter, setActiveFilter] = React.useState<string>("ALL");
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);

  React.useEffect(() => {
    apiClient.posts.getApproved().then((posts) => {
      const mapped = posts.map((post: Post, index) => ({
        id: post.id,
        title: post.title,
        price: post.room?.priceMonthly ?? post.price ?? 0,
        formattedPrice: `${((post.room?.priceMonthly ?? post.price ?? 0) / 1000000).toFixed(1)} tr`,
        area: post.room?.area ?? 0,
        floor: 0,
        hasBalcony: false,
        address: post.property?.address ?? "Địa chỉ đang cập nhật",
        image: post.images?.find((image) => image.isPrimary)?.imageUrl ?? post.images?.[0]?.imageUrl ?? "",
        verified: true,
        xPercent: 15 + ((index * 19) % 70),
        yPercent: 18 + ((index * 23) % 65),
        landmark: "Tin đăng đã được duyệt",
      }));
      setRooms(mapped);
      setSelectedRoomId(mapped[0]?.id ?? "");
    }).catch(() => setRooms([]));
  }, []);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  return (
    <div className="w-full h-[calc(100vh-88px)] flex flex-col bg-[#f7f6f2] text-[#203c37] overflow-hidden">
      {/* =======================================================================
          1. TOP FILTER BAR STRIP (Figma Node 44:62982)
      ======================================================================== */}
      <header className="h-[64px] bg-white border-b border-[#e2e7e1] px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">Bản đồ phòng trọ</span>
          </nav>

          <div className="h-4 w-px bg-[#e2e7e1] hidden md:block" />

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            {[
              { id: "ALL", label: "Tất cả mức giá" },
              { id: "UNDER_4M", label: "Dưới 4 triệu" },
              { id: "4M_6M", label: "4 - 6 triệu" },
              { id: "OVER_6M", label: "Trên 6 triệu" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1.5 rounded-[6px] text-[12px] font-medium transition-colors cursor-pointer ${
                  activeFilter === f.id
                    ? "bg-[#15594f] text-white shadow-xs"
                    : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Switch back to List View */}
        <Link href="/rooms">
          <Button
            variant="outline"
            size="sm"
            className="font-semibold"
            leftIcon={<List className="size-4" />}
          >
            Xem dạng danh sách
          </Button>
        </Link>
      </header>

      {/* =======================================================================
          2. MAIN INTERACTIVE MAP SPLIT LAYOUT (Figma Node 44:62995)
      ======================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* -------------------------------------------------------------------
            LEFT PANE: SCROLLABLE ROOM LIST (380px)
        -------------------------------------------------------------------- */}
        <div className="w-[380px] bg-white border-r border-[#e2e7e1] flex flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-[#e2e7e1] bg-[#f7f6f2]/50">
            <h2 className="text-[14px] font-bold text-[#203c37]">
              Phòng ở khu vực này ({rooms.length})
            </h2>
            <p className="text-[12px] text-[#74817b]">
              Nhấp vào ghim bản đồ hoặc thẻ phòng để đối chiếu vị trí
            </p>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {rooms.map((room) => {
              const isSelected = room.id === selectedRoomId;
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  className={`p-3 rounded-[12px] border transition-all cursor-pointer flex gap-3 ${
                    isSelected
                      ? "border-[#15594f] bg-[#eaf2ed]/40 shadow-sm ring-1 ring-[#15594f]"
                      : "border-[#e2e7e1] bg-white hover:border-[#15594f]/40 hover:bg-[#f7f6f2]/50"
                  }`}
                >
                  {/* Thumbnail */}
                  <img
                    src={room.image}
                    alt={room.title}
                    className="size-20 rounded-[8px] object-cover shrink-0"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-bold text-[#15594f]">
                        {formatCurrency(room.price, { showUnit: false })} đ
                      </span>
                      {room.verified && (
                        <Badge variant="success" size="sm">
                          Xác thực
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-[13px] font-semibold text-[#203c37] truncate">
                      {room.title}
                    </h3>
                    <p className="text-[11px] text-[#74817b] truncate">
                      {room.address}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-[#74817b]">
                        {room.area}m² • Tầng {room.floor}
                      </span>
                      <Link
                        href={`/rooms/${room.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#15594f] hover:underline"
                      >
                        Chi tiết <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* -------------------------------------------------------------------
            RIGHT PANE: INTERACTIVE MAP CANVAS WITH PRICE PINS (Figma 44:63046)
        -------------------------------------------------------------------- */}
        <div className="flex-1 relative bg-[#eef1ed] overflow-hidden flex items-center justify-center select-none">
          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white p-1 rounded-[8px] border border-[#e2e7e1] shadow-md">
            <button
              onClick={() => setZoomLevel((z) => Math.min(140, z + 15))}
              className="size-8 rounded-[6px] hover:bg-[#f7f6f2] flex items-center justify-center text-[#203c37] cursor-pointer"
              title="Phóng to"
            >
              <ZoomIn className="size-4" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
              className="size-8 rounded-[6px] hover:bg-[#f7f6f2] flex items-center justify-center text-[#203c37] cursor-pointer"
              title="Thu nhỏ"
            >
              <ZoomOut className="size-4" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="size-8 rounded-[6px] hover:bg-[#f7f6f2] flex items-center justify-center text-[#15594f] cursor-pointer"
              title="Đặt lại bản đồ"
            >
              <Compass className="size-4" />
            </button>
          </div>

          {/* SVG Map Background simulating Saigon River & Major Roads */}
          <div
            className="w-full h-full relative transition-transform duration-300"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 1000 700"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Land Background */}
              <rect width="1000" height="700" fill="#f4f5f1" />

              {/* Park Areas */}
              <rect x="120" y="80" width="160" height="120" rx="20" fill="#e0eedf" />
              <text x="140" y="140" fill="#4f7356" fontSize="11" fontWeight="600">
                Công viên Gia Định
              </text>

              <rect x="520" y="520" width="180" height="110" rx="20" fill="#e0eedf" />
              <text x="540" y="580" fill="#4f7356" fontSize="11" fontWeight="600">
                Khu Đô Thị Phú Mỹ Hưng
              </text>

              {/* Saigon River Vector Curve */}
              <path
                d="M 60 -50 C 180 80 340 120 420 280 C 490 420 460 550 780 750"
                stroke="#cce5f0"
                strokeWidth="70"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 60 -50 C 180 80 340 120 420 280 C 490 420 460 550 780 750"
                stroke="#b9dff0"
                strokeWidth="56"
                strokeLinecap="round"
                fill="none"
              />

              {/* Major Roads Grid */}
              {/* Điện Biên Phủ */}
              <path d="M 0 320 L 1000 320" stroke="#e2e7e1" strokeWidth="8" />
              <text x="40" y="312" fill="#74817b" fontSize="11" fontWeight="500">
                Đại lộ Điện Biên Phủ
              </text>

              {/* Phạm Văn Đồng */}
              <path d="M 50 120 L 950 480" stroke="#e2e7e1" strokeWidth="10" />
              <text x="220" y="195" fill="#74817b" fontSize="11" fontWeight="500">
                Đường Phạm Văn Đồng
              </text>

              {/* Xa lộ Hà Nội */}
              <path d="M 380 280 L 1000 150" stroke="#e2e7e1" strokeWidth="10" />
              <text x="560" y="240" fill="#74817b" fontSize="11" fontWeight="500">
                Xa Lộ Hà Nội — Tuyến Metro Số 1
              </text>

              {/* Landmark Labels */}
              <circle cx="360" cy="300" r="4" fill="#15594f" />
              <text x="370" y="304" fill="#203c37" fontSize="12" fontWeight="700">
                Cầu Sài Gòn
              </text>

              <circle cx="280" cy="500" r="4" fill="#15594f" />
              <text x="290" y="504" fill="#203c37" fontSize="12" fontWeight="700">
                Hồ Con Rùa — Quận 1
              </text>
            </svg>

            {/* Interactive Room Price Pins on Map */}
            {rooms.map((room) => {
              const isSelected = room.id === selectedRoomId;
              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoomId(room.id)}
                  style={{
                    left: `${room.xPercent}%`,
                    top: `${room.yPercent}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 z-10 ${
                    isSelected ? "scale-115 z-30" : "hover:scale-110"
                  }`}
                >
                  {/* Pin Bubble */}
                  <div
                    className={`px-3 py-1.5 rounded-[100px] font-bold text-[13px] shadow-lg flex items-center gap-1.5 transition-colors border ${
                      isSelected
                        ? "bg-[#15594f] text-white border-white ring-4 ring-[#15594f]/25"
                        : "bg-white text-[#203c37] border-[#e2e7e1] hover:border-[#15594f]"
                    }`}
                  >
                    <Building className="size-3.5 shrink-0" />
                    <span>{room.formattedPrice}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Room Floating Preview Card at Bottom Right */}
          {selectedRoom && (
            <div className="absolute bottom-6 right-6 w-80 bg-white p-4 rounded-[14px] border border-[#e2e7e1] shadow-xl z-20 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="relative w-full h-36 rounded-[8px] overflow-hidden bg-gray-100">
                <img
                  src={selectedRoom.image}
                  alt={selectedRoom.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <Badge variant="success" size="sm">
                    {selectedRoom.landmark}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-[14px] font-bold text-[#203c37] line-clamp-1">
                  {selectedRoom.title}
                </h3>
                <p className="text-[12px] text-[#74817b] line-clamp-1">
                  {selectedRoom.address}
                </p>
              </div>

              <div className="pt-2 border-t border-[#e2e7e1] flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-[#15594f]">
                    {formatCurrency(selectedRoom.price, { showUnit: false })} đ
                  </span>
                  <span className="text-[11px] text-[#74817b]">/tháng</span>
                </div>

                <Link href={`/rooms/${selectedRoom.id}`}>
                  <Button variant="primary" size="sm" className="font-semibold">
                    Xem phòng
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
