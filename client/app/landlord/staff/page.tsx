"use client";

import * as React from "react";
import { UserCog, Plus, ShieldCheck, Mail, Phone, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { StaffMembership, StaffPermission } from "@/types/models";

export default function LandlordStaffPage() {
  const [staffList, setStaffList] = React.useState<StaffMembership[]>([]);
  const [email, setEmail] = React.useState("");
  const [permissions, setPermissions] = React.useState<StaffPermission[]>(["MAINTENANCE", "APPOINTMENTS"]);
  const [showForm, setShowForm] = React.useState(false);

  const loadStaff = React.useCallback(() => {
    apiClient.staff.getMine().then(setStaffList).catch(() => setStaffList([]));
  }, []);

  React.useEffect(() => { loadStaff(); }, [loadStaff]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiClient.staff.invite({ email, permissions });
    setEmail("");
    setShowForm(false);
    loadStaff();
  };

  const remove = async (id: string) => {
    await apiClient.staff.remove(id);
    setStaffList((items) => items.filter((item) => item.id !== id));
  };

  const permissionLabels: Record<StaffPermission, string> = {
    PROPERTIES_ROOMS: "Property & phòng",
    MAINTENANCE: "Bảo trì",
    INVOICES: "Hóa đơn",
    APPOINTMENTS: "Lịch hẹn",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Vận hành</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Nhân viên & Phân quyền</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">Phân quyền quản lý tòa nhà cho quản lý cơ sở, kế toán hoặc kỹ thuật viên.</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-medium hover:bg-[#124b42] transition-colors shadow-sm self-start cursor-pointer"
        >
          <Plus className="size-4" />
          <span>Thêm nhân viên</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={invite} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 space-y-4 shadow-xs">
          <label className="block text-[13px] font-semibold text-[#203c37]">
            Email tài khoản đã đăng ký
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-[8px] border border-[#e2e7e1] px-3 py-2 text-sm outline-none focus:border-[#15594f]" />
          </label>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(permissionLabels) as StaffPermission[]).map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-[12px] text-[#203c37]">
                <input type="checkbox" checked={permissions.includes(permission)} onChange={(event) => setPermissions((current) => event.target.checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission))} />
                {permissionLabels[permission]}
              </label>
            ))}
          </div>
          <button type="submit" disabled={!permissions.length} className="rounded-[8px] bg-[#15594f] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">Gửi lời mời</button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staffList.map((staff) => (
          <div key={staff.id} className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="size-10 rounded-full bg-[#eaf2ed] text-[#15594f] flex items-center justify-center font-bold text-sm">
                  {staff.user.fullName.charAt(0)}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                  {staff.isActive ? "Hoạt động" : "Đã khóa"}
                </span>
              </div>
              <h3 className="text-[16px] font-semibold text-[#203c37] mt-3">{staff.user.fullName}</h3>
              <p className="text-[12px] font-medium text-[#15594f]">{staff.permissions.map((permission) => permissionLabels[permission]).join(" / ")}</p>

              <div className="mt-3 space-y-1 text-[12px] text-[#74817b]">
                <p className="flex items-center gap-2">
                  <Phone className="size-3.5 text-[#203c37]" />
                  <span>{staff.user.phone ?? "Chưa cập nhật"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="size-3.5 text-[#203c37]" />
                  <span>{staff.user.email}</span>
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-[#e2e7e1] flex items-center justify-between text-[12px]">
              <button onClick={() => remove(staff.id)} className="inline-flex items-center gap-1 text-[#a4422c] font-semibold hover:underline cursor-pointer">
                <Trash2 className="size-3.5" />
                Xóa quyền
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
