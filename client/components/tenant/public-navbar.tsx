"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Users,
  Info,
  HelpCircle,
  Menu,
  X,
  Heart,
  Bell,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PublicNavbarProps {
  currentUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatar?: string;
  } | null;
  onLogout?: () => void;
}

export function PublicNavbar({
  currentUser,
  onLogout,
}: PublicNavbarProps) {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = React.useState(false);

  const navLinks = [
    { label: "Trang chủ", href: "/", icon: Home },
    { label: "Tìm phòng", href: "/rooms", icon: Search },
    { label: "Tìm bạn ở ghép", href: "/roommates", icon: Users },
    { label: "Về chúng tôi", href: "/about", icon: Info },
    { label: "Hỗ trợ", href: "/tenant/support", icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-40 w-full h-[88px] bg-white border-b border-[#e2e7e1] transition-all">
      <div className="max-w-[1440px] mx-auto h-full px-6 lg:px-12 flex items-center justify-between">
        {/* Brand Block */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="size-[38px] rounded-[10px] bg-[#15594f] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Home className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[22px] font-bold tracking-tight text-[#15594f] leading-none">
                5K-Rental Manager
              </span>
              <span className="text-[10px] font-medium text-[#74817b] tracking-wider uppercase mt-1">
                Thuê trọ văn minh & thông minh
              </span>
            </div>
          </Link>

          <span className="hidden xl:inline-flex items-center px-2.5 py-0.5 rounded-[100px] text-[11px] font-semibold bg-[#eaf2ed] text-[#15594f] border border-[#d2e4d7] ml-2">
            MỘT CHỐN Ở HỢP GU
          </span>
        </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((item) => {
            const isActive =
              item.href === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3.5 py-2 rounded-[8px] text-[14px] font-medium transition-colors",
                  isActive
                    ? "text-[#15594f] bg-[#eaf2ed] font-semibold"
                    : "text-[#74817b] hover:text-[#203c37] hover:bg-[#f7f6f2]"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Area */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* Favorites shortcut */}
              <Link
                href="/tenant/favorites"
                title="Phòng đã lưu"
                className="size-10 rounded-[8px] border border-[#e2e7e1] flex items-center justify-center text-[#74817b] hover:text-[#15594f] hover:bg-[#f7f6f2] transition-colors"
              >
                <Heart className="size-5" />
              </Link>

              {/* Notifications shortcut */}
              <Link
                href="/tenant/notifications"
                title="Thông báo"
                className="size-10 rounded-[8px] border border-[#e2e7e1] flex items-center justify-center text-[#74817b] hover:text-[#15594f] hover:bg-[#f7f6f2] transition-colors relative"
              >
                <Bell className="size-5" />
                <span className="absolute top-2 right-2 size-2 bg-[#991b1b] rounded-full ring-2 ring-white" />
              </Link>

              {/* User Dropdown Pill */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 p-1.5 pr-3 rounded-[100px] border border-[#e2e7e1] bg-[#f7f6f2] hover:bg-[#f2ede3] transition-colors cursor-pointer"
                >
                  <div className="size-[32px] rounded-full bg-[#15594f] text-white font-semibold text-[12px] flex items-center justify-center">
                    {currentUser.fullName ? currentUser.fullName[0].toUpperCase() : "U"}
                  </div>
                  <div className="text-left">
                    <p className="text-[13px] font-semibold text-[#203c37] leading-none">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[10px] text-[#74817b] uppercase mt-0.5">
                      {currentUser.role}
                    </p>
                  </div>
                  <ChevronDown className="size-3.5 text-[#74817b]" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-[12px] border border-[#e2e7e1] shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-2 border-b border-[#e2e7e1]">
                      <p className="text-[13px] font-semibold text-[#203c37]">
                        {currentUser.fullName}
                      </p>
                      <p className="text-[11px] text-[#74817b] truncate">
                        {currentUser.email}
                      </p>
                    </div>

                    <Link
                      href="/tenant/favorites"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#203c37] hover:bg-[#f7f6f2]"
                    >
                      <User className="size-4 text-[#74817b]" />
                      <span>Không gian cá nhân</span>
                    </Link>

                    <Link
                      href="/tenant/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#203c37] hover:bg-[#f7f6f2]"
                    >
                      <Info className="size-4 text-[#74817b]" />
                      <span>Chỉnh sửa hồ sơ</span>
                    </Link>

                    <div className="h-px bg-[#e2e7e1] my-1" />

                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-[#991b1b] hover:bg-[#fee2e2]/60 cursor-pointer text-left"
                    >
                      <LogOut className="size-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/landlord/register"
                className="text-[13px] font-medium text-[#15594f] hover:underline px-2 hidden lg:block"
              >
                Đăng tin cho thuê
              </Link>
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="primary" size="sm">
                  Đăng ký
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Menu"
            className="p-2 rounded-[8px] text-[#203c37] hover:bg-[#f7f6f2]"
          >
            {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-[#e2e7e1] px-6 py-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[14px] text-[#203c37] hover:bg-[#f7f6f2]"
              >
                <item.icon className="size-4 text-[#74817b]" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="h-px bg-[#e2e7e1]" />

          {currentUser ? (
            <div className="space-y-2 pt-1">
              <Link
                href="/tenant/favorites"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-[14px] font-semibold text-[#15594f]"
              >
                <User className="size-4" />
                <span>Vào không gian cá nhân</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout?.();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-[14px] text-[#991b1b] text-left"
              >
                <LogOut className="size-4" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  Đăng nhập
                </Button>
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="sm" className="w-full">
                  Đăng ký
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
