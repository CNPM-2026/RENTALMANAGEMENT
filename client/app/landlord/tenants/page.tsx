"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, Phone, Mail, MessageSquare, DoorOpen, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Contract } from "@/types/models";

export default function LandlordTenantsPage() {
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    apiClient.contracts
      .getMyContracts()
      .then((data) => setContracts(data ?? []))
      .catch(() => setContracts([]))
      .finally(() => setIsLoading(false));
  }, []);

  const activeTenants = contracts.filter((c) => c.status === "ACTIVE");
  const filtered = activeTenants.filter((c) =>
    (c.tenant?.fullName ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (c.room?.roomNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Cho thuê</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Danh sách Khách thuê</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Thông tin liên hệ và phòng trọ của các khách đang thuê.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <Search className="size-4 text-[#74817b] ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên khách thuê hoặc số phòng..."
          className="flex-1 text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-40 rounded-[12px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Users className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có khách thuê nào</h3>
          <p className="text-[13px] text-[#74817b] mt-1">Các khách thuê có hợp đồng đang hiệu lực sẽ xuất hiện ở đây.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#203c37]">
                      {item.tenant?.fullName || "Khách thuê"}
                    </h3>
                    <p className="text-[12px] text-[#15594f] font-medium flex items-center gap-1 mt-0.5">
                      <DoorOpen className="size-3.5" />
                      Phòng {item.room?.roomNumber || "---"}
                    </p>
                  </div>
                  <span className="size-8 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center font-bold text-xs">
                    {(item.tenant?.fullName || "U").charAt(0).toUpperCase()}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-[12px] text-[#74817b]">
                  {item.tenant?.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="size-3.5 text-[#203c37]" />
                      <span>{item.tenant.phone}</span>
                    </p>
                  )}
                  {item.tenant?.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="size-3.5 text-[#203c37]" />
                      <span className="truncate">{item.tenant.email}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#e2e7e1] flex items-center justify-between">
                <button
                  type="button"
                  onClick={async () => {
                    const conversation = await apiClient.chats.getOrCreateConversationWithUser(item.tenantId);
                    router.push(`/landlord/messages?conversation=${conversation.id}`);
                  }}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Nhắn tin</span>
                </button>
                <Link
                  href={`/tenant/contracts/${item.id}`}
                  className="text-[12px] text-[#74817b] hover:text-[#203c37] hover:underline"
                >
                  Xem HĐ
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
