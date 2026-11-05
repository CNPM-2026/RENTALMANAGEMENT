"use client";

import * as React from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  Plus,
  FileText,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  Info,
  Clock,
  CheckCircle,
  AlertCircle,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { SupportTicket } from "@/types/models";

export default function TenantSupportCenterPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);

  React.useEffect(() => {
    apiClient.support.getMine().then(setTickets).catch(() => setTickets([]));
  }, []);

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === "PROCESSING" && !["OPEN", "IN_PROGRESS"].includes(t.status)) return false;
    if (statusFilter === "RESOLVED" && !["RESOLVED", "CLOSED"].includes(t.status)) return false;
    if (
      searchQuery &&
      !t.subject.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-[1204px]">
      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">
          Trung tâm Hỗ trợ & Theo dõi Yêu cầu
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Tìm kiếm giải pháp nhanh hoặc gửi yêu cầu để được đội ngũ 5K-Rental Manager hỗ trợ giải quyết.
        </p>
      </div>

      {/* 1. Search Box (Figma 44:66489) */}
      <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-3.5 size-4.5 text-[#74817b]" />
            <input
              type="text"
              placeholder="Tìm kiếm câu hỏi, vấn đề thường gặp hoặc nhập mã phiếu (#TK-8021)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[48px] pl-10 pr-4 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] focus:bg-white outline-none"
            />
          </div>
          <Button variant="primary" size="md">Tìm trợ giúp</Button>
        </div>
      </Card>

      {/* 2. Common Help Categories (Figma 44:66497) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 hover:border-[#15594f]/40 hover:shadow-sm transition-all cursor-pointer">
          <div className="size-11 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mb-3.5">
            <FileText className="size-5" />
          </div>
          <h3 className="text-[16px] font-bold text-[#203c37]">Hợp đồng & Tiền cọc</h3>
          <p className="text-[13px] text-[#74817b] mt-1 leading-relaxed">
            Quy trình ký hợp đồng số, bảo vệ tiền đặt cọc trung gian và thủ tục thanh lý trả phòng.
          </p>
        </Card>

        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 hover:border-[#15594f]/40 hover:shadow-sm transition-all cursor-pointer">
          <div className="size-11 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mb-3.5">
            <CreditCard className="size-5" />
          </div>
          <h3 className="text-[16px] font-bold text-[#203c37]">Hóa đơn & Thanh toán</h3>
          <p className="text-[13px] text-[#74817b] mt-1 leading-relaxed">
            Cách thức đóng tiền phòng qua VietQR, cách tính tiền điện nước và đối soát hóa đơn tự động.
          </p>
        </Card>

        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 hover:border-[#15594f]/40 hover:shadow-sm transition-all cursor-pointer">
          <div className="size-11 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center mb-3.5">
            <ShieldCheck className="size-5" />
          </div>
          <h3 className="text-[16px] font-bold text-[#203c37]">An toàn & Báo cáo</h3>
          <p className="text-[13px] text-[#74817b] mt-1 leading-relaxed">
            Chính sách bảo mật danh tính, hướng dẫn tố cáo vi phạm và số hotline khẩn cấp 24/7.
          </p>
        </Card>
      </div>

      {/* 3. My Tickets Section (Figma 44:66510) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-bold text-[#203c37]">Phiếu yêu cầu hỗ trợ của bạn</h2>
            <p className="text-[13px] text-[#74817b]">Theo dõi tiến độ xử lý sự cố và trao đổi với kỹ thuật viên.</p>
          </div>
          <Link href="/tenant/support/create">
            <Button variant="primary" size="md" leftIcon={<Plus className="size-4" />}>
              Gửi yêu cầu hỗ trợ mới
            </Button>
          </Link>
        </div>

        {/* Status Filters */}
        <div className="flex border-b border-[#e2e7e1] gap-6 text-[13px] font-medium">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`pb-3 border-b-2 -mb-px transition-colors cursor-pointer ${
              statusFilter === "ALL" ? "border-[#15594f] text-[#15594f] font-bold" : "border-transparent text-[#74817b]"
            }`}
          >
            Tất cả phiếu ({tickets.length})
          </button>
          <button
            onClick={() => setStatusFilter("PROCESSING")}
            className={`pb-3 border-b-2 -mb-px transition-colors cursor-pointer ${
              statusFilter === "PROCESSING" ? "border-[#15594f] text-[#15594f] font-bold" : "border-transparent text-[#74817b]"
            }`}
          >
            Đang xử lý
          </button>
          <button
            onClick={() => setStatusFilter("RESOLVED")}
            className={`pb-3 border-b-2 -mb-px transition-colors cursor-pointer ${
              statusFilter === "RESOLVED" ? "border-[#15594f] text-[#15594f] font-bold" : "border-transparent text-[#74817b]"
            }`}
          >
            Đã giải quyết
          </button>
        </div>

        {/* Tickets Table / Cards List */}
        <div className="space-y-3">
          {filteredTickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm hover:border-[#15594f]/40 transition-all"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[12px] font-bold text-[#15594f] bg-[#eaf2ed] px-2 py-0.5 rounded-[4px]">
                      #{ticket.id}
                    </span>
                    <h4 className="text-[15px] font-bold text-[#203c37]">{ticket.subject}</h4>
                    <Badge variant={["RESOLVED", "CLOSED"].includes(ticket.status) ? "success" : "info"} size="sm">
                      {["RESOLVED", "CLOSED"].includes(ticket.status) ? "Đã giải quyết" : "Đang xử lý"}
                    </Badge>
                  </div>
                  <p className="text-[13px] text-[#74817b]">
                    {ticket.category} • Phòng: <strong className="text-[#203c37]">{ticket.room?.roomNumber ?? "Không gắn phòng"}</strong> • Tạo lúc: {new Date(ticket.createdAt).toLocaleString("vi-VN")}
                  </p>
                  <p className="text-[13px] text-[#203c37] bg-[#f7f6f2] p-2.5 rounded-[6px] mt-1 italic">
                    Phản hồi mới nhất: {ticket.adminReply ?? "Đang chờ bộ phận hỗ trợ phản hồi."}
                  </p>
                </div>

                <Link href={`/tenant/support/${ticket.id}`} className="shrink-0">
                  <Button variant="outline" size="sm" rightIcon={<ChevronRight className="size-4" />}>
                    Xem chi tiết
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Hotline & Safety Note (Figma 44:66558) */}
      <div className="bg-[#eaf2ed] border border-[#15594f]/20 rounded-[12px] p-5 flex items-start gap-4">
        <PhoneCall className="size-5 text-[#15594f] shrink-0 mt-0.5" />
        <div className="text-[13px] text-[#203c37] leading-relaxed">
          <strong className="font-semibold text-[#15594f]">Tổng đài hỗ trợ khẩn cấp 5K-Rental Manager (24/7):</strong> Trong các trường hợp khẩn cấp về an ninh, chập cháy điện nước hoặc sự cố ngoài giờ làm việc, vui lòng gọi ngay hotline miễn phí <span className="font-bold text-[#15594f]">1900 5858</span> để được hỗ trợ kịp thời.
        </div>
      </div>
    </div>
  );
}