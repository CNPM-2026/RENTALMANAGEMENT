"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  IdCard,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Send,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { Post, Appointment } from "@/types/models";

function ApplyRentalContent() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.id as string) || "room-ban-mai-1";

  // Form State
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [citizenId, setCitizenId] = React.useState("");
  const [email, setEmail] = React.useState("");

  const [moveInDate, setMoveInDate] = React.useState("");
  const [leaseTermMonths, setLeaseTermMonths] = React.useState<number>(12);
  const [occupantsCount, setOccupantsCount] = React.useState<number>(1);
  const [motorcyclesCount, setMotorcyclesCount] = React.useState<number>(1);
  const [hasPet, setHasPet] = React.useState<boolean>(false);
  const [occupation, setOccupation] = React.useState("");
  const [note, setNote] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState<boolean>(false);

  const [loading, setLoading] = React.useState<boolean>(false);
  const [success, setSuccess] = React.useState<boolean>(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [roomPrice, setRoomPrice] = React.useState(0);
  const [post, setPost] = React.useState<Post | null>(null);
  const [roomIdForRequest, setRoomIdForRequest] = React.useState("");

  // Appointment check state
  const [checkingAppointment, setCheckingAppointment] = React.useState(true);
  const [hasCompletedVisit, setHasCompletedVisit] = React.useState(false);
  const [relevantAppointment, setRelevantAppointment] = React.useState<Appointment | null>(null);

  React.useEffect(() => {
    const initializationTimer = window.setTimeout(() => {
      const user = getCurrentUser();
      if (user) {
        setFullName(user.fullName ?? "");
        setPhone(user.phone ?? "");
        setEmail(user.email ?? "");
      }

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setMoveInDate(tomorrow.toISOString().slice(0, 10));
    }, 0);

    // Load post info
    void apiClient.posts
      .getById(roomId)
      .then((loadedPost) => {
        setPost(loadedPost);
        setRoomPrice(Number(loadedPost.room?.priceMonthly ?? loadedPost.price ?? 0));
        setRoomIdForRequest(loadedPost.room?.id ?? "");
      })
      .catch(() => {
        setPost(null);
        setRoomPrice(0);
        setRoomIdForRequest("");
      });

    // Check if tenant has CONFIRMED or COMPLETED appointment for this room/post
    void apiClient.appointments
      .getMyAppointments()
      .then((appointments) => {
        // Look for appointment for this post or the room associated with the post
        const qualifyingAppt = appointments.find((appt) => {
          const matchesPost = appt.postId === roomId;
          const isQualified =
            appt.status === "CONFIRMED" || appt.status === "COMPLETED";
          return matchesPost && isQualified;
        });
        if (qualifyingAppt) {
          setHasCompletedVisit(true);
          setRelevantAppointment(qualifyingAppt);
        } else {
          setHasCompletedVisit(false);
        }
      })
      .catch(() => {
        // If we can't check, default to blocking (safer)
        setHasCompletedVisit(false);
      })
      .finally(() => {
        setCheckingAppointment(false);
      });

    return () => window.clearTimeout(initializationTimer);
  }, [roomId]);

  // Financial summary
  const monthlyRent = roomPrice;
  const depositAmount = monthlyRent;
  const totalFirstMonth = monthlyRent + depositAmount;

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    if (!hasCompletedVisit) {
      setErrorMsg("Bạn cần đặt lịch và xem phòng trực tiếp trước khi gửi yêu cầu thuê.");
      return;
    }
    if (!agreeTerms) {
      setErrorMsg("Vui lòng đồng ý với cam kết xác thực thông tin thuê phòng.");
      return;
    }
    if (!roomIdForRequest) {
      setErrorMsg("Không xác định được phòng cần thuê. Vui lòng quay lại trang phòng và thử lại.");
      return;
    }
    const selectedDate = new Date(`${moveInDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!moveInDate || Number.isNaN(selectedDate.getTime()) || selectedDate <= today) {
      setErrorMsg("Ngày dọn vào phải sau ngày hiện tại.");
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const details = [
        occupation.trim() ? `Nghề nghiệp: ${occupation.trim()}` : "",
        `Xe máy: ${motorcyclesCount}`,
        `Thú cưng: ${hasPet ? "Có" : "Không"}`,
        note.trim(),
      ].filter(Boolean).join(" | ");
      await apiClient.rentalRequests.create({
        roomId: roomIdForRequest,
        moveInDate,
        leaseTermMonths,
        occupantsCount,
        note: details || undefined,
      });
      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        router.push("/tenant/rental-requests");
      }, 1500);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Không thể gửi yêu cầu thuê phòng.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f6f2] text-[#203c37] py-8 px-4 sm:px-6 lg:px-12">
      <div className="max-w-[1132px] mx-auto space-y-6">
        {/* =======================================================================
            1. BREADCRUMBS & PAGE HEADER (Figma Node 44:64878)
        ======================================================================== */}
        <div className="space-y-1">
          <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f]">
              Trang chủ
            </Link>
            <span>/</span>
            <Link href={`/rooms/${roomId}`} className="hover:text-[#15594f]">
              {post?.title ?? "Phòng thuê"}
            </Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">Gửi yêu cầu thuê</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#203c37] tracking-tight pt-1">
            Gửi yêu cầu thuê phòng
          </h1>
          <p className="text-[14px] text-[#74817b]">
            Điền thông tin dự kiến thuê để chủ trọ xét duyệt hồ sơ và chuẩn bị hợp đồng điện tử
          </p>
        </div>

        {/* Success Alert */}
        {success && (
          <div className="p-4 rounded-[12px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-3 text-[#15594f]">
            <CheckCircle2 className="size-5 shrink-0" />
            <div className="text-[13px]">
              <strong className="font-semibold block">Gửi yêu cầu thuê phòng thành công!</strong>
              Hồ sơ của bạn đã được chuyển đến chủ trọ. Đang chuyển hướng đến trang Theo dõi yêu cầu thuê...
            </div>
          </div>
        )}

        {/* Appointment Check Banner */}
        {!checkingAppointment && !hasCompletedVisit && !success && (
          <div className="p-5 rounded-[14px] bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-semibold text-amber-800">
                  Bạn chưa xem phòng trực tiếp
                </p>
                <p className="text-[13px] text-amber-700 mt-0.5 leading-relaxed">
                  Để đảm bảo quyền lợi, bạn cần đặt lịch và xem phòng thực tế trước khi gửi yêu cầu thuê. Chủ trọ cần xác nhận lịch hẹn của bạn.
                </p>
              </div>
            </div>
            <Link href={`/rooms/${roomId}/book-viewing`} className="shrink-0">
              <Button
                variant="primary"
                size="md"
                leftIcon={<CalendarCheck className="size-4" />}
                className="whitespace-nowrap"
              >
                Đặt lịch xem phòng
              </Button>
            </Link>
          </div>
        )}

        {/* Appointment Confirmed Banner */}
        {!checkingAppointment && hasCompletedVisit && relevantAppointment && !success && (
          <div className="p-4 rounded-[12px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-3 text-[#15594f]">
            <CalendarCheck className="size-5 shrink-0" />
            <div className="text-[13px]">
              <strong className="font-semibold block">Đã xác nhận xem phòng</strong>
              Lịch hẹn xem phòng của bạn đã được chủ trọ{" "}
              {relevantAppointment.status === "COMPLETED" ? "hoàn tất" : "xác nhận"}. Bạn có thể gửi yêu cầu thuê phòng.
            </div>
          </div>
        )}

        {/* =======================================================================
            2. TWO-COLUMN APPLICATION FORM (Figma Node 44:64885)
        ======================================================================== */}
        <form onSubmit={handleSubmitApplication} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* -------------------------------------------------------------------
              LEFT COLUMN: TENANT APPLICATION SECTIONS (758px)
          -------------------------------------------------------------------- */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Tenant Personal Details (Figma Node 44:64887) */}
            <div className="bg-white p-6 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <h2 className="text-[16px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-3">
                1. Thông tin người thuê chính
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leftIcon={<User className="size-4" />}
                />
                <Input
                  label="Số điện thoại di động"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  leftIcon={<Phone className="size-4" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Số CCCD / CMND"
                  value={citizenId}
                  onChange={(e) => setCitizenId(e.target.value)}
                  required
                  placeholder="12 chữ số trên CCCD gắn chip"
                  leftIcon={<IdCard className="size-4" />}
                />
                <Input
                  label="Địa chỉ Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="pt-1">
                <Badge variant="success" size="sm">
                  Thông tin CCCD được bảo mật theo quy định bảo vệ dữ liệu cá nhân
                </Badge>
              </div>
            </div>

            {/* Section 2: Lease Period & Term (Figma Node 44:64906) */}
            <div className="bg-white p-6 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <h2 className="text-[16px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-3">
                2. Thời gian và kế hoạch thuê
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Ngày dự kiến dọn vào"
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  required
                  leftIcon={<Calendar className="size-4" />}
                />

                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Thời hạn hợp đồng mong muốn
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { months: 6, label: "6 tháng" },
                      { months: 12, label: "12 tháng" },
                      { months: 24, label: "24 tháng" },
                    ].map((term) => (
                      <button
                        key={term.months}
                        type="button"
                        onClick={() => setLeaseTermMonths(term.months)}
                        className={`h-[48px] rounded-[8px] text-[13px] font-semibold border transition-all cursor-pointer ${
                          leaseTermMonths === term.months
                            ? "bg-[#15594f] text-white border-[#15594f] shadow-xs"
                            : "bg-[#f7f6f2] text-[#203c37] border-[#e2e7e1] hover:border-[#15594f]/50"
                        }`}
                      >
                        {term.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Occupants & Lifestyle Details (Figma Node 44:64915) */}
            <div className="bg-white p-6 rounded-[14px] border border-[#e2e7e1] shadow-xs space-y-4">
              <h2 className="text-[16px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-3">
                3. Số lượng người ở & thông tin sinh hoạt
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Số người ở thực tế
                  </label>
                  <select
                    value={occupantsCount}
                    onChange={(e) => setOccupantsCount(Number(e.target.value))}
                    className="w-full min-h-[48px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none cursor-pointer"
                  >
                    <option value={1}>1 người (Ở một mình)</option>
                    <option value={2}>2 người</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Số xe máy mang theo
                  </label>
                  <select
                    value={motorcyclesCount}
                    onChange={(e) => setMotorcyclesCount(Number(e.target.value))}
                    className="w-full min-h-[48px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none cursor-pointer"
                  >
                    <option value={0}>Không mang xe máy</option>
                    <option value={1}>1 xe máy</option>
                    <option value={2}>2 xe máy</option>
                  </select>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Nuôi thú cưng
                  </label>
                  <select
                    value={hasPet ? "YES" : "NO"}
                    onChange={(e) => setHasPet(e.target.value === "YES")}
                    className="w-full min-h-[48px] px-3 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none cursor-pointer"
                  >
                    <option value="NO">Không nuôi thú cưng</option>
                    <option value="YES">Có nuôi thú cưng</option>
                  </select>
                </div>
              </div>

              <Input
                label="Nghề nghiệp / Nơi học tập, công tác hiện tại"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="VD: Sinh viên ĐH Ngoại Thương / Kỹ sư phần mềm"
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Lời nhắn gửi chủ trọ
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Chia sẻ thêm về nhu cầu dọn vào, thời gian chuyển đồ hoặc mong muốn hợp đồng..."
                  className="w-full p-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f]"
                />
              </div>

              {/* Agreement Checkbox (Figma Node 44:64931) */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="size-4 accent-[#15594f] rounded-[4px] mt-0.5"
                  />
                  <span className="text-[13px] text-[#203c37] leading-relaxed">
                    Tôi xác nhận các thông tin trên là chính xác và đồng ý để 5K-Rental Manager chuyển hồ sơ thuê đến chủ trọ tiến hành thẩm định và soạn thảo hợp đồng điện tử.
                  </span>
                </label>
              </div>

              {errorMsg && (
                <p className="text-[13px] text-[#991b1b] font-medium">{errorMsg}</p>
              )}

              {/* Action Buttons (Figma Node 44:64935) */}
              <div className="pt-3 flex items-center justify-between">
                <Link href={`/rooms/${roomId}`}>
                  <Button variant="outline" size="md">
                    Quay lại xem phòng
                  </Button>
                </Link>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loading}
                  disabled={!hasCompletedVisit || checkingAppointment}
                  className="font-bold shadow-md"
                  rightIcon={<Send className="size-4" />}
                >
                  {checkingAppointment
                    ? "Đang kiểm tra..."
                    : !hasCompletedVisit
                      ? "Cần xem phòng trước"
                      : "Gửi yêu cầu thuê phòng"}
                </Button>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------------
              RIGHT COLUMN: RENTAL SUMMARY CARD (350px) (Figma Node 44:64941)
          -------------------------------------------------------------------- */}
          <aside className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-white p-5 rounded-[16px] border border-[#e2e7e1] shadow-lg space-y-4">
              <h3 className="text-[15px] font-bold text-[#203c37] border-b border-[#e2e7e1] pb-2.5">
                Căn phòng bạn chọn thuê
              </h3>

              <div className="relative w-full h-40 rounded-[10px] overflow-hidden bg-gray-100">
                {post?.images?.[0]?.imageUrl ? (
                  <img
                    src={post.images[0].imageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#74817b]">
                    Chưa có ảnh phòng
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge variant="success" size="sm">
                    Phòng {post?.room?.roomNumber ?? "---"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="text-[14px] font-bold text-[#203c37]">
                  {post?.title ?? "Phòng thuê"}
                </h4>
                <p className="text-[12px] text-[#74817b]">
                  {post?.property?.address ?? "Chưa cập nhật địa chỉ"}
                </p>
              </div>

              <div className="divide-y divide-[#e2e7e1] text-[13px]">
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Giá thuê tháng</span>
                  <span className="font-bold text-[#15594f]">
                    {formatCurrency(monthlyRent, { showUnit: false })} đ
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Tiền cọc giữ phòng</span>
                  <span className="font-semibold text-[#203c37]">
                    {formatCurrency(depositAmount, { showUnit: false })} đ
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-[#74817b]">Thời hạn hợp đồng</span>
                  <span className="font-semibold text-[#203c37]">{leaseTermMonths} tháng</span>
                </div>
                <div className="py-2.5 flex justify-between bg-[#f7f6f2] -mx-5 px-5 font-bold">
                  <span className="text-[#203c37]">Tổng thanh toán đợt 1</span>
                  <span className="text-base text-[#15594f]">
                    {formatCurrency(totalFirstMonth, { showUnit: false })} đ
                  </span>
                </div>
              </div>

              {/* Visit status indicator */}
              <div className={`p-3 rounded-[8px] border text-[12px] space-y-1 ${
                checkingAppointment
                  ? "bg-gray-50 border-gray-200 text-gray-500"
                  : hasCompletedVisit
                    ? "bg-[#eaf2ed] border-[#d2e4d7] text-[#15594f]"
                    : "bg-amber-50 border-amber-200 text-amber-700"
              }`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  {checkingAppointment ? (
                    <Clock className="size-4 shrink-0 animate-spin" />
                  ) : hasCompletedVisit ? (
                    <CalendarCheck className="size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0" />
                  )}
                  <span>
                    {checkingAppointment
                      ? "Đang kiểm tra lịch hẹn..."
                      : hasCompletedVisit
                        ? "Đã xem phòng – Sẵn sàng thuê"
                        : "Chưa đặt lịch xem phòng"}
                  </span>
                </div>
                <p className="leading-relaxed" style={{ fontSize: "11px", opacity: 0.9 }}>
                  {checkingAppointment
                    ? "Đang xác nhận trạng thái lịch hẹn của bạn."
                    : hasCompletedVisit
                      ? "Chủ trọ đã xác nhận lịch hẹn. Bạn có thể gửi yêu cầu thuê phòng."
                      : "Bạn cần đặt lịch và chờ chủ trọ xác nhận trước khi gửi yêu cầu thuê."}
                </p>
              </div>

              <div className="p-3 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] text-[12px] text-[#15594f] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="size-4 shrink-0" />
                  <span>Thời gian xét duyệt hồ sơ</span>
                </div>
                <p className="text-[11px] text-[#15594f]/90 leading-relaxed">
                  Chủ trọ thường phản hồi chấp thuận trong vòng 12 - 24 giờ. Bạn sẽ nhận được thông báo để ký hợp đồng số.
                </p>
              </div>
            </div>

            {/* Legal Safety Guarantee */}
            <div className="p-4 rounded-[12px] bg-[#f2ede3]/70 border border-[#e2e7e1] flex items-start gap-3">
              <ShieldCheck className="size-5 text-[#15594f] shrink-0 mt-0.5" />
              <div className="text-[12px] text-[#203c37] leading-relaxed">
                <strong className="block font-semibold">Bảo vệ quyền lợi khách thuê 100%</strong>
                Tiền cọc của bạn chỉ được chuyển cho chủ trọ sau khi bạn nhận bàn giao phòng và ký xác nhận biên bản thiết bị thực tế.
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default function ApplyRentalPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải biểu mẫu thuê phòng...
        </div>
      }
    >
      <ApplyRentalContent />
    </React.Suspense>
  );
}
