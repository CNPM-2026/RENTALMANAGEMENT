"use client";

import * as React from "react";
import { Users, CheckCircle2, Clock, XCircle, AlertTriangle, Send } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Contract, OccupancyDeclaration, OccupancyDeclarationStatus } from "@/types/models";
import { NumericInput } from "@/components/ui/numeric-input";
import { parseIntegerInput } from "@/lib/numeric";

const STATUS_MAP: Record<
  OccupancyDeclarationStatus,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: { label: "Chờ chủ trọ xác minh", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]", icon: Clock },
  VERIFIED: { label: "Đã xác minh", bg: "bg-[#eaf2ed]", text: "text-[#15594f]", icon: CheckCircle2 },
  REJECTED: { label: "Bị từ chối", bg: "bg-[#fbeae6]", text: "text-[#a4422c]", icon: XCircle },
  SUPERSEDED: { label: "Đã thay thế", bg: "bg-[#f7f6f2]", text: "text-[#74817b]", icon: Clock },
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Khai báo số người ở (tenant).
 *
 * - Chỉ chọn được phòng có hợp đồng ĐANG HIỆU LỰC (server kiểm tra lại).
 * - Mỗi lần lưu tạo một khai báo MỚI ở trạng thái PENDING (không sửa bản cũ),
 *   nên thay đổi luôn phải được chủ trọ xác minh lại.
 * - PENDING/REJECTED không được dùng để tính tiền; hoá đơn chỉ dùng số người
 *   đã xác minh tại thời điểm cuối kỳ.
 */
