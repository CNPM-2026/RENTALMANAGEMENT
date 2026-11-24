"use client";

import * as React from "react";
import { Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, Eye, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Appointment } from "@/types/models";
import { readFocusParam, scrollToFocus } from "@/lib/notification-focus";

type FilterTab = "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export default function LandlordCalendarPage() {
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<FilterTab>("ALL");
  const [actionLoadingId, setActionLoadingId] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchAppointments = React.useCallback(() => {
    apiClient.appointments
      .getMyAppointments()
      .then((data) => setAppointments(data ?? []))
      .catch(() => setAppointments([]))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Thông báo APPOINTMENT mang `?appointment=<id>`: cuộn tới đúng thẻ lịch hẹn.
  React.useEffect(() => {
    const id = readFocusParam("appointment");
    if (!id) return;
    const target = appointments.find((a) => a.id === id);
    const frame = window.requestAnimationFrame(() => {
      if (target && activeTab !== "ALL" && target.status !== activeTab) {
        setActiveTab("ALL");
      }
      setFocusId(id);
      scrollToFocus(`appointment-${id}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [appointments, activeTab]);

  const handleUpdateStatus = async (id: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED") => {
    setActionLoadingId(id);
    setFeedback(null);
    try {
      await apiClient.appointments.updateStatus(id, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
      const label =
        status === "CONFIRMED"
          ? "Đã xác nhận lịch hẹn (Đã hẹn) thành công."
          : status === "COMPLETED"
          ? "Đã xác nhận buổi xem phòng hoàn tất (Đã xem)."
          : "Đã hủy lịch hẹn.";
      setFeedback({ type: "success", message: label });
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Thao tác không thành công.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = appointments.filter((a) => a.status === "PENDING").length;
  const confirmedCount = appointments.filter((a) => a.status === "CONFIRMED").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelledCount = appointments.filter((a) => a.status === "CANCELLED").length;

  const filteredAppointments = appointments.filter((apt) => {
    if (activeTab === "ALL") return true;
    return apt.status === activeTab;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Cho thuê</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Lịch hẹn xem phòng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Theo dõi và quản lý thời gian khách hẹn đến trực tiếp xem phòng trọ.</p>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-[8px] text-[13px] flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#eaf2ed] text-[#15594f] border border-[#d2e4d7]"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline ml-3 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Tabs Filter Strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e2e7e1] pb-2">
        {[
          { id: "ALL", label: `Tất cả (${appointments.length})` },
          { id: "PENDING", label: `Chờ xác nhận (${pendingCount})` },
          { id: "CONFIRMED", label: `Đã hẹn (${confirmedCount})` },
          { id: "COMPLETED", label: `Đã xem (${completedCount})` },
          { id: "CANCELLED", label: `Đã hủy (${cancelledCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as FilterTab)}
            className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#15594f] text-white shadow-xs"
                : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <CalendarIcon className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có lịch hẹn nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">
            {activeTab === "ALL"
              ? "Khi khách chọn lịch hẹn trên tin đăng, thông tin sẽ được cập nhật tại đây."
              : "Không có lịch hẹn nào trong trạng thái đã chọn."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAppointments.map((apt) => (
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
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      apt.status === "CONFIRMED"
                        ? "bg-[#eaf2ed] text-[#15594f] border border-[#c1ded3]"
                        : apt.status === "COMPLETED"
                        ? "bg-[#e0e7ff] text-[#3730a3] border border-[#c7d2fe]"
                        : apt.status === "CANCELLED"
                        ? "bg-[#fbeae6] text-[#a4422c] border border-[#f5c2b8]"
                        : "bg-[#fbf1dc] text-[#9a6a12] border border-[#f4deb4]"
                    }`}
                  >
                    {apt.status === "CONFIRMED"
                      ? "ĐÃ HẸN"
                      : apt.status === "COMPLETED"
                      ? "ĐÃ XEM"
                      : apt.status === "CANCELLED"
                      ? "ĐÃ HỦY"
                      : "CHỜ XÁC NHẬN"}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-[13px] text-[#203c37]">
                  {apt.room && (
                    <p className="text-[12px] text-[#74817b] font-medium">
                      Phòng: <strong className="text-[#203c37]">{apt.room.roomNumber ?? "---"}</strong>
                    </p>
                  )}
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
                    <p className="text-[12px] text-[#74817b] italic mt-2 bg-[#f7f6f2] p-2.5 rounded-[6px]">
                      &ldquo;{apt.note}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons for Landlord */}
              <div className="mt-4 pt-3 border-t border-[#e2e7e1] flex flex-wrap items-center gap-2 justify-end">
                {apt.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoadingId === apt.id}
                      onClick={() => handleUpdateStatus(apt.id, "CONFIRMED")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#15594f] hover:bg-[#103f39] text-white text-[12px] font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Xác nhận hẹn
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === apt.id}
                      onClick={() => handleUpdateStatus(apt.id, "CANCELLED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[#f5c2b8] text-[#a4422c] hover:bg-[#fbeae6] text-[12px] font-medium transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      Hủy hẹn
                    </button>
                  </>
                )}

                {apt.status === "CONFIRMED" && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoadingId === apt.id}
                      onClick={() => handleUpdateStatus(apt.id, "COMPLETED")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[12px] font-semibold transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <Eye className="size-3.5" />
                      Xác nhận đã xem phòng
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === apt.id}
                      onClick={() => handleUpdateStatus(apt.id, "CANCELLED")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-[#f5c2b8] text-[#a4422c] hover:bg-[#fbeae6] text-[12px] font-medium transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      <XCircle className="size-3.5" />
                      Hủy hẹn
                    </button>
                  </>
                )}

                {apt.status === "COMPLETED" && (
                  <span className="text-[12px] text-[#3730a3] font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 className="size-4" /> Đã hoàn thành xem phòng
                  </span>
                )}

                {apt.status === "CANCELLED" && (
                  <span className="text-[12px] text-[#a4422c] font-medium">Lịch hẹn đã bị hủy</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
