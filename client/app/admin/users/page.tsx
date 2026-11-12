"use client";

import * as React from "react";
import { Users, Search, ShieldCheck, Lock, Unlock, Mail, Phone } from "lucide-react";
import { apiClient } from "@/lib/api";
import { User, Role } from "@/types/models";

const ROLE_LABELS: Record<Role, { label: string; bg: string; text: string }> = {
  ADMIN: { label: "Quản trị viên", bg: "bg-[#fbeae6]", text: "text-[#a4422c]" },
  LANDLORD: { label: "Chủ trọ", bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  TENANT: { label: "Người thuê", bg: "bg-[#e8f0fb]", text: "text-[#2d5d8c]" },
  STAFF: { label: "Thợ / Dịch vụ", bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");

  const loadUsers = React.useCallback(() => {
    setIsLoading(true);
    apiClient.adminGovernance
      .getUsers({ role: roleFilter === "ALL" ? undefined : roleFilter, search: search || undefined })
      .then(setUsers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không tải được danh sách người dùng."))
      .finally(() => setIsLoading(false));
  }, [roleFilter, search]);

  React.useEffect(() => {
    const timer = window.setTimeout(loadUsers, 250);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const filtered = users.filter((u) => {
    const matchSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài khoản & KYC</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Quản lý Người dùng</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Danh sách toàn bộ tài khoản người dùng, chủ trọ và thợ dịch vụ trên hệ thống.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-[#f7f6f2] rounded-[7px] border border-[#e2e7e1] min-w-[240px]">
          <Search className="size-3.5 text-[#74817b]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo họ tên, email..."
            className="w-full text-[13px] text-[#203c37] placeholder-[#74817b] bg-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {["ALL", "TENANT", "LANDLORD", "STAFF"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
                roleFilter === r
                  ? "bg-[#15594f] text-white"
                  : "bg-[#f7f6f2] text-[#74817b] hover:text-[#203c37]"
              }`}
            >
              {r === "ALL" ? "Tất cả" : ROLE_LABELS[r as Role]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
              <th className="py-3 px-4">Người dùng</th>
              <th className="py-3 px-4">Số điện thoại</th>
              <th className="py-3 px-4">Vai trò</th>
              <th className="py-3 px-4">Xác thực KYC</th>
              <th className="py-3 px-4">Ngày đăng ký</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
            {filtered.map((u) => {
              const roleCfg = ROLE_LABELS[u.role] || ROLE_LABELS.TENANT;
              return (
                <tr key={u.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-[#203c37]">{u.fullName}</p>
                    <p className="text-[12px] text-[#74817b]">{u.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-[#74817b]">{u.phone || "---"}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${roleCfg.bg} ${roleCfg.text}`}>
                      {roleCfg.label}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {u.isActive ? (
                      <span className="text-[12px] text-[#15594f] font-semibold flex items-center gap-1">
                        <ShieldCheck className="size-3.5" />
                        Hoạt động
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#a4422c]">Đã khóa</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-[#74817b]">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={async () => {
                        try {
                          const updated = await apiClient.adminGovernance.updateUserStatus(u.id, !u.isActive);
                          setUsers((prev) => prev.map((item) => item.id === updated.id ? updated : item));
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái tài khoản.");
                        }
                      }}
                      className="text-[12px] text-[#a4422c] hover:underline cursor-pointer"
                    >
                      {u.isActive ? "Khóa tài khoản" : "Mở tài khoản"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
