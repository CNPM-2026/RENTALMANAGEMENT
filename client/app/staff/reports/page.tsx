"use client";

import * as React from "react";
import { AlertTriangle, Flag, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import { readFocusParam, scrollToFocus } from "@/lib/notification-focus";
import type { Report } from "@/types/models";

/**
 * BÁO CÁO / TRANH CHẤP DO THỢ GỬI.
 *
 * Khi Admin kết luận, `DISPUTE` notification mở `/staff/reports?report=<id>` để
 * thợ đọc đúng kết luận thay vì rơi về trang nội dung thông báo.
 */
export default function StaffReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [focusId, setFocusId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.reports
      .getMy()
      .then((items) => {
        if (!cancelled) {
          setReports(items ?? []);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReports([]);
          setError(err instanceof Error ? err.message : "Không tải được danh sách báo cáo.");
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
    const id = readFocusParam("report");
    if (!id) return;
    const frame = window.requestAnimationFrame(() => {
      setFocusId(id);
      scrollToFocus(`report-${id}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reports]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Hỗ trợ & an toàn</p>
        <h1 className="mt-0.5 text-[26px] font-semibold text-[#203c37]">Báo cáo của tôi</h1>
        <p className="mt-0.5 text-[14px] text-[#74817b]">
          Các báo cáo bạn đã gửi về chủ trọ, khách thuê hoặc công việc bảo trì.
        </p>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-[10px] border border-[#f0d5cd] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-[12px] border border-[#e2e7e1] bg-white p-8 text-sm text-[#74817b]">
          <RefreshCw className="size-4 animate-spin" /> Đang tải báo cáo...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Flag className="mx-auto mb-3 size-12 text-[#9bb5a8]" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có báo cáo nào</h3>
          <p className="mt-1 text-[13px] text-[#74817b]">Báo cáo bạn gửi sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li
              key={report.id}
              id={`report-${report.id}`}
              className={`scroll-mt-24 rounded-[12px] border bg-white p-5 shadow-xs ${
                focusId === report.id
                  ? "border-[#15594f] ring-2 ring-[#15594f]/25"
                  : "border-[#e2e7e1]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-[#203c37]">
                  {report.category ?? "Báo cáo vi phạm"}
                </p>
                <span className="rounded-full bg-[#f7f6f2] px-2.5 py-0.5 text-[11px] font-semibold text-[#74817b]">
                  {report.status === "RESOLVED"
                    ? "Đã giải quyết"
                    : report.status === "REJECTED"
                      ? "Đã bác bỏ"
                      : report.status === "UNDER_REVIEW"
                        ? "Đang xem xét"
                        : "Chờ xử lý"}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[13px] text-[#5c6964]">{report.reason}</p>
              {report.resolution && (
                <p className="mt-2 rounded-[6px] bg-[#eaf2ed] px-3 py-2 text-[12px] text-[#15594f]">
                  Kết luận của Admin: {report.resolution}
                </p>
              )}
              <p className="mt-2 text-[11px] text-[#74817b]">
                Gửi lúc {new Date(report.createdAt).toLocaleString("vi-VN")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
