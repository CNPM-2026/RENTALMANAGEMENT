"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Search, Building, BadgeCheck, FileText, CheckCircle, XCircle } from "lucide-react";

export default function AdminLandlordsPage() {
  const landlords = [
    { id: "1", name: "Trần Minh An", phone: "0987654321", email: "landlord.test@rental.local", propertiesCount: 3, roomsCount: 50, kycStatus: "VERIFIED" },
    { id: "2", name: "Đức Quang", phone: "0934567890", email: "quang.duc@rental.vn", propertiesCount: 2, roomsCount: 24, kycStatus: "PENDING" },
    { id: "3", name: "Nguyễn Thị Hà", phone: "0911222333", email: "ha.nguyen@gmail.com", propertiesCount: 1, roomsCount: 10, kycStatus: "VERIFIED" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài khoản & KYC</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Quản lý Chủ trọ</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Danh sách các đối tác chủ cơ sở và tình trạng xác thực danh tính.</p>
        </div>
        <Link
          href="/admin/landlords/kyc"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start"
        >
          <BadgeCheck className="size-4" />
          <span>Hồ sơ chờ duyệt KYC</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {landlords.map((l) => (
          <div key={l.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="size-10 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center font-bold text-sm">
                  {l.name.charAt(0)}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    l.kycStatus === "VERIFIED" ? "bg-[#eaf2ed] text-[#15594f]" : "bg-[#fbf1dc] text-[#9a6a12]"
                  }`}
                >
                  {l.kycStatus === "VERIFIED" ? "Đã KYC" : "Chờ KYC"}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">{l.name}</h3>
              <p className="text-[12px] text-[#74817b] mt-0.5">{l.email} • {l.phone}</p>

              <div className="mt-4 pt-3 border-t border-[#e2e7e1] flex items-center justify-between text-[12px] text-[#203c37]">
                <span>{l.propertiesCount} cơ sở</span>
                <span className="font-semibold text-[#15594f]">{l.roomsCount} phòng trọ</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
