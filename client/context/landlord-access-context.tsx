"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { canStaffAccessLandlordPath } from "@/lib/landlord-permissions";
import type { StaffPermission } from "@/types/models";

const ALL_PERMISSIONS: StaffPermission[] = ["PROPERTIES_ROOMS", "MAINTENANCE", "INVOICES", "APPOINTMENTS"];

interface LandlordAccess {
  loading: boolean;
  /** `true` = chính chủ trọ (hoặc admin) — được mọi quyền. */
  isLandlord: boolean;
  /** `true` = nhân viên được chủ trọ cấp quyền. */
  isMember: boolean;
  landlordId: string | null;
  landlordName: string | null;
  permissions: StaffPermission[];
  can: (permission: StaffPermission) => boolean;
}

const LandlordAccessContext = React.createContext<LandlordAccess | null>(null);

/** Truy cập quyền trong không gian `/landlord`. Phải nằm trong provider. */
export function useLandlordAccess(): LandlordAccess {
  const value = React.useContext(LandlordAccessContext);
  if (!value) {
    return {
      loading: false,
      isLandlord: false,
      isMember: false,
      landlordId: null,
      landlordName: null,
      permissions: [],
      can: () => false,
    };
  }
  return value;
}

// Giữ default context tối thiểu để component dùng ngoài provider không crash.
// (Không cần tham số: mặc định luôn từ chối.)

/**
 * Cổng vào không gian chủ trọ.
 *
 * - Chủ trọ / admin: vào ngay.
 * - Tài khoản khác: phải có `StaffMembership` đang hoạt động; nếu không có thì
 *   chuyển `/403` (không phải `/login`, vì họ đã đăng nhập).
 * - Nhân viên chỉ mở được đúng nhóm trang theo quyền đã cấp; gõ thẳng URL
 *   không có quyền cũng bị đưa về `/403`.
 */
export function LandlordAccessProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [denied, setDenied] = React.useState(false);
  const [state, setState] = React.useState<LandlordAccess>({
    loading: true,
    isLandlord: false,
    isMember: false,
    landlordId: null,
    landlordName: null,
    permissions: [],
    can: () => false,
  });

  React.useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const deny = () => {
      setDenied(true);
      setState((current) => ({ ...current, loading: false }));
      router.replace("/403");
    };

    if (user.role === "LANDLORD") {
      // Không setState đồng bộ trong effect (react-hooks/set-state-in-effect).
      queueMicrotask(() =>
        setState({
          loading: false,
          isLandlord: true,
          isMember: false,
          landlordId: user.role === "LANDLORD" ? user.id : null,
          landlordName: user.fullName,
          permissions: ALL_PERMISSIONS,
          can: () => true,
        }),
      );
      return;
    }

    apiClient.staff
      .getMyMembership()
      .then((membership) => {
        if (!membership) {
          deny();
          return;
        }
        setState({
          loading: false,
          isLandlord: false,
          isMember: true,
          landlordId: membership.landlordId,
          landlordName: membership.landlord.fullName,
          permissions: membership.permissions,
          can: (permission) => membership.permissions.includes(permission),
        });
      })
      .catch(deny);
  }, [router]);

  // Chặn truy cập trực tiếp bằng URL khi thiếu quyền.
  React.useEffect(() => {
    if (state.loading || state.isLandlord || !state.isMember) return;
    if (!canStaffAccessLandlordPath(pathname, state.permissions)) {
      router.replace("/403");
    }
  }, [pathname, router, state]);

  // QUAN TRỌNG (Next 16 instant navigation): KHÔNG return sớm ở đây.
  // Một client component trả về spinner/null trong lúc SSR sẽ làm toàn bộ
  // segment con bị "dropped" khỏi cây render, khiến Next báo
  // "Could not validate that a segment in your UI has instant navigation".
  // Vì vậy luôn render {children}; trạng thái đang kiểm tra/không có quyền
  // được phủ bằng overlay thay vì thay thế subtree.
  return (
    <LandlordAccessContext.Provider value={state}>
      {children}
      {state.loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center gap-2 bg-[#f7f6f2]/90 text-sm text-[#74817b] backdrop-blur-[1px]">
          <Loader2 className="size-4 animate-spin" /> Đang kiểm tra quyền truy cập...
        </div>
      )}
      {denied && <div className="fixed inset-0 z-[100] bg-[#f7f6f2]" aria-hidden />}
    </LandlordAccessContext.Provider>
  );
}
