"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle2,
  Calendar,
  DollarSign,
  MessageCircle,
  ArrowRight,
  ShieldCheck,
  Building,
  User,
  XCircle,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface RentalRequest {
  id: string;
  contractId?: string;
  roomTitle: string;
  roomNumber: string;
  roomAddress: string;
  roomImage: string;
  monthlyRent: number;
  depositAmount: number;
  moveInDate: string;
  leaseTermMonths: number;
  occupantsCount: number;
  landlordName: string;
  landlordPhone: string;
  status: "SUBMITTED" | "APPROVED" | "CONTRACT_READY" | "SIGNED" | "REJECTED";
  currentStep: number; // 1 to 4
  createdAt: string;
}

const INITIAL_REQUESTS: RentalRequest[] = [
  {
    id: "req-1",
    contractId: "contract-hd-2026-01",
    roomTitle: "Studio Ban Mai — Ban Công Hướng Đông",
    roomNumber: "P.302",
    roomAddress: "142 Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM",
    roomImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
    monthlyRent: 4500000,
    depositAmount: 4500000,
    moveInDate: "15/11/2026",
    leaseTermMonths: 12,
    occupantsCount: 1,
    landlordName: "Nguyễn Minh An",
    landlordPhone: "0912345678",
    status: "APPROVED",
    currentStep: 3, // Ready to sign contract
    createdAt: "04/11/2026",
  },
  {
    id: "req-2",
    roomTitle: "Căn Hộ Sunshine — Trung Tâm Quận 1",
    roomNumber: "P.501",
    roomAddress: "88 Nguyễn Du, Phường Bến Nghé, Quận 1, TP.HCM",
    roomImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80",
    monthlyRent: 6200000,
    depositAmount: 6200000,
    moveInDate: "01/12/2026",
    leaseTermMonths: 6,
    occupantsCount: 2,
    landlordName: "Trần Văn Bình",
    landlordPhone: "0908123456",
    status: "SUBMITTED",
    currentStep: 1, // Pending landlord review
    createdAt: "05/11/2026",
  },
  {
    id: "req-3",
    contractId: "contract-hd-2025-99",
    roomTitle: "Phòng Trọ Gác Lửng Xanh — TP. Thủ Đức",
    roomNumber: "P.204",
    roomAddress: "24 Đường số 6, Linh Trung, TP. Thủ Đức, TP.HCM",
    roomImage: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80",
    monthlyRent: 3200000,
    depositAmount: 3200000,
    moveInDate: "01/09/2025",
    leaseTermMonths: 12,
    occupantsCount: 1,
    landlordName: "Lê Hoàng Yến",
    landlordPhone: "0934567890",
    status: "SIGNED",
    currentStep: 4, // Completed
    createdAt: "25/08/2025",
  },
];

