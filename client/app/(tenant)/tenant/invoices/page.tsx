"use client";

import * as React from "react";
import { Receipt, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { FOCUS_ROW_CLASS, readFocusParam, scrollToFocus } from "@/lib/notification-focus";
import type { Invoice } from "@/types/models";

/**
 * HOÁ ĐƠN CỦA KHÁCH THUÊ.
 *
 * Trước đây thông báo INVOICE của tenant trỏ sang trang hợp đồng, nơi không có
 * hoá đơn nào. Trang này đọc đúng phạm vi `scope=tenant` (kể cả tài khoản vừa
 * là khách thuê vừa là nhân viên chủ trọ) và nhận `?invoice=<id>` từ thông báo
 * để cuộn/tô sáng hoá đơn tương ứng.
 */
export default function TenantInvoicesPage() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.invoices
      .getMyInvoices("tenant")
      .then((items) => {
        if (!cancelled) {
          setInvoices(items ?? []);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setInvoices([]);
          setError(err instanceof Error ? err.message : "Không tải được danh sách hoá đơn.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const id = readFocusParam("invoice");
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      setFocusId(id);
      scrollToFocus(`invoice-${id}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [invoices]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Tài khoản</p>
        <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">Hoá đơn của tôi</h1>
        <p className="mt-0.5 text-[14px] text-[#74817b]">
          Theo dõi tiền phòng, điện nước và trạng thái thanh toán theo từng tháng.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-[12px] border border-[#e2e7e1] bg-white" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Receipt className="mx-auto mb-3 size-12 text-[#9bb5a8]" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có hoá đơn nào</h3>
          <p className="mt-1 text-[13px] text-[#74817b]">
            Hoá đơn do chủ trọ phát hành sẽ xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const isFocused = focusId === invoice.id;
            const isPaid = invoice.status === "PAID";
            return (
              <article
                key={invoice.id}
                id={`invoice-${invoice.id}`}
                className={`rounded-[12px] border bg-white p-5 shadow-xs ${FOCUS_ROW_CLASS} ${
                  isFocused ? "border-[#15594f] ring-2 ring-[#15594f]/25" : "border-[#e2e7e1]"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[16px] font-semibold text-[#203c37]">
                        Hoá đơn tháng {invoice.month}/{invoice.year}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isPaid ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#fbf1dc] text-[#9a6a12]"
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                        {isPaid ? "Đã thanh toán" : "Chưa thanh toán"}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#74817b]">
                      Phòng {invoice.room?.roomNumber ?? invoice.roomId.slice(0, 8)}
                      {invoice.room?.property?.name ? ` · ${invoice.room.property.name}` : ""}
                    </p>
                    <p className="text-[12px] text-[#74817b]">
                      Hạn thanh toán: {new Date(invoice.dueDate).toLocaleDateString("vi-VN")}
                      {invoice.paidAt
                        ? ` · đã trả ${new Date(invoice.paidAt).toLocaleString("vi-VN")}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-[12px] text-[#74817b]">Tổng cộng</p>
                    <p className="text-[20px] font-bold text-[#15594f]">
                      {formatCurrency(invoice.totalAmount, { showUnit: false })} đ
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
