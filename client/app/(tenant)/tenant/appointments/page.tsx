"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { apiClient } from "@/lib/api";

interface AppointmentItem {
  id: string;
  roomTitle: string;
  roomAddress: string;
  roomImage: string;
  roomId: string;
  landlordName: string;
  landlordPhone: string;
  appointmentTime: string;
  dateStr: string;
  timeSlot: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  note: string;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

export default function TenantAppointmentsPage() {
  const [activeTab, setActiveTab] = React.useState<"UPCOMING" | "COMPLETED" | "CANCELLED">("UPCOMING");
  const [appointments, setAppointments] = React.useState<AppointmentItem[]>([]);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [minRescheduleDate, setMinRescheduleDate] = React.useState("");
  const [maxRescheduleDate, setMaxRescheduleDate] = React.useState("");

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMinRescheduleDate(dateOffset(1));
      setMaxRescheduleDate(dateOffset(365));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    apiClient.appointments.getMyAppointments()
      .then((items) => setAppointments(items.map((item) => ({
        id: item.id,
        roomTitle: item.room?.property?.name ?? "Phòng thuê",
        roomAddress: item.room?.property?.address ?? "Chưa cập nhật địa chỉ",
        roomImage: item.room?.property?.images?.[0]?.imageUrl ?? "/images/default-room.svg",
        roomId: item.roomId ?? "",
        landlordName: item.landlord?.fullName ?? "Chủ trọ",
        landlordPhone: item.landlord?.phone ?? "",
        appointmentTime: item.appointmentTime,
        dateStr: new Date(item.appointmentTime).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
        timeSlot: new Date(item.appointmentTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        status: item.status,
        note: item.note ?? "",
      }))))
      .catch(() => setErrorMessage("Không tải được lịch xem phòng."));
  }, []);

