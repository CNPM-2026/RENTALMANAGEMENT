"use client";

import * as React from "react";
import { Activity, Server, Cpu, Database, CheckCircle2 } from "lucide-react";

export default function AdminStatsSystemPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Thống kê toàn diện</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Hoạt động Hệ thống & Hạ tầng</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Tình trạng máy chủ API, cơ sở dữ liệu Supabase PostgreSQL và tỷ lệ uptime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
            <Server className="size-4 text-[#15594f]" />
            <span>API Server</span>
          </div>
          <p className="text-[20px] font-bold text-[#15594f] mt-2">Hoạt động</p>
          <p className="text-[11px] text-[#74817b] mt-1">Node 22 / Express v1</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
            <Database className="size-4 text-[#2d5d8c]" />
            <span>Cơ sở dữ liệu</span>
          </div>
          <p className="text-[20px] font-bold text-[#2d5d8c] mt-2">Supabase Cloud</p>
          <p className="text-[11px] text-[#74817b] mt-1">PostgreSQL v15 Latency ~32ms</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
            <Activity className="size-4 text-[#15594f]" />
            <span>Uptime 30 ngày</span>
          </div>
          <p className="text-[20px] font-bold text-[#15594f] mt-2">99.98%</p>
          <p className="text-[11px] text-[#74817b] mt-1">Không có gián đoạn</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
            <Cpu className="size-4 text-[#9a6a12]" />
            <span>Tải CPU máy chủ</span>
          </div>
          <p className="text-[20px] font-bold text-[#203c37] mt-2">12.4%</p>
          <p className="text-[11px] text-[#74817b] mt-1">RAM 1.2 GB / 4.0 GB</p>
        </div>
      </div>
    </div>
  );
}
