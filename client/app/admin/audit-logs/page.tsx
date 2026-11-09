"use client";

import * as React from "react";
import { History, Search, Filter, Shield, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import { AuditLog } from "@/types/models";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    apiClient.adminGovernance.getAuditLogs({ search: search || undefined })
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [search]);

  const filtered = logs.filter((log) =>
    (log.action ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (log.entityType ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Quản trị hệ thống</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Nhật ký hoạt động</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Lưu vết toàn bộ thao tác quản trị, phê duyệt và thay đổi dữ liệu trên hệ thống.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo hành động, nội dung chi tiết..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
              <th className="py-3 px-4">Thời gian</th>
              <th className="py-3 px-4">Hành động</th>
              <th className="py-3 px-4">Đối tượng</th>
              <th className="py-3 px-4">Chi tiết thao tác</th>
              <th className="py-3 px-4 text-right">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
            {filtered.map((log) => (
              <tr key={log.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                <td className="py-3.5 px-4 text-[#74817b] whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString("vi-VN")}
                </td>
                <td className="py-3.5 px-4">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-[5px] bg-[#eaf2ed] text-[#15594f]">
                    {log.action}
                  </span>
                </td>
                <td className="py-3.5 px-4 font-semibold text-[#203c37]">{log.entityType}</td>
                <td className="py-3.5 px-4 text-[#203c37] max-w-md truncate">{log.entityId || "---"}</td>
                <td className="py-3.5 px-4 text-right text-[#74817b] font-mono text-[11px]">
                  {log.ipAddress || "127.0.0.1"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