export default function TenantRentalRequestsPage() {
  const [activeTab, setActiveTab] = React.useState<"ALL" | "PENDING" | "APPROVED" | "COMPLETED">("ALL");
  const [requests, setRequests] = React.useState<RentalRequest[]>(INITIAL_REQUESTS);

  const filteredRequests = requests.filter((r) => {
    if (activeTab === "PENDING") return r.status === "SUBMITTED";
    if (activeTab === "APPROVED") return r.status === "APPROVED" || r.status === "CONTRACT_READY";
    if (activeTab === "COMPLETED") return r.status === "SIGNED";
    return true;
  });

  const stepsDef = [
    { stepNum: 1, label: "Gửi yêu cầu", desc: "Hồ sơ đã nộp" },
    { stepNum: 2, label: "Chủ trọ duyệt", desc: "Thẩm định hồ sơ" },
    { stepNum: 3, label: "Ký hợp đồng số", desc: "Ký kết & cọc" },
    { stepNum: 4, label: "Nhận bàn giao", desc: "Hoàn tất thủ tục" },
  ];

  return (
    <div className="space-y-6">
      {/* =======================================================================
          1. HEADER & BREADCRUMBS (Figma Node 44:65013)
      ======================================================================== */}
      <div className="space-y-1">
        <nav className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
          <Link href="/" className="hover:text-[#15594f]">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-[#203c37] font-medium">Yêu cầu thuê phòng</span>
        </nav>
        <h1 className="text-2xl font-bold text-[#203c37] tracking-tight pt-0.5">
          Theo dõi yêu cầu thuê phòng
        </h1>
        <p className="text-[14px] text-[#74817b]">
          Cập nhật trạng thái phê duyệt hồ sơ và tiến trình ký hợp đồng thuê điện tử
        </p>
      </div>

      {/* =======================================================================
          2. FILTER TABS (Figma Node 44:65020)
      ======================================================================== */}
      <div className="flex items-center gap-2 border-b border-[#e2e7e1] pb-2">
        {[
          { id: "ALL", label: `Tất cả (${requests.length})` },
          { id: "PENDING", label: "Chờ chủ trọ duyệt" },
          { id: "APPROVED", label: "Đã chấp thuận & Ký HĐ" },
          { id: "COMPLETED", label: "Đã hoàn tất" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-[#15594f] text-white shadow-xs"
                : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =======================================================================
          3. RENTAL REQUEST CARDS WITH STEPPER PROGRESS (Figma Node 44:65029)
      ======================================================================== */}
      <div className="space-y-6">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className="p-6 rounded-[16px] bg-white border border-[#e2e7e1] shadow-xs space-y-6"
          >
            {/* Top Card Row */}
            <div className="flex flex-col md:flex-row gap-5 items-start justify-between">
              <div className="flex gap-4 items-start min-w-0">
                <img
                  src={req.roomImage}
                  alt={req.roomTitle}
                  className="size-24 rounded-[10px] object-cover shrink-0"
                />

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#15594f] text-white text-[11px] font-bold">
                      {req.roomNumber}
                    </span>
                    <h3 className="text-[16px] font-bold text-[#203c37]">
                      {req.roomTitle}
                    </h3>
                    {req.status === "APPROVED" && (
                      <Badge variant="success" size="sm">
                        CHỦ TRỌ ĐÃ CHẤP THUẬN
                      </Badge>
                    )}
                    {req.status === "SUBMITTED" && (
                      <Badge variant="warning" size="sm">
                        CHỜ DUYỆT HỒ SƠ
                      </Badge>
                    )}
                    {req.status === "SIGNED" && (
                      <Badge variant="neutral" size="sm">
                        ĐÃ KÝ HỢP ĐỒNG
                      </Badge>
                    )}
                  </div>

                  <p className="text-[13px] text-[#74817b]">
                    {req.roomAddress}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[12px] pt-1">
                    <span>
                      Ngày dọn vào: <strong className="text-[#203c37]">{req.moveInDate}</strong>
                    </span>
                    <span>
                      Thời hạn: <strong className="text-[#203c37]">{req.leaseTermMonths} tháng</strong>
                    </span>
                    <span>
                      Giá thuê: <strong className="text-[#15594f]">{req.monthlyRent.toLocaleString("vi-VN")} đ/tháng</strong>
                    </span>
                    <span>
                      Tiền cọc: <strong className="text-[#203c37]">{req.depositAmount.toLocaleString("vi-VN")} đ</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center shrink-0">
                {req.status === "APPROVED" && req.contractId && (
                  <Link href={`/tenant/contracts/${req.contractId}`}>
                    <Button
                      variant="primary"
                      size="md"
                      className="font-bold shadow-md"
                      leftIcon={<FileCheck className="size-4" />}
                    >
                      Xem & Ký hợp đồng điện tử
                    </Button>
                  </Link>
                )}

                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<MessageCircle className="size-4 text-[#15594f]" />}
                  onClick={() => alert(`Mở khung chat với chủ trọ ${req.landlordName}`)}
                >
                  Nhắn tin với chủ trọ
                </Button>
              </div>
            </div>

            {/* Stepper Progress Bar (Figma Node 44:65051) */}
            <div className="pt-4 border-t border-[#e2e7e1]">
              <div className="relative flex items-center justify-between max-w-3xl mx-auto px-4">
                {/* Connecting Line */}
                <div className="absolute left-8 right-8 top-4 h-0.5 bg-[#e2e7e1] -z-0" />
                <div
                  className="absolute left-8 top-4 h-0.5 bg-[#15594f] transition-all duration-300 -z-0"
                  style={{
                    width: `${((req.currentStep - 1) / 3) * 100}%`,
                  }}
                />

                {stepsDef.map((s) => {
                  const isDone = s.stepNum < req.currentStep;
                  const isCurrent = s.stepNum === req.currentStep;
                  return (
                    <div
                      key={s.stepNum}
                      className="relative z-10 flex flex-col items-center text-center space-y-1.5"
                    >
                      <div
                        className={`size-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-colors ${
                          isDone
                            ? "bg-[#15594f] text-white"
                            : isCurrent
                            ? "bg-white text-[#15594f] ring-2 ring-[#15594f] font-extrabold"
                            : "bg-[#f7f6f2] text-[#74817b] border border-[#e2e7e1]"
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="size-4.5" /> : s.stepNum}
                      </div>

                      <div className="space-y-0.5">
                        <p
                          className={`text-[12px] font-bold ${
                            isCurrent || isDone ? "text-[#15594f]" : "text-[#74817b]"
                          }`}
                        >
                          {s.label}
                        </p>
                        <p className="text-[10px] text-[#74817b]">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Safety Notice Card */}
      <div className="p-4 rounded-[12px] bg-[#f2ede3]/70 border border-[#e2e7e1] flex items-start gap-3">
        <ShieldCheck className="size-5 text-[#15594f] shrink-0 mt-0.5" />
        <div className="text-[13px] text-[#203c37] leading-relaxed">
          <strong className="block font-semibold">Quy trình ký hợp đồng an toàn:</strong>
          Sau khi chủ trọ phê duyệt hồ sơ, hợp đồng điện tử sẽ được tạo tự động với các điều khoản đã cam kết. Tiền cọc phòng sẽ được bảo toàn qua tài khoản ký quỹ trung gian của 5K-Rental Manager cho đến khi bạn xác nhận nhận chìa khóa và kiểm tra hiện trạng phòng xong.
        </div>
      </div>
    </div>
  );
}
