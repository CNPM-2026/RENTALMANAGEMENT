"use client";

import * as React from "react";
import { Users, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { OccupancyDeclaration } from "@/types/models";
import { Modal } from "@/components/ui/modal";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Duyệt khai báo số người ở (chủ trọ).
 *
 * Chỉ chủ trọ sở hữu phòng mới thấy/thao tác được — server kiểm tra lại quyền
 * sở hữu ở từng request, nên ẩn/hiện nút ở UI chỉ là lớp trang trí. Từ chối
 * BẮT BUỘC có lý do (>= 3 ký tự) để tenant biết phải sửa gì.
 */
export default function LandlordOccupancyPage() {
  const [declarations, setDeclarations] = React.useState<OccupancyDeclaration[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [busyId, setBusyId] = React.useState("");
  const [rejecting, setRejecting] = React.useState<OccupancyDeclaration | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [isRejecting, setIsRejecting] = React.useState(false);

  // Không setState ĐỒNG BỘ trong thân effect (react-hooks/set-state-in-effect):
  // setState nằm trong callback promise; `fetchPending` chỉ dùng cho nút "Làm mới".
  const fetchPending = React.useCallback(async () => {
    try {
      const data = await apiClient.occupancyDeclarations.getPending();
      setLoadError("");
      setDeclarations(data ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Không tải được danh sách chờ duyệt.");
      setDeclarations([]);
    }
  }, []);

  React.useEffect(() => {
    let isCancelled = false;
    apiClient.occupancyDeclarations
      .getPending()
      .then((data) => {
        if (isCancelled) return;
        setLoadError("");
        setDeclarations(data ?? []);
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(error instanceof Error ? error.message : "Không tải được danh sách chờ duyệt.");
        setDeclarations([]);
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const refresh = async () => {
    setIsLoading(true);
    await fetchPending();
    setIsLoading(false);
  };

  const handleVerify = async (declaration: OccupancyDeclaration) => {
    if (busyId) return;
    setActionError("");
    setBusyId(declaration.id);
    try {
      await apiClient.occupancyDeclarations.verify(declaration.id);
      setDeclarations((current) => current.filter((item) => item.id !== declaration.id));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không xác minh được khai báo.");
    } finally {
      setBusyId("");
    }
  };

  const openReject = (declaration: OccupancyDeclaration) => {
    setActionError("");
    setRejectReason("");
    setRejecting(declaration);
  };

  const handleReject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejecting || isRejecting) return;
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setActionError("Cần nêu lý do từ chối (ít nhất 3 ký tự).");
      return;
    }
    setActionError("");
    setIsRejecting(true);
    try {
      await apiClient.occupancyDeclarations.reject(rejecting.id, { reason });
      setDeclarations((current) => current.filter((item) => item.id !== rejecting.id));
      setRejecting(null);
      setRejectReason("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Không từ chối được khai báo.");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Cho thuê</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Xác minh số người ở</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Hoá đơn dùng số người ĐÃ XÁC MINH tại thời điểm cuối kỳ. Khai báo chưa duyệt sẽ chặn phát hành hoá đơn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] bg-white text-[13px] font-medium text-[#203c37] hover:bg-[#f7f6f2] disabled:opacity-50 self-start cursor-pointer"
        >
          <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {loadError && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {loadError}
        </p>
      )}
      {actionError && !rejecting && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : declarations.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Users className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Không có khai báo nào chờ xác minh</h3>
          <p className="text-[13px] text-[#74817b] mt-1">
            Khai báo mới của khách thuê sẽ xuất hiện ở đây ngay khi được gửi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {declarations.map((item) => {
            const overCapacity = Boolean(item.room && item.occupants > item.room.maxOccupants);
            return (
              <div key={item.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-[#203c37]">
                      Phòng {item.room?.roomNumber ?? item.roomId.slice(0, 8)}
                      {item.room?.property?.name ? ` · ${item.room.property.name}` : ""}
                    </p>
                    <p className="text-[13px] text-[#74817b]">
                      Khách thuê: {item.tenant?.fullName ?? item.tenantId}
                      {item.tenant?.phone ? ` · ${item.tenant.phone}` : ""}
                    </p>
                    <p className="text-[13px] text-[#74817b]">
                      Khai báo: <strong className="text-[#203c37]">{item.occupants} người</strong>
                      {item.room ? ` / sức chứa ${item.room.maxOccupants}` : ""}
                      {" · "}
                      {formatDateTime(item.declaredAt)}
                    </p>
                    {item.contract && (
                      <p className="text-[12px] text-[#74817b]">
                        Hợp đồng {item.contract.id.slice(0, 8)} — từ{" "}
                        {new Date(item.contract.startDate).toLocaleDateString("vi-VN")}
                      </p>
                    )}
                    {overCapacity && (
                      <p className="inline-flex items-center gap-1 text-[12px] font-medium text-[#a4422c]">
                        <AlertTriangle className="size-3.5" />
                        Vượt sức chứa phòng — nên từ chối và yêu cầu khai lại.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleVerify(item)}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] bg-[#15594f] text-white text-[12px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="size-4" />
                      <span>{busyId === item.id ? "Đang lưu..." : "Xác minh"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReject(item)}
                      disabled={busyId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[7px] border border-[#991b1b]/30 text-[#991b1b] text-[12px] font-semibold hover:bg-[#fbeae6] disabled:opacity-50 cursor-pointer"
                    >
                      <XCircle className="size-4" />
                      <span>Từ chối</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}


      <Modal
        isOpen={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Từ chối khai báo số người"
        description={
          rejecting
            ? `Phòng ${rejecting.room?.roomNumber ?? ""} — ${rejecting.occupants} người. Lý do được gửi cho khách thuê để khai lại.`
            : undefined
        }
      >
        <form onSubmit={handleReject} className="space-y-3" noValidate>
          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">
              Lý do từ chối <span className="text-[#991b1b]">*</span>
            </span>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ví dụ: số người vượt sức chứa, hoặc không khớp hợp đồng thuê."
              className="w-full px-[14px] py-[10px] bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]"
            />
          </label>
          {actionError && (
            <p role="alert" className="text-[12px] font-medium text-[#991b1b]">
              {actionError}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setRejecting(null)}
              disabled={isRejecting}
              className="px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#203c37] hover:bg-[#f7f6f2] disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isRejecting}
              className="px-4 py-2.5 rounded-[8px] bg-[#991b1b] text-white text-[13px] font-semibold hover:bg-[#7f1616] disabled:opacity-50 cursor-pointer"
            >
              {isRejecting ? "Đang gửi..." : "Từ chối khai báo"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

