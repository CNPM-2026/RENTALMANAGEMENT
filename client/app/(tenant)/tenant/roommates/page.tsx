"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Home,
  DoorOpen,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Receipt,
  UserCheck,
  UserPlus,
  ExternalLink,
  ShieldCheck,
  Info,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import type { Contract, User } from "@/types/models";

export default function TenantRoommatesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [openingChatId, setOpeningChatId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    apiClient.contracts
      .getMyContracts("tenant")
      .then((data) => {
        const active = (data ?? []).filter((c) => c.status === "ACTIVE");
        setContracts(active.length > 0 ? active : (data ?? []));
        if (active.length > 0) {
          setSelectedContractId(active[0].id);
        } else if (data && data.length > 0) {
          setSelectedContractId(data[0].id);
        }
      })
      .catch(() => setContracts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const activeContract = contracts.find((c) => c.id === selectedContractId) ?? contracts[0] ?? null;
  const room = activeContract?.room;
  const property = room?.property;
  const landlord = property?.landlord;
  const isPrimary = Boolean(activeContract && currentUser && activeContract.tenantId === currentUser.id);

  const handleOpenChat = async (userId: string) => {
    if (openingChatId) return;
    setOpeningChatId(userId);
    try {
      const conv = await apiClient.chats.getOrCreateConversationWithUser(userId);
      router.push(`/tenant/messages?conversation=${conv.id}`);
    } catch {
      // Ignored
    } finally {
      setOpeningChatId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-[12px] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-gray-100 rounded-[12px] animate-pulse" />
          <div className="h-40 bg-gray-100 rounded-[12px] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!activeContract) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">Người ở cùng phòng</h1>
          <p className="text-[14px] text-[#74817b] mt-1">Danh sách thành viên hiện đang cùng sinh hoạt trong phòng của bạn.</p>
        </div>

        <div className="rounded-[16px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs space-y-4">
          <div className="size-16 rounded-full bg-[#eaf2ed] flex items-center justify-center mx-auto text-[#15594f]">
            <Users className="size-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-[18px] font-bold text-[#203c37]">Bạn chưa có phòng đang thuê</h3>
            <p className="text-[14px] text-[#74817b] max-w-md mx-auto">
              Khi bạn thuê phòng hoặc được chấp nhận vào ở ghép, thông tin bạn cùng phòng và chủ nhà sẽ được hiển thị đầy đủ tại đây.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/rooms">
              <Button variant="primary" size="md">Tìm phòng thuê ngay</Button>
            </Link>
            <Link href="/roommates">
              <Button variant="outline" size="md">Khám phá bạn ở ghép</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const coTenants = activeContract.coTenants && activeContract.coTenants.length > 0
    ? activeContract.coTenants
    : (activeContract.tenant ? [{
        id: activeContract.tenant.id ?? activeContract.tenantId,
        fullName: activeContract.tenant.fullName ?? "Khách thuê chính",
        phone: activeContract.tenant.phone,
        email: activeContract.tenant.email,
        avatarUrl: activeContract.tenant.avatarUrl,
        role: "PRIMARY_TENANT",
        isPrimary: true,
        status: "ACTIVE",
        joinedAt: activeContract.startDate,
      }] : []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">Người ở cùng phòng</h1>
          <p className="text-[14px] text-[#74817b] mt-1">
            Danh sách thành viên hiện đang cùng sinh hoạt tại Phòng {room?.roomNumber ?? "---"}.
          </p>
        </div>

        {contracts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#74817b]">Chọn phòng:</span>
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              className="h-9 px-3 rounded-[8px] border border-[#e2e7e1] bg-white text-[13px] font-medium text-[#203c37] outline-none focus:border-[#15594f]"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  Phòng {c.room?.roomNumber} · {c.room?.property?.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Role Banner */}
      <div className="rounded-[12px] border border-[#b2d3c2] bg-[#f0f8f4] p-4 flex items-start gap-3 shadow-xs">
        <Info className="size-5 text-[#15594f] shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-[13px]">
          <h4 className="font-bold text-[#15594f]">
            {isPrimary ? "Bạn là Người đứng tên hợp đồng thuê chính" : "Bạn đang ở ghép trong căn phòng này"}
          </h4>
          <p className="text-[#203c37] leading-relaxed">
            {isPrimary
              ? `Hợp đồng do bạn đứng tên ký với chủ nhà ${landlord?.fullName ?? ""}. Bạn có quyền quản lý khai báo số người ở và thông tin thành viên phòng.`
              : `Hợp đồng chính thức do ${activeContract.tenant?.fullName ?? "Người thuê chính"} ký cùng chủ trọ. Bạn đã được cấp quyền cư trú hợp pháp tại phòng.`}
          </p>
        </div>
      </div>

      {/* Room & Landlord Overview Card */}
      <div className="rounded-[14px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2e7e1] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#eaf2ed] text-[#15594f] text-[13px] font-bold border border-[#d2e4d7]">
                <DoorOpen className="size-4" />
                Phòng {room?.roomNumber ?? "---"}
              </span>
              <h2 className="text-[18px] font-bold text-[#203c37]">
                {property?.name ?? "Cơ sở cho thuê"}
              </h2>
              <Badge variant="success" size="sm">Đang thuê</Badge>
            </div>
            <p className="text-[13px] text-[#74817b] flex items-center gap-1.5">
              <Home className="size-3.5 shrink-0 text-[#15594f]" />
              <span>{property?.address ?? "Chưa cập nhật địa chỉ"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeContract.roomId && (
              <Link href={`/rooms/${activeContract.roomId}`} target="_blank">
                <Button variant="outline" size="sm" leftIcon={<ExternalLink className="size-3.5" />}>
                  Xem phòng
                </Button>
              </Link>
            )}
            <Link href={`/tenant/contracts/${activeContract.id}`}>
              <Button variant="outline" size="sm" leftIcon={<FileText className="size-3.5" />}>
                Xem hợp đồng
              </Button>
            </Link>
            <Link href="/tenant/invoices">
              <Button variant="outline" size="sm" leftIcon={<Receipt className="size-3.5" />}>
                Hóa đơn
              </Button>
            </Link>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
          <div className="p-3 rounded-[8px] bg-[#f7f6f2] space-y-0.5 border border-[#e2e7e1]">
            <span className="text-[11px] font-medium text-[#74817b] uppercase">Chủ trọ / Đại diện</span>
            <p className="font-bold text-[#203c37]">{landlord?.fullName ?? "Chưa cập nhật"}</p>
            <p className="text-[12px] text-[#74817b]">{landlord?.phone ?? "Chưa có SĐT"}</p>
          </div>
          <div className="p-3 rounded-[8px] bg-[#f7f6f2] space-y-0.5 border border-[#e2e7e1]">
            <span className="text-[11px] font-medium text-[#74817b] uppercase">Số người đang ở</span>
            <p className="font-bold text-[#15594f] text-[15px]">
              {coTenants.length} người
              {room?.maxOccupants ? ` / tối đa ${room.maxOccupants} người` : ""}
            </p>
            <p className="text-[12px] text-[#74817b]">Diện tích: {room?.area ? `${room.area} m²` : "—"}</p>
          </div>
          <div className="p-3 rounded-[8px] bg-[#f7f6f2] space-y-0.5 border border-[#e2e7e1] sm:col-span-2 md:col-span-1">
            <span className="text-[11px] font-medium text-[#74817b] uppercase">Thời hạn hợp đồng</span>
            <p className="font-semibold text-[#203c37]">
              {activeContract.startDate ? new Date(activeContract.startDate).toLocaleDateString("vi-VN") : "—"}
              {" đến "}
              {activeContract.endDate ? new Date(activeContract.endDate).toLocaleDateString("vi-VN") : "Vô thời hạn"}
            </p>
            <p className="text-[12px] text-[#15594f] font-medium">Bản điện tử đã xác thực</p>
          </div>
        </div>
      </div>

      {/* Occupants List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-bold text-[#203c37] flex items-center gap-2">
            <Users className="size-5 text-[#15594f]" />
            Danh sách thành viên cùng phòng ({coTenants.length})
          </h3>
          <div className="flex items-center gap-2">
            <Link href="/tenant/occupancy">
              <Button variant="secondary" size="sm" leftIcon={<UserCheck className="size-3.5" />}>
                Khai báo số người ở
              </Button>
            </Link>
            <Link href="/tenant/roommate-invitations">
              <Button variant="primary" size="sm" leftIcon={<UserPlus className="size-3.5" />}>
                Mời ở ghép
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coTenants.map((occupant) => {
            const isMe = currentUser && occupant.id === currentUser.id;

            return (
              <div
                key={occupant.id}
                className={`rounded-[12px] border p-5 bg-white shadow-xs flex flex-col justify-between transition-all ${
                  occupant.isPrimary
                    ? "border-[#b8dbc6] ring-1 ring-[#15594f]/10"
                    : "border-[#e2e7e1] hover:border-[#15594f]/30"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-14 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#d2e4d7]">
                        <Avatar
                          src={occupant.avatarUrl ?? "/images/default-avatar.svg"}
                          alt={occupant.fullName}
                          className="size-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[16px] font-bold text-[#203c37]">
                            <Link href={`/users/${occupant.id}`} className="hover:text-[#15594f] hover:underline">
                              {occupant.fullName}
                            </Link>
                          </h4>
                          {isMe && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          {occupant.isPrimary ? (
                            <Badge variant="success" size="sm">
                              Người thuê chính (Chủ HĐ)
                            </Badge>
                          ) : (
                            <Badge variant="neutral" size="sm">
                              Bạn ở ghép
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="space-y-1.5 text-[12px] text-[#74817b] pt-1 border-t border-[#e2e7e1]/70">
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-[#15594f] shrink-0" />
                      <span className="text-[#203c37] font-medium">{occupant.phone || "Chưa cập nhật số điện thoại"}</span>
                    </p>
                    {occupant.email && (
                      <p className="flex items-center gap-2">
                        <Mail className="size-3.5 text-[#15594f] shrink-0" />
                        <span className="text-[#203c37] truncate">{occupant.email}</span>
                      </p>
                    )}
                    {occupant.joinedAt && (
                      <p className="flex items-center gap-2 text-[11px]">
                        <Calendar className="size-3 text-[#74817b] shrink-0" />
                        <span>Vào ở từ: {new Date(occupant.joinedAt).toLocaleDateString("vi-VN")}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-[#e2e7e1] flex items-center justify-between">
                  <Link
                    href={`/users/${occupant.id}`}
                    className="text-[12px] font-semibold text-[#74817b] hover:text-[#15594f] hover:underline"
                  >
                    Xem hồ sơ
                  </Link>

                  {!isMe && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={openingChatId === occupant.id}
                      onClick={() => handleOpenChat(occupant.id)}
                      leftIcon={<MessageCircle className="size-3.5" />}
                    >
                      {openingChatId === occupant.id ? "Đang mở..." : "Nhắn tin"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety & Guidelines card */}
      <div className="rounded-[12px] bg-[#f7f6f2] border border-[#e2e7e1] p-4 flex items-start gap-3 text-[12px] text-[#74817b]">
        <ShieldCheck className="size-4.5 text-[#15594f] shrink-0 mt-0.5" />
        <p>
          Mọi thông tin thành viên cùng phòng đều được đối soát và bảo vệ bởi 5K-Rental Manager. Khi có người mới vào ở hoặc rời đi, vui lòng sử dụng chức năng <strong>Khai báo số người ở</strong> để đảm bảo quyền lợi và hóa đơn dịch vụ chính xác.
        </p>
      </div>
    </div>
  );
}
