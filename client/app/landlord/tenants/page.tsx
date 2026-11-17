"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Phone,
  Mail,
  MessageSquare,
  DoorOpen,
  Building2,
  ExternalLink,
  FileText,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Contract } from "@/types/models";

export default function LandlordTenantsPage() {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filterRole, setFilterRole] = React.useState<"ALL" | "PRIMARY" | "ROOMMATE">("ALL");
  const [openingChatId, setOpeningChatId] = React.useState<string | null>(null);
  const router = useRouter();

  React.useEffect(() => {
    apiClient.contracts
      .getMyContracts()
      .then((data) => setContracts(data ?? []))
      .catch(() => setContracts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const activeContracts = contracts.filter((c) => c.status === "ACTIVE");

  // Flatten or group by room while extracting all co-tenants
  const roomsWithTenants = activeContracts.map((contract) => {
    const rawCoTenants = contract.coTenants && contract.coTenants.length > 0
      ? contract.coTenants
      : (contract.tenant ? [{
          id: contract.tenant.id ?? contract.tenantId,
          fullName: contract.tenant.fullName ?? "Khách thuê chính",
          phone: contract.tenant.phone,
          email: contract.tenant.email,
          avatarUrl: contract.tenant.avatarUrl,
          role: "PRIMARY_TENANT",
          isPrimary: true,
          status: "ACTIVE",
          joinedAt: contract.startDate,
        }] : []);

    return {
      contract,
      room: contract.room,
      property: contract.room?.property,
      tenants: rawCoTenants,
    };
  });

  // Calculate statistics
  const totalOccupants = roomsWithTenants.reduce((acc, item) => acc + item.tenants.length, 0);
  const totalPrimary = roomsWithTenants.reduce((acc, item) => acc + item.tenants.filter((t) => t.isPrimary).length, 0);
  const totalRoommates = roomsWithTenants.reduce((acc, item) => acc + item.tenants.filter((t) => !t.isPrimary).length, 0);

  // Filter based on search query and role filter
  const filteredRooms = roomsWithTenants.filter((item) => {
    const q = search.trim().toLowerCase();
    const roomMatch =
      !q ||
      (item.room?.roomNumber ?? "").toLowerCase().includes(q) ||
      (item.property?.name ?? "").toLowerCase().includes(q);

    const matchingTenants = item.tenants.filter((t) => {
      const roleMatches =
        filterRole === "ALL" ||
        (filterRole === "PRIMARY" && t.isPrimary) ||
        (filterRole === "ROOMMATE" && !t.isPrimary);

      const textMatches =
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        (t.phone ?? "").toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q);

      return roleMatches && textMatches;
    });

    if (q) {
      return (roomMatch && matchingTenants.length > 0) || matchingTenants.length > 0;
    }
    return matchingTenants.length > 0;
  });

  const handleOpenChat = async (userId: string) => {
    if (openingChatId) return;
    setOpeningChatId(userId);
    try {
      const conversation = await apiClient.chats.getOrCreateConversationWithUser(userId);
      router.push(`/landlord/messages?conversation=${conversation.id}`);
    } catch {
      // Ignored
    } finally {
      setOpeningChatId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Cho thuê</p>
          <h1 className="text-[26px] font-bold text-[#203c37] mt-0.5 tracking-tight">
            Danh sách Khách thuê & Ở ghép
          </h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Quản lý thông tin liên lạc của toàn bộ người thuê chính và các bạn ở ghép trong từng phòng.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[13px] font-semibold text-[#203c37] shadow-xs">
            <Users className="size-4 text-[#15594f]" />
            Tổng: <strong className="text-[#15594f]">{totalOccupants} người</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[13px] font-semibold text-[#203c37] shadow-xs">
            Thuê chính: <strong className="text-[#15594f]">{totalPrimary}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[13px] font-semibold text-[#203c37] shadow-xs">
            Ở ghép: <strong className="text-[#15594f]">{totalRoommates}</strong>
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-[12px] border border-[#e2e7e1] shadow-xs">
        <div className="flex-1 flex items-center gap-2 px-2">
          <Search className="size-4 text-[#74817b] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên khách thuê, bạn ở ghép, số điện thoại hoặc số phòng..."
            className="w-full text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-[#e2e7e1] pt-2 sm:pt-0 sm:pl-3">
          <button
            type="button"
            onClick={() => setFilterRole("ALL")}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
              filterRole === "ALL"
                ? "bg-[#15594f] text-white"
                : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            Tất cả ({totalOccupants})
          </button>
          <button
            type="button"
            onClick={() => setFilterRole("PRIMARY")}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
              filterRole === "PRIMARY"
                ? "bg-[#15594f] text-white"
                : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            Thuê chính ({totalPrimary})
          </button>
          <button
            type="button"
            onClick={() => setFilterRole("ROOMMATE")}
            className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer ${
              filterRole === "ROOMMATE"
                ? "bg-[#15594f] text-white"
                : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
            }`}
          >
            Ở ghép ({totalRoommates})
          </button>
        </div>
      </div>

      {/* Main Content List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-[14px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="rounded-[16px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Users className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[17px] font-semibold text-[#203c37]">Không tìm thấy khách thuê phù hợp</h3>
          <p className="text-[13px] text-[#74817b] mt-1">
            {search
              ? "Hãy thử tìm kiếm bằng từ khóa hoặc bộ lọc khác."
              : "Các khách thuê có hợp đồng đang hiệu lực và người ở ghép sẽ xuất hiện tại đây."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRooms.map(({ contract, room, property, tenants }) => {
            const displayedTenants = tenants.filter((t) => {
              if (filterRole === "PRIMARY") return t.isPrimary;
              if (filterRole === "ROOMMATE") return !t.isPrimary;
              return true;
            });

            return (
              <div
                key={contract.id}
                className="rounded-[14px] border border-[#e2e7e1] bg-white p-5 shadow-xs space-y-4 hover:border-[#15594f]/40 transition-colors"
              >
                {/* Room & Property Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e7e1] pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[6px] bg-[#eaf2ed] text-[#15594f] text-[13px] font-bold border border-[#d2e4d7]">
                        <DoorOpen className="size-3.5" />
                        Phòng {room?.roomNumber ?? "---"}
                      </span>
                      <h3 className="text-[16px] font-bold text-[#203c37]">
                        {property?.name ?? "Cơ sở cho thuê"}
                      </h3>
                      <Badge variant="success" size="sm">
                        {tenants.length} người đang ở
                      </Badge>
                    </div>
                    <p className="text-[12px] text-[#74817b] flex items-center gap-1">
                      <Building2 className="size-3 text-[#15594f]" />
                      <span>{property?.address ?? "Chưa cập nhật địa chỉ"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {contract.roomId && (
                      <Link
                        href={`/rooms/${contract.roomId}`}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
                        target="_blank"
                      >
                        Chi tiết phòng <ExternalLink className="size-3" />
                      </Link>
                    )}
                    <span className="text-[#e2e7e1]">|</span>
                    <Link
                      href={`/landlord/contracts/${contract.id}`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
                    >
                      <FileText className="size-3" /> Hợp đồng
                    </Link>
                  </div>
                </div>

                {/* Tenants & Roommates Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedTenants.map((occupant) => (
                    <div
                      key={occupant.id}
                      className={`p-3.5 rounded-[10px] border flex flex-col justify-between transition-colors ${
                        occupant.isPrimary
                          ? "bg-[#f4f8f5] border-[#b8dbc6]"
                          : "bg-white border-[#e2e7e1] hover:border-[#15594f]/40"
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#d2e4d7]">
                              <Avatar
                                src={occupant.avatarUrl ?? "/images/default-avatar.svg"}
                                alt={occupant.fullName}
                                className="size-full object-cover"
                              />
                            </div>
                            <div>
                              <h4 className="text-[14px] font-bold text-[#203c37] leading-tight">
                                <Link
                                  href={`/users/${occupant.id}`}
                                  className="hover:text-[#15594f] hover:underline"
                                  title="Xem trang cá nhân"
                                >
                                  {occupant.fullName}
                                </Link>
                              </h4>
                              <div className="mt-1">
                                {occupant.isPrimary ? (
                                  <Badge variant="success" size="sm">
                                    Người thuê chính
                                  </Badge>
                                ) : (
                                  <Badge variant="neutral" size="sm">
                                    Ở ghép
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Contact details */}
                        <div className="space-y-1 text-[12px] text-[#74817b] pt-1">
                          <p className="flex items-center gap-2">
                            <Phone className="size-3 text-[#15594f] shrink-0" />
                            <span className="text-[#203c37] font-medium">{occupant.phone || "Chưa có SĐT"}</span>
                          </p>
                          {occupant.email && (
                            <p className="flex items-center gap-2">
                              <Mail className="size-3 text-[#15594f] shrink-0" />
                              <span className="text-[#203c37] truncate">{occupant.email}</span>
                            </p>
                          )}
                          {occupant.joinedAt && (
                            <p className="text-[11px] text-[#74817b] pt-0.5">
                              Vào ở: {new Date(occupant.joinedAt).toLocaleDateString("vi-VN")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="mt-3 pt-2.5 border-t border-[#e2e7e1] flex items-center justify-between">
                        <Link
                          href={`/users/${occupant.id}`}
                          className="text-[12px] font-medium text-[#74817b] hover:text-[#15594f] hover:underline"
                        >
                          Hồ sơ
                        </Link>

                        <button
                          type="button"
                          disabled={openingChatId === occupant.id}
                          onClick={() => handleOpenChat(occupant.id)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline cursor-pointer disabled:opacity-50"
                        >
                          <MessageSquare className="size-3" />
                          <span>{openingChatId === occupant.id ? "Đang mở..." : "Nhắn tin"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
