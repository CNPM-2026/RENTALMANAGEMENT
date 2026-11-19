"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Clock, User, Phone } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Appointment } from "@/types/models";
import { readFocusParam, scrollToFocus } from "@/lib/notification-focus";

export default function LandlordCalendarPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiClient.appointments
      .getMyAppointments()
      .then((data) => setAppointments(data ?? []))
      .catch(() => setAppointments([]))
      .finally(() => setIsLoading(false));
  }, []);

  // Thông báo APPOINTMENT mang `?appointment=<id>`: cuộn tới đúng thẻ lịch hẹn.
  React.useEffect(() => {
    const id = readFocusParam("appointment");
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      setFocusId(id);
      scrollToFocus(`appointment-${id}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Cho thuê</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Lịch hẹn xem phòng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Theo dõi thời gian khách hẹn đến trực tiếp xem phòng trọ.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <CalendarIcon className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có lịch hẹn nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Khi khách chọn lịch hẹn trên tin đăng, thông tin sẽ được cập nhật tại đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              id={`appointment-${apt.id}`}
              className={`scroll-mt-24 rounded-[12px] border bg-white p-5 shadow-xs flex flex-col justify-between ${
                focusId === apt.id ? "border-[#15594f] ring-2 ring-[#15594f]/25" : "border-[#e2e7e1]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#15594f]">
                    <Clock className="size-4" />
                    {new Date(apt.appointmentTime).toLocaleString("vi-VN")}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      apt.status === "CONFIRMED"
                        ? "bg-[#eaf2ed] text-[#15594f]"
                        : apt.status === "CANCELLED"
                        ? "bg-[#fbeae6] text-[#a4422c]"
                        : "bg-[#fbf1dc] text-[#9a6a12]"
                    }`}
                  >
                    {apt.status === "CONFIRMED" ? "Đã chốt lịch" : apt.status === "CANCELLED" ? "Đã hủy" : "Đang chờ"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-[13px] text-[#203c37]">
                  <p className="font-semibold flex items-center gap-2">
                    <User className="size-3.5 text-[#74817b]" />
                    {apt.tenant?.fullName || "Khách hẹn"}
                  </p>
                  {apt.tenant?.phone && (
                    <p className="text-[#74817b] flex items-center gap-2 text-[12px]">
                      <Phone className="size-3.5" />
                      {apt.tenant.phone}
                    </p>
                  )}
                  {apt.note && (
                    <p className="text-[12px] text-[#74817b] italic mt-2 bg-[#f7f6f2] p-2 rounded-[6px]">
                      &ldquo;{apt.note}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
