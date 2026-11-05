"use client";

import * as React from "react";
import Link from "next/link";
import { Inbox, Check, X, Clock, User, Phone, Mail, Calendar } from "lucide-react";
import { apiClient } from "@/lib/api";
import { RentalRequest } from "@/types/models";

export default function LandlordRentalRequestsPage() {
  const [requests, setRequests] = React.useState<RentalRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const loadRequests = React.useCallback(() => {
    setIsLoading(true);
    apiClient.rentalRequests
      .getMine()
      .then((data) => setRequests(data ?? []))
      .catch(() => setErrorMessage("Không tải được yêu cầu thuê phòng."))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleUpdate = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      await apiClient.rentalRequests.updateStatus(id, status);
      loadRequests();
    } catch (e) {
      setErrorMessage("Cập nhật trạng thái thất bại. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
      <div>
        <p className="text-[12px] text-[#74817b]">Cho thuê</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Yêu cầu thuê phòng & Đặt chỗ</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Danh sách người thuê gửi yêu cầu xem phòng và đăng ký thuê.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Inbox className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có yêu cầu nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Các yêu cầu xem phòng và thuê từ khách sẽ hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((item) => (
            <div
              key={item.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[16px] text-[#203c37]">
                    {item.tenant?.fullName || "Khách thuê"} · Phòng {item.room?.roomNumber || item.roomId}
                  </span>
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      item.status === "APPROVED"
                        ? "bg-[#eaf2ed] text-[#15594f]"
                        : item.status === "REJECTED"
                        ? "bg-[#fbeae6] text-[#a4422c]"
                        : "bg-[#fbf1dc] text-[#9a6a12]"
                    }`}
                  >
                    {item.status === "APPROVED"
                      ? "Đã duyệt"
                      : item.status === "REJECTED"
                      ? "Đã từ chối"
                      : "Chờ xác nhận"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[13px] text-[#74817b]">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-[#15594f]" />
                    Nhận phòng: {new Date(item.moveInDate).toLocaleDateString("vi-VN")}
                  </span>
                  {item.tenant?.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {item.tenant.phone}
                    </span>
                  )}
                  {item.tenant?.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      {item.tenant.email}
                    </span>
                  )}
                </div>
                {item.note && (
                  <p className="text-[12px] text-[#74817b] bg-[#f7f6f2] p-2 rounded-[6px] max-w-xl">
                    Ghi chú: {item.note}
                  </p>
                )}
              </div>

              {item.status === "SUBMITTED" && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleUpdate(item.id, "APPROVED")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] transition-colors cursor-pointer"
                  >
                    <Check className="size-3.5" />
                    <span>                    Duyệt yêu cầu</span>
                  </button>
                  <button
                    onClick={() => handleUpdate(item.id, "REJECTED")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] border border-[#e2e7e1] text-[#a4422c] hover:bg-[#fbeae6] text-[12px] font-semibold transition-colors cursor-pointer"
                  >
                    <X className="size-3.5" />
                    <span>Từ chối</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