export default function TenantOccupancyPage() {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [declarations, setDeclarations] = React.useState<OccupancyDeclaration[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [roomId, setRoomId] = React.useState("");
  const [occupants, setOccupants] = React.useState("");
  const [submitError, setSubmitError] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Nạp dữ liệu trực tiếp trong effect (setState nằm trong callback promise) —
  // tránh gọi một hàm có setState đồng bộ trong thân effect.
  React.useEffect(() => {
    let isCancelled = false;
    Promise.all([
      apiClient.contracts.getMyContracts(),
      apiClient.occupancyDeclarations.getMine(),
    ])
      .then(([myContracts, myDeclarations]) => {
        if (isCancelled) return;
        const active = (myContracts ?? []).filter((contract) => contract.status === "ACTIVE");
        setLoadError("");
        setContracts(active);
        setDeclarations(myDeclarations ?? []);
        setRoomId((current) => current || active[0]?.roomId || "");
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu khai báo.");
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedContract = contracts.find((contract) => contract.roomId === roomId);
  const selectedRoom = selectedContract?.room;
  const latestForRoom = React.useMemo(() => {
    if (!roomId) return null;
    return declarations
      .filter((item) => item.roomId === roomId)
      .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())[0] ?? null;
  }, [declarations, roomId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSubmitError("");
    setSuccessMessage("");

    if (!roomId) {
      setSubmitError("Bạn cần có hợp đồng đang hiệu lực để khai báo số người ở.");
      return;
    }
    const value = parseIntegerInput(occupants);
    if (value === null || value < 1) {
      setSubmitError("Số người ở phải là số nguyên dương.");
      return;
    }
    if (selectedRoom && value > selectedRoom.maxOccupants) {
      setSubmitError(
        `Phòng ${selectedRoom.roomNumber} chỉ cho tối đa ${selectedRoom.maxOccupants} người.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiClient.occupancyDeclarations.declare({ roomId, occupants: value });
      setDeclarations((current) => [created, ...current]);
      setSuccessMessage(
        "Đã gửi khai báo. Chủ trọ sẽ xác minh — hoá đơn chỉ dùng số người đã xác minh.",
      );
      setOccupants("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không gửi được khai báo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tài khoản</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Khai báo số người ở</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Số người ở là căn cứ tính tiền nước và kiểm tra sức chứa. Mỗi thay đổi cần chủ trọ xác minh lại.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {loadError}
        </p>
      )}

      {isLoading ? (
        <div className="h-40 rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
      ) : contracts.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Users className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Bạn chưa có hợp đồng đang hiệu lực</h3>
          <p className="text-[13px] text-[#74817b] mt-1">
            Khai báo số người ở chỉ mở khi hợp đồng thuê đã được kích hoạt.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <form
            onSubmit={handleSubmit}
            className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4"
            noValidate
          >
            <h2 className="text-[15px] font-semibold text-[#203c37]">Gửi khai báo mới</h2>

            <label className="space-y-1.5 block">
              <span className="block text-[13px] font-medium text-[#203c37]">Phòng đang thuê</span>
              <select
                value={roomId}
                onChange={(event) => {
                  setRoomId(event.target.value);
                  setSubmitError("");
                  setSuccessMessage("");
                }}
                className="w-full min-h-[44px] px-[14px] py-[10px] bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              >
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.roomId}>
                    Phòng {contract.room?.roomNumber ?? contract.roomId}
                    {contract.room?.property?.name ? ` · ${contract.room.property.name}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 block">
              <span className="block text-[13px] font-medium text-[#203c37]">
                Số người đang ở <span className="text-[#991b1b]">*</span>
              </span>
              <NumericInput
                value={occupants}
                onChange={(value) => {
                  setOccupants(value);
                  setSubmitError("");
                  setSuccessMessage("");
                }}
                maxDecimals={0}
                placeholder="Ví dụ: 2"
                ariaLabel="Số người đang ở"
                className="w-full min-h-[44px] px-[14px] py-[10px] bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
              />
              {selectedRoom && (
                <span className="block text-[12px] text-[#74817b]">
                  Sức chứa tối đa của phòng: {selectedRoom.maxOccupants} người
                  {selectedRoom.waterRate !== null && selectedRoom.waterRate !== undefined
                    ? ` · đơn giá nước ${selectedRoom.waterRate.toLocaleString("vi-VN")} đ/m³`
                    : ""}
                </span>
              )}
            </label>


            {latestForRoom && (
              <div className="rounded-[8px] bg-[#f7f6f2] border border-[#e2e7e1] p-3 text-[12px]">
                <p className="font-medium text-[#203c37]">
                  Khai báo gần nhất: {latestForRoom.occupants} người —{" "}
                  {STATUS_MAP[latestForRoom.status].label}
                </p>
                {latestForRoom.rejectionReason && (
                  <p className="text-[#a4422c] mt-1">Lý do từ chối: {latestForRoom.rejectionReason}</p>
                )}
              </div>
            )}

            {submitError && (
              <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
                {submitError}
              </p>
            )}
            {successMessage && <p className="text-[13px] font-medium text-[#15594f]">{successMessage}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
            >
              <Send className="size-4" />
              <span>{isSubmitting ? "Đang gửi..." : "Gửi khai báo"}</span>
            </button>
          </form>

          <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
            <h2 className="text-[15px] font-semibold text-[#203c37] mb-3">Lịch sử khai báo</h2>
            {declarations.length === 0 ? (
              <p className="text-[13px] text-[#74817b]">Bạn chưa gửi khai báo nào.</p>
            ) : (
              <ul className="space-y-2">
                {[...declarations]
                  .sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime())
                  .map((item) => {
                    const config = STATUS_MAP[item.status];
                    const Icon = config.icon;
                    return (
                      <li key={item.id} className="rounded-[8px] border border-[#eef3ef] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium text-[#203c37]">
                            Phòng {item.room?.roomNumber ?? item.roomId.slice(0, 8)} · {item.occupants} người
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}
                          >
                            <Icon className="size-3" />
                            {config.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#74817b] mt-1">
                          Gửi lúc {formatDateTime(item.declaredAt)}
                          {item.verifiedAt ? ` · xử lý ${formatDateTime(item.verifiedAt)}` : ""}
                        </p>
                        {item.rejectionReason && (
                          <p className="inline-flex items-start gap-1 text-[11px] text-[#a4422c] mt-1">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            {item.rejectionReason}
                          </p>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

