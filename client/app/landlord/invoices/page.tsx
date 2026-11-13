"use client";

import * as React from "react";
import { Plus, Receipt, Eye, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Invoice, InvoicePreview, InvoiceStatus, Room } from "@/types/models";
import { Modal } from "@/components/ui/modal";
import { NumericInput } from "@/components/ui/numeric-input";
import { parseDecimalInput, parseIntegerInput } from "@/lib/numeric";

const STATUS_MAP: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  PAID: { label: "Đã thanh toán", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  UNPAID: { label: "Chưa thanh toán", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
};

const FIELD_CLASS =
  "w-full min-h-[44px] px-[14px] py-[10px] bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]";

function formatCurrency(val?: number | string | null) {
  if (val === null || val === undefined || val === "") return "—";
  const amount = Number(val);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

/**
 * Prisma Decimal được API tuần tự hoá thành CHUỖI (vd `"3500000"`), nên không
 * được cộng trực tiếp các trường tiền (sẽ thành nối chuỗi). Chuẩn hoá về số
 * trước khi cộng; giá trị thiếu/không hợp lệ coi như 0.
 */
function toAmount(value?: number | string | null): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

/** Chuỗi số thập phân từ server (`'3500.00'`) -> hiển thị tiền; null -> "—". */
function formatDecimalMoney(value?: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? formatCurrency(amount) : "—";
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("vi-VN").format(value);
}

type CreateForm = { roomId: string; month: string; year: string; otherFee: string };

/**
 * Hoá đơn & thu tiền (chủ trọ).
 *
 * Quy tắc quan trọng: bấm "Tạo hoá đơn" KHÔNG tự tính tiền ở client. Form gọi
 * `GET /invoices/preview` (server tính bằng bigint) và chỉ cho phát hành khi
 * `ready === true`; nếu thiếu chỉ số / thiếu khai báo số người / giá chưa cấu
 * hình thì hiện đúng `blockers` do server trả về.
 */
export default function LandlordInvoicesPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateForm>({ roomId: "", month: "", year: "", otherFee: "" });
  const [fetchedPreview, setPreview] = React.useState<InvoicePreview | null>(null);
  const [previewError, setPreviewError] = React.useState("");
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [createError, setCreateError] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [detailInvoice, setDetailInvoice] = React.useState<Invoice | null>(null);
  const [payError, setPayError] = React.useState("");
  const [payingId, setPayingId] = React.useState("");

  const openCreateForm = () => {
    const now = new Date();
    setForm({
      roomId: "",
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      otherFee: "",
    });
    setPreview(null);
    setPreviewError("");
    setCreateError("");
    setIsCreateOpen(true);
  };

  React.useEffect(() => {
    apiClient.invoices
      .getMyInvoices()
      .then((data) => setInvoices(data ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setIsLoading(false));
    apiClient.properties
      .getMyProperties()
      .then(async (properties) => {
        const roomLists = await Promise.all((properties ?? []).map((property) => apiClient.rooms.getByProperty(property.id)));
        setRooms(roomLists.flat());
      })
      .catch(() => setRooms([]));
  }, []);

  // Xem trước có debounce: server là nguồn sự thật của phép tính, không đoán ở client.
  // Không setState đồng bộ trong thân effect; mọi cập nhật nằm trong timer/promise.
  const previewApplicable =
    Boolean(form.roomId) &&
    parseIntegerInput(form.month) !== null &&
    parseIntegerInput(form.year) !== null &&
    (form.otherFee.trim() === "" || parseDecimalInput(form.otherFee) !== null);

  React.useEffect(() => {
    const month = parseIntegerInput(form.month);
    const year = parseIntegerInput(form.year);
    const otherFee = form.otherFee.trim() === "" ? 0 : parseDecimalInput(form.otherFee);
    if (!isCreateOpen || !form.roomId || month === null || year === null || otherFee === null) return;

    let isCancelled = false;
    const timer = setTimeout(() => {
      setIsPreviewing(true);
      setPreviewError("");
      apiClient.invoices
        .preview({ roomId: form.roomId, month, year, otherFee })
        .then((data) => {
          if (isCancelled) return;
          setPreview(data);
        })
        .catch((error) => {
          if (isCancelled) return;
          setPreview(null);
          setPreviewError(error instanceof Error ? error.message : "Không xem trước được hoá đơn.");
        })
        .finally(() => {
          if (!isCancelled) setIsPreviewing(false);
        });
    }, 350);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isCreateOpen, form.roomId, form.month, form.year, form.otherFee]);

  // Chỉ dùng preview khi input hiện tại còn hợp lệ (tránh hiện số cũ của kỳ khác).
  const preview = previewApplicable ? fetchedPreview : null;

  const filtered = invoices.filter((inv) => statusFilter === "ALL" || inv.status === statusFilter);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCreating) return;
    setCreateError("");

    const month = parseIntegerInput(form.month);
    const year = parseIntegerInput(form.year);
    const otherFee = form.otherFee.trim() === "" ? 0 : parseDecimalInput(form.otherFee);
    if (!form.roomId) {
      setCreateError("Chọn phòng cần phát hành hoá đơn.");
      return;
    }
    if (month === null || month < 1 || month > 12) {
      setCreateError("Tháng phải là số nguyên từ 1 đến 12.");
      return;
    }
    if (year === null || year < 2020 || year > 2100) {
      setCreateError("Năm không hợp lệ.");
      return;
    }
    if (otherFee === null) {
      setCreateError("Phí khác không hợp lệ — chỉ nhập số không âm.");
      return;
    }
    if (preview && !preview.ready) {
      setCreateError(preview.blockers[0]?.message ?? "Hoá đơn chưa đủ điều kiện để phát hành.");
      return;
    }

    setIsCreating(true);
    try {
      const created = await apiClient.invoices.generate({ roomId: form.roomId, month, year, otherFee });
      setInvoices((prev) => [created, ...prev]);
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Không phát hành được hoá đơn.");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePay = async (invoice: Invoice) => {
    if (payingId) return;
    if (!window.confirm(`Xác nhận đã nhận thanh toán hoá đơn tháng ${invoice.month}/${invoice.year}?`)) return;
    setPayError("");
    setPayingId(invoice.id);
    try {
      const updated = await apiClient.invoices.pay(invoice.id);
      setInvoices((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setDetailInvoice((current) => (current && current.id === updated.id ? { ...current, ...updated } : current));
    } catch (error) {
      setPayError(error instanceof Error ? error.message : "Không xác nhận được thanh toán.");
    } finally {
      setPayingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Hóa đơn &amp; Thu tiền</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Quản lý hóa đơn tiền phòng, điện nước và đối soát thanh toán.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Tạo hóa đơn mới</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white p-2.5 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        {["ALL", "UNPAID", "PAID"].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
              statusFilter === st ? "bg-[#15594f] text-white" : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            {st === "ALL" ? "Tất cả" : STATUS_MAP[st as InvoiceStatus]?.label}
          </button>
        ))}
      </div>

      {payError && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {payError}
        </p>
      )}



      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Receipt className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có hoá đơn nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">
            Chốt chỉ số điện nước trước, sau đó bấm “Tạo hóa đơn mới”.
          </p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-x-auto shadow-xs">
          <table className="w-full text-left border-collapse text-[13px] min-w-[900px]">
            <thead>
              <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                <th className="py-3 px-4">Phòng</th>
                <th className="py-3 px-4">Kỳ</th>
                <th className="py-3 px-4">Hạn thanh toán</th>
                <th className="py-3 px-4">Tiền phòng</th>
                <th className="py-3 px-4">Điện + Nước</th>
                <th className="py-3 px-4">Phí cố định</th>
                <th className="py-3 px-4">Tổng tiền</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
              {filtered.map((inv) => {
                const st = STATUS_MAP[inv.status] || STATUS_MAP.UNPAID;
                return (
                  <tr key={inv.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold">
                      {inv.room?.roomNumber ? `Phòng ${inv.room.roomNumber}` : inv.roomId.slice(0, 8)}
                      {inv.tenant?.fullName && (
                        <span className="block text-[11px] font-normal text-[#74817b]">{inv.tenant.fullName}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium">
                      Tháng {inv.month}/{inv.year}
                    </td>
                    <td className="py-3.5 px-4 text-[#74817b]">
                      {new Date(inv.dueDate).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="py-3.5 px-4">{formatCurrency(inv.roomFee)}</td>
                    <td className="py-3.5 px-4 text-[#74817b]">
                      {formatCurrency(toAmount(inv.electricityFee) + toAmount(inv.waterFee))}
                    </td>
                    <td className="py-3.5 px-4 text-[#74817b]">
                      {formatCurrency(
                        toAmount(inv.internetFee) +
                          toAmount(inv.serviceFee) +
                          toAmount(inv.parkingFee),
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#15594f]">{formatCurrency(inv.totalAmount)}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={() => {
                            setPayError("");
                            setDetailInvoice(inv);
                          }}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15594f] hover:underline cursor-pointer"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem</span>
                        </button>
                        {inv.status === "UNPAID" && (
                          <button
                            onClick={() => void handlePay(inv)}
                            disabled={payingId === inv.id}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#9a6a12] hover:underline disabled:opacity-50 cursor-pointer"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>{payingId === inv.id ? "Đang lưu..." : "Đã thu"}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="lg"
        title="Tạo hóa đơn mới"
        description="Hệ thống xem trước bằng dữ liệu thật (chỉ số, số người đã xác minh, đơn giá của phòng) trước khi phát hành."
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">
              Phòng <span className="text-[#991b1b]">*</span>
            </span>
            <select
              value={form.roomId}
              onChange={(event) => setForm({ ...form, roomId: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">Chọn phòng</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Phòng {room.roomNumber}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className="block text-[13px] font-medium text-[#203c37]">Tháng</span>
              <NumericInput
                value={form.month}
                onChange={(value) => setForm({ ...form, month: value })}
                maxDecimals={0}
                placeholder="1-12"
                className={FIELD_CLASS}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="block text-[13px] font-medium text-[#203c37]">Năm</span>
              <NumericInput
                value={form.year}
                onChange={(value) => setForm({ ...form, year: value })}
                maxDecimals={0}
                placeholder="2026"
                className={FIELD_CLASS}
              />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">Phí khác (tuỳ chọn)</span>
            <NumericInput
              value={form.otherFee}
              onChange={(value) => setForm({ ...form, otherFee: value })}
              placeholder="0"
              invalid={form.otherFee.trim() !== "" && parseDecimalInput(form.otherFee) === null}
              className={FIELD_CLASS}
            />
          </label>


          <div className="rounded-[10px] border border-[#e2e7e1] bg-[#f7f6f2]/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-semibold text-[#203c37]">Xem trước hoá đơn</h4>
              {isPreviewing && <Loader2 className="size-4 animate-spin text-[#74817b]" />}
            </div>

            {previewError && (
              <p role="alert" className="text-[12px] font-medium text-[#991b1b]">
                {previewError}
              </p>
            )}

            {!preview && !previewError && (
              <p className="text-[12px] text-[#74817b]">Chọn phòng và kỳ để xem trước số tiền.</p>
            )}

            {preview && (
              <div className="space-y-2 text-[12px] text-[#203c37]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Phòng {preview.roomNumber}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${
                      preview.ready ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#fbeae6] text-[#a4422c]"
                    }`}
                  >
                    {preview.ready ? (
                      <>
                        <CheckCircle2 className="size-3" /> Đủ điều kiện phát hành
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-3" /> Chưa đủ điều kiện
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-[#74817b]">Hạn thanh toán</span>
                  <span className="text-right">{new Date(preview.periodEnd).toLocaleDateString("vi-VN")}</span>

                  <span className="text-[#74817b]">Số người đã xác minh</span>
                  <span className="text-right">
                    {preview.occupancy
                          ? preview.occupancy.verified
                            ? `${preview.occupancy.occupants} người (đã xác minh)`
                            : `${preview.occupancy.occupants} người (mặc định — chưa xác minh)`
                          : "Chưa có hợp đồng"}
                  </span>

                  <span className="text-[#74817b]">
                    Điện: {formatNumber(preview.reading?.electricityConsumption)} kWh ×{" "}
                    {formatDecimalMoney(preview.unitPrices.electricity)}
                  </span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.electricityFee)}</span>

                  <span className="text-[#74817b]">
                    Nước: {formatNumber(preview.reading?.waterConsumption)} m³ ×{" "}
                    {formatDecimalMoney(preview.unitPrices.water)}
                  </span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.waterFee)}</span>

                  <span className="text-[#74817b]">Tiền phòng (hợp đồng)</span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.roomFee)}</span>

                  <span className="text-[#74817b]">Phí internet / WiFi (cấu hình phòng)</span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.internetFee)}</span>

                  <span className="text-[#74817b]">Phí dịch vụ (cấu hình phòng)</span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.serviceFee)}</span>

                  <span className="text-[#74817b]">Phí gửi xe (cấu hình phòng)</span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.parkingFee)}</span>

                  <span className="text-[#74817b]">Phí khác</span>
                  <span className="text-right">{formatDecimalMoney(preview.fees?.otherFee)}</span>

                  <span className="font-semibold text-[#15594f] pt-1 border-t border-[#e2e7e1]">Tổng cộng</span>
                  <span className="text-right font-bold text-[#15594f] pt-1 border-t border-[#e2e7e1]">
                    {formatDecimalMoney(preview.fees?.totalAmount)}
                  </span>
                </div>

                {preview.blockers.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {preview.blockers.map((blocker) => (
                      <li
                        key={`${blocker.code}-${blocker.message}`}
                        className="flex items-start gap-1.5 text-[#a4422c]"
                      >
                        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-semibold">{blocker.code}</strong> — {blocker.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {createError && (
            <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
              {createError}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
              className="px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#203c37] hover:bg-[#f7f6f2] disabled:opacity-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreating || !preview?.ready}
              className="px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isCreating ? "Đang phát hành..." : "Phát hành hoá đơn"}
            </button>
          </div>
        </form>
      </Modal>


      <Modal
        isOpen={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        size="lg"
        title={detailInvoice ? `Hoá đơn tháng ${detailInvoice.month}/${detailInvoice.year}` : "Hoá đơn"}
        description="Số liệu dưới đây là snapshot lúc phát hành — đổi giá điện/nước sau đó không làm thay đổi hoá đơn này."
      >
        {detailInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <span className="text-[#74817b]">Phòng</span>
              <span className="text-right font-medium">
                {detailInvoice.room?.roomNumber ? `Phòng ${detailInvoice.room.roomNumber}` : detailInvoice.roomId}
              </span>
              <span className="text-[#74817b]">Khách thuê</span>
              <span className="text-right">{detailInvoice.tenant?.fullName ?? detailInvoice.tenantId}</span>
              <span className="text-[#74817b]">Hạn thanh toán</span>
              <span className="text-right">{new Date(detailInvoice.dueDate).toLocaleDateString("vi-VN")}</span>
              <span className="text-[#74817b]">Trạng thái</span>
              <span className="text-right font-semibold">
                {STATUS_MAP[detailInvoice.status]?.label ?? detailInvoice.status}
                {detailInvoice.paidAt ? ` — ${new Date(detailInvoice.paidAt).toLocaleDateString("vi-VN")}` : ""}
              </span>
            </div>

            <div className="rounded-[10px] border border-[#e2e7e1] overflow-hidden">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                    <th className="py-2.5 px-3">Khoản</th>
                    <th className="py-2.5 px-3 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3ef]">
                  <tr>
                    <td className="py-2 px-3">Tiền phòng</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.roomFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Tiền điện</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.electricityFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Tiền nước</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.waterFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Phí internet / WiFi</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.internetFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Phí dịch vụ</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.serviceFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Phí gửi xe</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.parkingFee)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Phí khác</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(detailInvoice.otherFee)}</td>
                  </tr>
                  <tr className="font-bold text-[#15594f]">
                    <td className="py-2.5 px-3">Tổng cộng</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(detailInvoice.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>


            <div>
              <h4 className="text-[13px] font-semibold text-[#203c37] mb-2">
                Chỉ số &amp; đơn giá tại thời điểm phát hành
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <span className="text-[#74817b]">Điện đầu kỳ → cuối kỳ</span>
                <span className="text-right">
                  {formatNumber(detailInvoice.electricityStart)} → {formatNumber(detailInvoice.electricityEnd)}
                </span>
                <span className="text-[#74817b]">Điện tiêu thụ</span>
                <span className="text-right">
                  {detailInvoice.electricityConsumption === null ||
                  detailInvoice.electricityConsumption === undefined
                    ? "Không có dữ liệu (hoá đơn cũ)"
                    : `${formatNumber(detailInvoice.electricityConsumption)} kWh`}
                </span>
                <span className="text-[#74817b]">Đơn giá điện</span>
                <span className="text-right">
                  {detailInvoice.electricityUnitPrice === null ||
                  detailInvoice.electricityUnitPrice === undefined
                    ? "Không có dữ liệu (hoá đơn cũ)"
                    : `${formatCurrency(detailInvoice.electricityUnitPrice)}/kWh`}
                </span>
                <span className="text-[#74817b]">Nước tiêu thụ</span>
                <span className="text-right">
                  {detailInvoice.waterConsumption === null || detailInvoice.waterConsumption === undefined
                    ? "Không có dữ liệu (hoá đơn cũ)"
                    : `${formatNumber(detailInvoice.waterConsumption)} m³`}
                </span>
                <span className="text-[#74817b]">Đơn giá nước</span>
                <span className="text-right">
                  {detailInvoice.waterUnitPrice === null || detailInvoice.waterUnitPrice === undefined
                    ? "Không có dữ liệu (hoá đơn cũ)"
                    : `${formatCurrency(detailInvoice.waterUnitPrice)}/m³`}
                </span>
                <span className="text-[#74817b]">Số người đã xác minh</span>
                <span className="text-right">
                  {detailInvoice.waterOccupants === null || detailInvoice.waterOccupants === undefined
                    ? "Không có dữ liệu (hoá đơn cũ)"
                    : `${detailInvoice.waterOccupants} người`}
                </span>
              </div>
            </div>

            {detailInvoice.status === "UNPAID" && (
              <button
                type="button"
                onClick={() => void handlePay(detailInvoice)}
                disabled={payingId === detailInvoice.id}
                className="w-full px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
              >
                {payingId === detailInvoice.id ? "Đang lưu..." : "Xác nhận đã thu tiền"}
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
