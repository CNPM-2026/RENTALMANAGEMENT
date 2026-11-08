"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Send,
  Sparkles,
  Check,
  X,
  MessageCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { RoommateInvitation as ApiInvitation } from "@/types/models";
import { Avatar } from "@/components/ui/avatar";

interface Invitation {
  id: string;
  type: "RECEIVED" | "SENT";
  userName: string;
  userAge: number;
  userOccupation: string;
  avatarUrl: string;
  matchScore: number;
  message: string;
  createdAt: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
}

export default function TenantRoommateInvitationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"RECEIVED" | "SENT">("RECEIVED");

  // State for invitations
  const [invitations, setInvitations] = React.useState<Invitation[]>([]);

  React.useEffect(() => {
    Promise.all([
      apiClient.roommateInvitations.getMine("received"),
      apiClient.roommateInvitations.getMine("sent"),
    ]).then(([received, sent]) => {
      const map = (items: ApiInvitation[], type: Invitation["type"]) => items.map((item) => {
        const user = type === "RECEIVED" ? item.sender : item.recipient;
        return {
          id: item.id,
          type,
          userName: user?.fullName ?? "Người dùng",
          userAge: user?.profile?.dob ? new Date().getFullYear() - new Date(user.profile.dob).getFullYear() : 0,
          userOccupation: user?.profile?.occupation ?? "Chưa cập nhật",
          avatarUrl: user?.avatarUrl ?? "/placeholder-avatar.png",
          matchScore: 0,
          message: item.message ?? "",
          createdAt: new Date(item.createdAt).toLocaleString("vi-VN"),
          status: item.status === "CANCELLED" ? "DECLINED" : item.status,
        };
      });
      setInvitations([...map(received, "RECEIVED"), ...map(sent, "SENT")]);
    }).catch(() => setInvitations([]));
  }, []);

  const handleAccept = async (id: string) => {
    await apiClient.roommateInvitations.updateStatus(id, "ACCEPTED");
    setInvitations((prev) => prev.map((item) => item.id === id ? { ...item, status: "ACCEPTED" } : item));
  };

  const handleDecline = async (id: string) => {
    await apiClient.roommateInvitations.updateStatus(id, "DECLINED");
    setInvitations((prev) => prev.map((item) => item.id === id ? { ...item, status: "DECLINED" } : item));
  };

  const receivedList = invitations.filter((inv) => inv.type === "RECEIVED");
  const sentList = invitations.filter((inv) => inv.type === "SENT");
  const currentList = activeTab === "RECEIVED" ? receivedList : sentList;

  const pendingReceivedCount = receivedList.filter((i) => i.status === "PENDING").length;

  return (
    <div className="space-y-6 max-w-[1204px]">
      {/* Page Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">
          Quản lý lời mời kết nối ở ghép
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Theo dõi các lời mời kết nối bạn cùng phòng đã nhận và đã gửi trên nền tảng 5K-Rental Manager.
        </p>
      </div>

      {/* Tabs (Figma 44:63966) */}
      <div className="flex border-b border-[#e2e7e1] gap-8">
        <button
          type="button"
          onClick={() => setActiveTab("RECEIVED")}
          className={`pb-3 text-[14px] font-semibold border-b-2 -mb-px flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "RECEIVED"
              ? "border-[#15594f] text-[#15594f]"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          <Inbox className="size-4" />
          Lời mời đã nhận
          {pendingReceivedCount > 0 && (
            <span className="size-5 rounded-full bg-[#15594f] text-white text-[11px] font-bold flex items-center justify-center">
              {pendingReceivedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("SENT")}
          className={`pb-3 text-[14px] font-semibold border-b-2 -mb-px flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === "SENT"
              ? "border-[#15594f] text-[#15594f]"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          <Send className="size-4" />
          Lời mời đã gửi ({sentList.length})
        </button>
      </div>

      {/* Content List */}
      <div className="space-y-4">
        {currentList.length === 0 ? (
          <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-12 text-center space-y-3">
            <Inbox className="size-10 text-[#74817b] mx-auto" />
            <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có lời mời nào</h3>
            <p className="text-[13px] text-[#74817b]">
              Hãy truy cập mục &ldquo;Khám phá người hợp gu&rdquo; để kết nối với những ứng viên tiềm năng.
            </p>
            <Link href="/roommates">
              <Button variant="primary" size="sm">Khám phá bạn ghép</Button>
            </Link>
          </Card>
        ) : (
          currentList.map((item) => (
            <Card
              key={item.id}
              className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm hover:border-[#15594f]/30 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#e2e7e1]">
                    <Avatar src={item.avatarUrl} alt={item.userName} className="size-full object-cover" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-[16px] font-bold text-[#203c37]">{item.userName}</h4>
                      <Badge variant="success" size="sm">
                        <Sparkles className="size-3 mr-1" /> {item.matchScore}% Tương thích
                      </Badge>
                      <span className="text-[12px] text-[#74817b]">• {item.createdAt}</span>
                    </div>
                    <p className="text-[13px] text-[#74817b]">{item.userAge} tuổi • {item.userOccupation}</p>
                    <p className="text-[13px] text-[#203c37] bg-[#f7f6f2] p-3 rounded-[8px] mt-2 italic">
                      &ldquo;{item.message}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex flex-col items-end gap-2.5 shrink-0">
                  {item.status === "PENDING" && (
                    <Badge variant="warning" size="md">Chờ phản hồi</Badge>
                  )}
                  {item.status === "ACCEPTED" && (
                    <Badge variant="success" size="md">Đã chấp thuận</Badge>
                  )}
                  {item.status === "DECLINED" && (
                    <Badge variant="neutral" size="md">Đã từ chối</Badge>
                  )}

                  {item.type === "RECEIVED" && item.status === "PENDING" && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDecline(item.id)}
                        leftIcon={<X className="size-3.5" />}
                      >
                        Từ chối
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAccept(item.id)}
                        leftIcon={<Check className="size-3.5" />}
                      >
                        Đồng ý
                      </Button>
                    </div>
                  )}

                  {item.status === "ACCEPTED" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/tenant/messages?user=${item.id}`)}
                      leftIcon={<MessageCircle className="size-3.5" />}
                    >
                      Bắt đầu chat
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}