  // Modal States
  const [selectedAppointment, setSelectedAppointment] = React.useState<AppointmentItem | null>(null);
  const [rescheduleModalOpen, setRescheduleModalOpen] = React.useState(false);
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);

  // Reschedule Form State
  const [newDate, setNewDate] = React.useState("");
  const [newSlot, setNewSlot] = React.useState("14:00 - 15:00");
  const [rescheduleReason, setRescheduleReason] = React.useState("");
  const [rescheduleError, setRescheduleError] = React.useState<string | null>(null);

  // Cancel Form State
  const [cancelReason, setCancelReason] = React.useState("Bận việc đột xuất");

  // Filtered List
  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === "UPCOMING") {
      return apt.status === "PENDING" || apt.status === "CONFIRMED";
    }
    if (activeTab === "COMPLETED") {
      return apt.status === "COMPLETED";
    }
    return apt.status === "CANCELLED";
  });

  const upcomingCount = appointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED").length;

  async function handleRescheduleSubmit() {
    if (!selectedAppointment) return;
    setRescheduleError(null);
    if (!newDate) {
      setRescheduleError("Vui lòng chọn ngày hẹn mới.");
      return;
    }
    const [hour, minute] = newSlot.split(" - ")[0].split(":").map(Number);
    const proposedTime = new Date(
      `${newDate}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`,
    );
    if (Number.isNaN(proposedTime.getTime())) {
      setRescheduleError("Ngày/giờ hẹn không hợp lệ.");
      return;
    }
    if (proposedTime.getTime() < Date.now() + 60 * 60 * 1000) {
      setRescheduleError("Thời gian hẹn mới phải cách hiện tại ít nhất 1 tiếng.");
      return;
    }
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 365);
    if (proposedTime > maxDate) {
      setRescheduleError("Chỉ được đặt lịch trong vòng 365 ngày tới.");
      return;
    }

    try {
      await apiClient.appointments.updateStatus(selectedAppointment.id, { status: "CANCELLED" });
      await apiClient.appointments.create({
        roomId: selectedAppointment.roomId,
        appointmentTime: proposedTime.toISOString(),
        note: `Đề xuất đổi lịch: ${rescheduleReason || "Lịch hẹn mới"}`,
      });
      const items = await apiClient.appointments.getMyAppointments();
      setAppointments(items.map((item) => ({
        id: item.id, roomTitle: item.room?.property?.name ?? "Phòng thuê", roomAddress: item.room?.property?.address ?? "Chưa cập nhật địa chỉ",
        roomImage: item.room?.property?.images?.[0]?.imageUrl ?? "/images/default-room.svg", roomId: item.roomId ?? "",
        landlordName: item.landlord?.fullName ?? "Chủ trọ", landlordPhone: item.landlord?.phone ?? "", appointmentTime: item.appointmentTime,
        dateStr: new Date(item.appointmentTime).toLocaleDateString("vi-VN"), timeSlot: new Date(item.appointmentTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        status: item.status, note: item.note ?? "",
      })));
      setRescheduleModalOpen(false);
    } catch (error) {
      setRescheduleError(error instanceof Error ? error.message : "Không thể đổi lịch hẹn.");
    }
  }

  async function handleCancelSubmit() {
    if (!selectedAppointment) return;
    await apiClient.appointments.updateStatus(selectedAppointment.id, { status: "CANCELLED" });
    setAppointments((prev) => prev.map((a) => a.id === selectedAppointment.id ? { ...a, status: "CANCELLED", note: `Lý do hủy: ${cancelReason}` } : a));
    setCancelModalOpen(false);
  }

  return (
    <div className="space-y-6">
      {errorMessage && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
      {/* =======================================================================
          1. HEADER & BREADCRUMBS (Figma Node 44:64566)
      ======================================================================== */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
          <Link href="/" className="hover:text-[#15594f]">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[#203c37] font-medium">Lịch xem phòng</span>
        </nav>
        <h1 className="text-2xl font-bold text-[#203c37] tracking-tight pt-0.5">
          Quản lý lịch xem phòng
        </h1>
        <p className="text-[14px] text-[#74817b]">
          Theo dõi và quản lý các cuộc hẹn xem phòng trực tiếp với chủ trọ
        </p>
      </div>

      {/* =======================================================================
          2. KPI STATISTICS CARDS (Figma Node 44:64573, h 171px)
      ======================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-[12px] bg-white border border-[#e2e7e1] shadow-xs space-y-1">
          <p className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider">
            Cuộc hẹn sắp tới
          </p>
          <p className="text-3xl font-extrabold text-[#15594f]">{upcomingCount}</p>
          <p className="text-[12px] text-[#74817b]">Cần có mặt đúng giờ hẹn</p>
        </div>

        <div className="p-5 rounded-[12px] bg-white border border-[#e2e7e1] shadow-xs space-y-1">
          <p className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider">
            Đã hoàn thành
          </p>
          <p className="text-3xl font-extrabold text-[#203c37]">{completedCount}</p>
          <p className="text-[12px] text-[#74817b]">Đã xem phòng trực tiếp</p>
        </div>

        <div className="p-5 rounded-[12px] bg-white border border-[#e2e7e1] shadow-xs space-y-1">
          <p className="text-[12px] font-bold text-[#74817b] uppercase tracking-wider">
            Đã hủy hẹn
          </p>
          <p className="text-3xl font-extrabold text-[#991b1b]">{cancelledCount}</p>
          <p className="text-[12px] text-[#74817b]">Thay đổi kế hoạch</p>
        </div>
      </div>

      {/* =======================================================================
          3. TABS FILTER STRIP (Figma Node 44:64586)
      ======================================================================== */}
      <div className="flex items-center gap-2 border-b border-[#e2e7e1] pb-2">
        {[
          { id: "UPCOMING", label: `Sắp tới (${upcomingCount})` },
          { id: "COMPLETED", label: `Đã hoàn thành (${completedCount})` },
          { id: "CANCELLED", label: `Đã hủy (${cancelledCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#15594f] text-white shadow-xs"
                : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Useful Tip Banner (Figma Node 44:64593) */}
      <div className="p-4 rounded-[10px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-center gap-3 text-[13px] text-[#15594f]">
        <Info className="size-4.5 shrink-0" />
        <span>
          <strong>Lời khuyên khi xem phòng:</strong> Bạn nên đến sớm 5 - 10 phút để quan sát tình hình an ninh khu phố, lưu lượng xe cộ và chất lượng sóng điện thoại.
        </span>
      </div>

      {/* =======================================================================
          4. APPOINTMENT CARDS LIST (Figma Node 44:64596)
      ======================================================================== */}
      {filteredAppointments.length === 0 ? (
        <div className="bg-white p-12 rounded-[14px] border border-[#e2e7e1] text-center space-y-3">
          <CalendarDays className="size-10 text-[#74817b] mx-auto" />
          <h3 className="text-base font-bold text-[#203c37]">
            Không có cuộc hẹn nào trong mục này
          </h3>
          <p className="text-[13px] text-[#74817b]">
            Khám phá danh sách phòng trọ để đặt lịch xem phòng trực tiếp
          </p>
          <Link href="/rooms">
            <Button variant="primary" size="sm">
              Khám phá phòng ngay
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              className="p-5 rounded-[14px] bg-white border border-[#e2e7e1] shadow-xs flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
            >
              <div className="flex gap-4 items-start min-w-0">
                <img
                  src={apt.roomImage}
                  alt={apt.roomTitle}
                  className="size-24 rounded-[10px] object-cover shrink-0"
                />
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold text-[#203c37] truncate">
                      {apt.roomTitle}
                    </h3>
                    {apt.status === "CONFIRMED" && (
                      <Badge variant="success" size="sm">
                        ĐÃ XÁC NHẬN
                      </Badge>
                    )}
                    {apt.status === "PENDING" && (
                      <Badge variant="warning" size="sm">
                        CHỜ XÁC NHẬN
                      </Badge>
                    )}
                    {apt.status === "COMPLETED" && (
                      <Badge variant="neutral" size="sm">
                        ĐÃ XEM PHÒNG
                      </Badge>
                    )}
                    {apt.status === "CANCELLED" && (
                      <Badge variant="error" size="sm">
                        ĐÃ HỦY
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
                    <MapPin className="size-3.5 text-[#15594f] shrink-0" />
                    <span className="truncate">{apt.roomAddress}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[13px] pt-1">
                    <div className="flex items-center gap-1.5 text-[#15594f] font-semibold">
                      <CalendarDays className="size-4" />
                      <span>{apt.dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#203c37] font-medium">
                      <Clock className="size-4 text-[#74817b]" />
                      <span>{apt.timeSlot}</span>
                    </div>
                  </div>

                  <div className="text-[12px] text-[#74817b]">
                    Chủ trọ: <strong className="text-[#203c37]">{apt.landlordName}</strong> ({apt.landlordPhone}) • Ghi chú: {apt.note}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center shrink-0">
                {(apt.status === "CONFIRMED" || apt.status === "PENDING") && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setNewDate(dateOffset(1));
                        setRescheduleError(null);
                        setRescheduleModalOpen(true);
                      }}
                      className="font-medium"
                    >
                      Đổi lịch
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setCancelModalOpen(true);
                      }}
                      className="text-[#991b1b] hover:bg-[#fee2e2] font-medium"
                    >
                      Hủy hẹn
                    </Button>
                  </>
                )}

                {apt.status === "COMPLETED" && (
                  <Link href={`/rooms/${apt.roomId}/apply`}>
                    <Button variant="primary" size="sm" className="font-semibold">
                      Gửi yêu cầu thuê
                    </Button>
                  </Link>
                )}

                <Link href={`/rooms/${apt.roomId}`}>
                  <Button variant="outline" size="sm" className="font-medium">
                    Xem phòng <ArrowUpRight className="size-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* =======================================================================
          5. RESCHEDULE MODAL OVERLAY (Figma Node 44:64652)
      ======================================================================== */}
      <Modal
        isOpen={rescheduleModalOpen}
        onClose={() => setRescheduleModalOpen(false)}
        title="Đổi lịch hẹn xem phòng"
        description="Chọn ngày và khung giờ mới để gửi đề xuất cho chủ trọ"
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRescheduleModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRescheduleSubmit}
            >
              Xác nhận đổi lịch
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#203c37] mb-1.5">
              Chọn ngày hẹn mới
            </label>
            <input
              type="date"
              value={newDate}
              min={minRescheduleDate}
              max={maxRescheduleDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setRescheduleError(null);
              }}
              className="w-full h-[46px] px-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none"
            />
            {rescheduleError && (
              <p className="mt-2 rounded-[6px] border border-[#efc6bb] bg-[#fbeae6] px-3 py-2 text-[12px] text-[#a4422c]">
                {rescheduleError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#203c37] mb-1.5">
              Chọn khung giờ mới
            </label>
            <select
              value={newSlot}
              onChange={(e) => setNewSlot(e.target.value)}
              className="w-full h-[46px] px-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none cursor-pointer"
            >
              <option value="09:00 - 10:00">09:00 - 10:00 (Sáng)</option>
              <option value="10:30 - 11:30">10:30 - 11:30 (Trưa)</option>
              <option value="14:00 - 15:00">14:00 - 15:00 (Chiều)</option>
              <option value="16:00 - 17:00">16:00 - 17:00 (Chiều muộn)</option>
              <option value="18:00 - 19:00">18:00 - 19:00 (Tối)</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#203c37] mb-1.5">
              Lý do đổi lịch (Tùy chọn)
            </label>
            <textarea
              value={rescheduleReason}
              onChange={(e) => setRescheduleReason(e.target.value)}
              rows={2}
              placeholder="VD: Trùng lịch học đột xuất, mong muốn chuyển sang buổi chiều..."
              className="w-full p-2.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[13px] text-[#203c37] outline-none focus:border-[#15594f]"
            />
          </div>
        </div>
      </Modal>

      {/* =======================================================================
          6. CANCEL CONFIRMATION MODAL OVERLAY (Figma Node 44:64748)
      ======================================================================== */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Xác nhận hủy lịch hẹn"
        description="Bạn có chắc chắn muốn hủy cuộc hẹn xem phòng này?"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
            >
              Giữ lại lịch hẹn
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelSubmit}
            >
              Xác nhận hủy hẹn
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[#74817b]">
            Vui lòng chọn lý do hủy để 5K-Rental Manager thông báo rõ ràng đến chủ trọ:
          </p>

          <div className="space-y-2">
            {[
              "Bận việc đột xuất không thể sắp xếp",
              "Đã tìm được căn phòng khác phù hợp hơn",
              "Thay đổi kế hoạch chuyển chỗ ở",
              "Lý do cá nhân khác",
            ].map((reason) => (
              <label
                key={reason}
                className="flex items-center gap-2.5 text-[13px] text-[#203c37] cursor-pointer"
              >
                <input
                  type="radio"
                  name="cancelReason"
                  checked={cancelReason === reason}
                  onChange={() => setCancelReason(reason)}
                  className="accent-[#15594f]"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
