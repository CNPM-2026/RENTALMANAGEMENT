"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { translateRole } from "@/lib/labels";
import { Avatar } from "@/components/ui/avatar";
import { User, Role } from "@/types/models";

/** Chỉ giữ màu badge; nhãn lấy từ nguồn chung `translateRole`. */
const ROLE_STYLES: Record<Role, { bg: string; text: string }> = {
  ADMIN: { bg: "bg-[#fbeae6]", text: "text-[#a4422c]" },
  LANDLORD: { bg: "bg-[#eaf2ed]", text: "text-[#15594f]" },
  TENANT: { bg: "bg-[#e8f0fb]", text: "text-[#2d5d8c]" },
  STAFF: { bg: "bg-[#fbf1dc]", text: "text-[#9a6a12]" },
};

export default function AdminUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL");

  // Ban modal state
  const [banningUser, setBanningUser] = React.useState<User | null>(null);
  const [banReasonInput, setBanReasonInput] = React.useState("");
  const [isSubmittingBan, setIsSubmittingBan] = React.useState(false);

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
              {r === "ALL" ? "Tất cả" : translateRole(r)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-[13px] text-[#a4422c]">
          {error}
        </div>
      )}

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
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#74817b]">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#74817b]">
                  Không tìm thấy người dùng phù hợp.
                </td>
              </tr>
            ) : filtered.map((u) => {
              const roleCfg = ROLE_STYLES[u.role] || ROLE_STYLES.TENANT;
              return (
                <tr key={u.id} className="hover:bg-[#f7f6f2]/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={u.avatarUrl}
                        alt={u.fullName}
                        className="size-9 shrink-0 rounded-full border border-[#e2e7e1] object-cover"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/users/${u.id}`}
                          className="font-semibold text-[#203c37] hover:text-[#15594f] hover:underline"
                          title="Xem trang cá nhân công khai"
                        >
                          {u.fullName}
                        </Link>
                        <p className="truncate text-[12px] text-[#74817b]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#74817b]">{u.phone || "---"}</td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${roleCfg.bg} ${roleCfg.text}`}>
                      {translateRole(u.role)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {u.isActive ? (
                      <span className="text-[12px] text-[#15594f] font-semibold flex items-center gap-1">
                        <ShieldCheck className="size-3.5" />
                        Hoạt động
                      </span>
                    ) : (
                      <div>
                        <span className="text-[12px] text-[#a4422c] font-semibold">Đã khóa</span>
                        {(u as any).banReason && (
                          <p className="text-[11px] text-[#74817b] mt-0.5 max-w-[180px] truncate" title={(u as any).banReason}>
                            Lý do: {(u as any).banReason}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-[#74817b]">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={async () => {
                        if (u.isActive) {
                          setBanningUser(u);
                          setBanReasonInput("Vi phạm quy chế hoạt động và an toàn phòng trọ");
                        } else {
                          if (!confirm(`Bạn có chắc muốn mở khóa cho tài khoản ${u.fullName}?`)) return;
                          try {
                            const updated = await apiClient.adminGovernance.updateUserStatus(u.id, true);
                            setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Không mở khóa được tài khoản.");
                          }
                        }
                      }}
                      className={`text-[12px] font-medium hover:underline cursor-pointer ${
                        u.isActive ? "text-[#a4422c]" : "text-[#15594f]"
                      }`}
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

      {/* Ban User Modal with Reason */}
      {banningUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-[16px] max-w-md w-full p-6 shadow-xl border border-[#e2e7e1] space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-[17px] font-bold text-[#a4422c]">
                Khóa tài khoản người dùng
              </h3>
              <p className="text-[13px] text-[#74817b] mt-1">
                Tài khoản: <strong>{banningUser.fullName}</strong> ({banningUser.email})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                  Lý do khóa tài khoản <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={banReasonInput}
                  onChange={(e) => setBanReasonInput(e.target.value)}
                  placeholder="Nhập lý do khóa tài khoản để thông báo cho người dùng và các bên liên quan..."
                  className="w-full p-2.5 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#a4422c] resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[11px] text-amber-800 space-y-1">
                <p className="font-bold">Hậu quả khi khóa tài khoản:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Tài khoản bị thu hồi toàn bộ phiên đăng nhập.</li>
                  <li>Ẩn mọi bài đăng tin của người dùng.</li>
                  <li>Hợp đồng thuê chuyển quyền cho người ở ghép hoặc tạm đình chỉ (SUSPENDED).</li>
                  <li>Người dùng chỉ có thể gửi phản hồi kháng cáo qua trang Hỗ trợ.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBanningUser(null)}
                disabled={isSubmittingBan}
                className="px-4 py-2 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#74817b] hover:bg-[#faf9f5]"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isSubmittingBan || !banReasonInput.trim()}
                onClick={async () => {
                  if (!banReasonInput.trim()) return;
                  setIsSubmittingBan(true);
                  try {
                    const updated = await apiClient.adminGovernance.updateUserStatus(
                      banningUser.id,
                      false,
                      banReasonInput.trim()
                    );
                    setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                    setBanningUser(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Không thể khóa tài khoản.");
                  } finally {
                    setIsSubmittingBan(false);
                  }
                }}
                className="px-4 py-2 rounded-[8px] bg-[#a4422c] hover:bg-[#833220] text-white text-[13px] font-bold disabled:opacity-50"
              >
                {isSubmittingBan ? "Đang xử lý..." : "Xác nhận Khóa tài khoản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
