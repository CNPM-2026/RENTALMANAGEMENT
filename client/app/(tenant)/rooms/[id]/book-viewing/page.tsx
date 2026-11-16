"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";

const TIME_SLOTS = [
  "09:00 - 10:00",
  "10:30 - 11:30",
  "14:00 - 15:00",
  "16:00 - 17:00",
  "18:00 - 19:00",
];

function BookViewingContent() {
  const params = useParams();
  const router = useRouter();
  const rawId = (params?.id as string) || "";

  // Room / Post loaded info
  const [roomData, setRoomData] = React.useState<{
    id: string;
    postId?: string;
    title: string;
    address: string;
    price: number;
    landlordName: string;
    landlordPhone: string;
  }>({
    id: rawId,
    title: "Phòng cho thuê chất lượng cao",
    address: "Đang tải thông tin địa chỉ...",
    price: 4500000,
    landlordName: "Chủ trọ",
    landlordPhone: "0912 345 678",
  });

  // Selected Date & Time Slot
  const [selectedDate, setSelectedDate] = React.useState<number>(18);
  const [selectedSlot, setSelectedSlot] = React.useState<string>("16:00 - 17:00");

  // Contact Info
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [note, setNote] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState(true);

  // Status
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Calendar logic for current month
  const currentMonthName = "Tháng 11, 2026";
  const daysInMonth = Array.from({ length: 30 }, (_, i) => i + 1);

  React.useEffect(() => {
    async function loadData() {
      // 1. Preload user profile if logged in
      try {
        const user = await apiClient.auth.getMe();
        if (user) {
          if (user.fullName) setFullName(user.fullName);
          if (user.phone) setPhone(user.phone);
          if (user.email) setEmail(user.email);
        }
      } catch {
        // Fallback for unauthenticated viewer
        setFullName("Khách thuê phòng");
        setPhone("0987654321");
      }

      // 2. Load room / post info
      if (rawId) {
        try {
          const roomRes = await apiClient.rooms.getById(rawId) as any;
          const room = roomRes?.data || roomRes;
          if (room?.id) {
            setRoomData({
              id: room.id,
              title: `Phòng ${room.roomNumber} — ${room.property?.name || "Nhà trọ"}`,
              address: room.property ? `${room.property.address}, ${room.property.ward}, ${room.property.district}` : "Khu vực trung tâm",
              price: Number(room.priceMonthly) || 0,
              landlordName: room.property?.landlord?.fullName || "Chủ nhà trọ",
              landlordPhone: room.property?.landlord?.phone || "0912 345 678",
            });
            return;
          }
        } catch {}

        try {
          const postRes = await apiClient.posts.getById(rawId) as any;
          const post = postRes?.data || postRes;
          if (post?.id) {
            setRoomData({
              id: post.roomId || post.id,
              postId: post.id,
              title: post.title,
              address: post.property ? `${post.property.address}, ${post.property.ward}, ${post.property.district}` : "Khu vực trung tâm",
              price: Number(post.price) || 0,
              landlordName: post.author?.fullName || "Chủ bài đăng",
              landlordPhone: post.author?.phone || "0912 345 678",
            });
            return;
          }
        } catch {}
      }
    }

    loadData();
  }, [rawId]);

  async function handleConfirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg("Vui lòng xác nhận cam kết đến đúng giờ hẹn.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const isUUID = (val?: string) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const targetRoomId = isUUID(roomData.id) ? roomData.id : undefined;
      const targetPostId = isUUID(roomData.postId) ? roomData.postId : undefined;

      const formattedDate = `2026-11-${String(selectedDate).padStart(2, "0")}T${selectedSlot.split(" - ")[0]}:00.000Z`;

      await apiClient.appointments.create({
        roomId: targetRoomId,
        postId: targetPostId,
        appointmentTime: formattedDate,
        note: `Liên hệ: ${fullName} (${phone}) - ${note || "Xem phòng trực tiếp"}`,
      });

      setSuccess(true);
      setTimeout(() => {
        router.push("/tenant/appointments");
      }, 1500);
    } catch (err: any) {
      const backendMessage = err?.data?.message || err?.message || "Không thể đặt lịch xem phòng. Vui lòng kiểm tra lại.";
      setErrorMsg(backendMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f6f2] text-[#203c37] py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-[1132px] mx-auto space-y-6">
        {/* =======================================================================
            1. BREADCRUMBS & PAGE HEADER
        ======================================================================== */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href={`/rooms/${rawId}`} className="hover:text-[#15594f]">
              Chi tiết phòng
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">Đặt lịch xem phòng</span>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight">
                Đặt lịch xem phòng trực tiếp
              </h1>
              <p className="text-[14px] text-[#74817b]">
                Chọn ngày giờ thuận tiện để chủ nhà đón tiếp và hướng dẫn xem phòng.
              </p>
            </div>
            <Link href={`/rooms/${rawId}`}>
              <Button variant="outline" size="sm" className="bg-white">
                Quay lại phòng
              </Button>
            </Link>
          </div>
        </div>

        {/* Success Banner */}
        {success && (
          <div className="p-4 rounded-[12px] bg-[#dcfce7] border border-[#86efac] flex items-center gap-3 text-[#166534]">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="text-[14px] font-semibold">
              Đặt lịch hẹn thành công! Đang chuyển hướng đến danh sách lịch hẹn của bạn...
            </p>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-4 rounded-[12px] bg-[#fee2e2] border border-[#fca5a5] flex items-center gap-3 text-[#991b1b]">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-[14px] font-medium">{errorMsg}</p>
          </div>
        )}

        {/* =======================================================================
            2. BOOKING FORM & SUMMARY
        ======================================================================== */}
        <form onSubmit={handleConfirmBooking} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: CALENDAR & FORM */}
          <div className="lg:col-span-8 space-y-6">
            {/* Step 1: Calendar Picker */}
            <div className="bg-white p-6 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#e2e7e1] pb-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-[#15594f]" />
                  <h2 className="text-[16px] font-bold text-[#203c37]">
                    1. Chọn ngày xem phòng
                  </h2>
                </div>
                <span className="text-[13px] font-bold text-[#15594f]">
                  {currentMonthName}
                </span>
              </div>

              {/* Day numbers grid */}
              <div className="grid grid-cols-7 gap-2">
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-bold text-[#74817b] py-1">
                    {d}
                  </div>
                ))}
                {daysInMonth.map((day) => {
                  const isSelected = day === selectedDate;
                  const isPast = day < 16;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPast}
                      onClick={() => setSelectedDate(day)}
                      className={`h-11 rounded-[8px] text-[13px] font-semibold transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? "bg-[#15594f] text-white shadow-xs font-bold"
                          : isPast
                          ? "text-[#c2c9c5] cursor-not-allowed bg-transparent"
                          : "hover:bg-[#eaf2ed] text-[#203c37]"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Step 2: Time Slot Selector */}
              <div className="pt-4 border-t border-[#e2e7e1] space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="size-4.5 text-[#15594f]" />
                  <h3 className="text-[14px] font-bold text-[#203c37]">
                    2. Chọn khung giờ hẹn
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = slot === selectedSlot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`h-[42px] px-3 rounded-[8px] text-[13px] font-semibold border transition-all cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? "bg-[#15594f] text-white border-[#15594f] shadow-xs"
                            : "bg-[#f7f6f2] text-[#203c37] border-[#e2e7e1] hover:border-[#15594f]/50"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 3: Contact Info & Notes */}
            <div className="bg-white p-6 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <h2 className="text-[16px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-3">
                3. Thông tin người xem phòng
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Họ và tên người xem"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<User className="size-4" />}
                />
                <Input
                  label="Số điện thoại liên hệ"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  leftIcon={<Phone className="size-4" />}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Ghi chú cho chủ trọ (Tùy chọn)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="VD: Tôi muốn xem thêm khu vực để xe máy và máy giặt chung..."
                  className="w-full p-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f]"
                />
              </div>

              {/* Commitment Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="size-4 accent-[#15594f] rounded-[4px] mt-0.5"
                  />
                  <span className="text-[13px] text-[#203c37] leading-relaxed">
                    Tôi cam kết sẽ đến đúng giờ hẹn. Trong trường hợp có việc bận đột xuất, tôi sẽ thông báo đổi lịch hoặc hủy hẹn trước ít nhất 2 tiếng.
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: BOOKING SUMMARY CARD */}
          <aside className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white p-5 rounded-[16px] border border-[#e2e7e1] shadow-lg space-y-4">
              <h3 className="text-[15px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-2.5">
                Tóm tắt lịch xem phòng
              </h3>

              {/* Room Card Mini */}
              <div className="space-y-1">
                <h4 className="text-[14px] font-bold text-[#203c37]">
                  {roomData.title}
                </h4>
                <p className="text-[12px] text-[#74817b] flex items-center gap-1">
                  <MapPin className="size-3.5 text-[#15594f] shrink-0" />
                  <span className="truncate">{roomData.address}</span>
                </p>
                <p className="text-[13px] font-bold text-[#15594f] pt-1">
                  {roomData.price > 0 ? `${roomData.price.toLocaleString("vi-VN")} đ/tháng` : "Thỏa thuận"}
                </p>
              </div>

              <div className="divide-y divide-[#e2e7e1] text-[13px]">
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Ngày hẹn</span>
                  <span className="font-bold text-[#203c37]">
                    {selectedDate} Tháng 11, 2026
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Khung giờ</span>
                  <span className="font-bold text-[#15594f]">{selectedSlot}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Người đón tiếp</span>
                  <span className="font-semibold text-[#203c37]">{roomData.landlordName}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Hotline hỗ trợ</span>
                  <span className="font-semibold text-[#203c37]">{roomData.landlordPhone}</span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full font-bold h-[48px] shadow-md"
              >
                Xác nhận đặt lịch xem phòng
              </Button>

              <p className="text-[11px] text-center text-[#74817b]">
                Không thu bất kỳ khoản phí nào khi xem phòng
              </p>
            </div>

            {/* Safety Notice */}
            <div className="p-3.5 rounded-[12px] bg-[#f2ede3]/70 border border-[#e2e7e1] flex items-start gap-2.5 text-[12px] text-[#203c37]">
              <ShieldCheck className="size-4.5 text-[#15594f] shrink-0 mt-0.5" />
              <span>
                <strong>5K-Rental Manager bảo chứng:</strong> Địa chỉ phòng và số điện thoại chủ nhà đã qua thẩm định thực tế.
              </span>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default function BookViewingPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải thông tin đặt lịch...
        </div>
      }
    >
      <BookViewingContent />
    </React.Suspense>
  );
}
