"use client";

import * as React from "react";
import { Plus, Receipt, Search, CheckCircle2, Clock, AlertTriangle, Eye } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Invoice, InvoiceStatus } from "@/types/models";
import { Modal } from "@/components/ui/modal";

const STATUS_MAP: Record<InvoiceStatus, { label: string; bg: string; text: string }> = {
  PAID: { label: "Đã thanh toán", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  UNPAID: { label: "Chưa thanh toán", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(val);
}

export default function LandlordInvoicesPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState({ roomId: "", month: "", year: "", otherFee: "0" });

  const openCreateForm = () => {
    const now = new Date();
    setForm((current) => ({
      ...current,
      month: current.month || String(now.getMonth() + 1),
      year: current.year || String(now.getFullYear()),
    }));
    setIsCreateOpen(true);
  };

  React.useEffect(() => {
    apiClient.invoices
      .getMyInvoices()
      .then((data) => setInvoices(data ?? []))
      .catch(() => setInvoices([]))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = invoices.filter((inv) => statusFilter === "ALL" || inv.status === statusFilter);
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await apiClient.invoices.generate({ roomId: form.roomId, month: Number(form.month), year: Number(form.year), otherFee: Number(form.otherFee) });
    setInvoices((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Hóa đơn & Thu tiền</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Quản lý hóa đơn tiền phòng, điện nước và đối soát thanh toán.</p>
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
              statusFilter === st
                ? "bg-[#15594f] text-white font-semibold"
                : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            {st === "ALL" ? "Tất cả" : STATUS_MAP[st as InvoiceStatus]?.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Receipt className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có hóa đơn nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Tạo hóa đơn hàng tháng để gửi cho khách thuê thanh toán.</p>
        </div>
      ) : (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                  <th className="py-3 px-4">Kỳ hóa đơn</th>
                  <th className="py-3 px-4">Hạn thanh toán</th>
                  <th className="py-3 px-4">Tiền phòng</th>
                  <th className="py-3 px-4">Điện + Nước</th>
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
                        Tháng {inv.month}/{inv.year}
                      </td>
                      <td className="py-3.5 px-4 text-[#74817b]">
                        {new Date(inv.dueDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3.5 px-4">{formatCurrency(inv.roomFee)}</td>
                      <td className="py-3.5 px-4 text-[#74817b]">
                        {formatCurrency(inv.electricityFee + inv.waterFee)}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#15594f]">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => window.open(`/tenant/invoices/${inv.id}`, "_self")}
                          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#15594f] hover:underline cursor-pointer"
                        >
                          <Eye className="size-3.5" />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Tạo hóa đơn mới">
        <form onSubmit={handleCreate} className="space-y-3">
          <input required placeholder="ID phòng" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" min="1" max="12" placeholder="Tháng" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="rounded border p-2 text-sm" />
            <input required type="number" min="2020" placeholder="Năm" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="rounded border p-2 text-sm" />
          </div>
          <input type="number" min="0" placeholder="Phí khác" value={form.otherFee} onChange={(e) => setForm({ ...form, otherFee: e.target.value })} className="w-full rounded border p-2 text-sm" />
          <button type="submit" className="rounded bg-[#15594f] px-4 py-2 text-sm font-semibold text-white">Tạo hóa đơn</button>
        </form>
      </Modal>
    </div>
  );
}
