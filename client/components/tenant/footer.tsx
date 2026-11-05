import * as React from "react";
import Link from "next/link";
import { Home, ShieldCheck, HeartHandshake, Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
  const footerGroups = [
    {
      title: "Khám phá phòng",
      links: [
        { label: "Phòng trọ sinh viên", href: "/rooms?type=STUDENT" },
        { label: "Căn hộ mini Studio", href: "/rooms?type=STUDIO" },
        { label: "Chung cư nguyên căn", href: "/rooms?type=APARTMENT" },
        { label: "Tìm bạn ở ghép", href: "/roommates" },
        { label: "Bản đồ phòng trọ", href: "/rooms/map" },
      ],
    },
    {
      title: "Dành cho chủ trọ",
      links: [
        { label: "Đăng tin cho thuê", href: "/landlord/listings/create" },
        { label: "Bảng giá dịch vụ", href: "/about#pricing" },
        { label: "Quy chuẩn kiểm duyệt", href: "/about#moderation" },
        { label: "Đăng ký đối tác chủ trọ", href: "/landlord/register" },
      ],
    },
    {
      title: "Về 5K-Rental Manager",
      links: [
        { label: "Giới thiệu nền tảng", href: "/about" },
        { label: "Cam kết an tâm 100%", href: "/about#commitment" },
        { label: "Quy chế hoạt động", href: "/about#rules" },
        { label: "Chính sách bảo mật", href: "/about#privacy" },
        { label: "Điều khoản sử dụng", href: "/about#terms" },
      ],
    },
    {
      title: "Hỗ trợ & An toàn",
      links: [
        { label: "Trung tâm trợ giúp", href: "/tenant/support" },
        { label: "Báo cáo vi phạm & lừa đảo", href: "/tenant/safety/report" },
        { label: "Cẩm nang an toàn thuê trọ", href: "/tenant/safety" },
        { label: "Liên hệ giải quyết tranh chấp", href: "/tenant/support/create" },
      ],
    },
  ];

  return (
    <footer className="w-full bg-white border-t border-[#e2e7e1] pt-14 pb-8 text-[#74817b] text-[13px]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-12">
        {/* Top Grid: Brand Column + Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 pb-12">
          {/* Brand Info Column */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="size-[36px] rounded-[10px] bg-[#15594f] flex items-center justify-center text-white">
                <Home className="size-5" />
              </div>
              <span className="text-[20px] font-bold tracking-tight text-[#15594f]">
                5K-Rental Manager
              </span>
            </Link>

            <p className="text-[13px] leading-relaxed text-[#74817b] max-w-sm">
              Nền tảng công nghệ quản lý và kết nối thuê phòng trọ thông minh,
              văn minh và minh bạch. Đồng hành cùng hàng triệu sinh viên và người
              đi làm tìm chốn an cư lý tưởng.
            </p>

            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2.5 text-[#203c37]">
                <Phone className="size-4 text-[#15594f]" />
                <span className="font-semibold text-[13px]">1900 5858 (8:00 - 21:00)</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#203c37]">
                <Mail className="size-4 text-[#15594f]" />
                <span className="text-[13px]">hotro@5krental.vn</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#74817b]">
                <MapPin className="size-4 text-[#15594f]" />
                <span className="text-[12px]">Khu Công nghệ cao, TP. Thủ Đức, TP. Hồ Chí Minh</span>
              </div>
            </div>
          </div>

          {/* 4 Link Columns */}
          {footerGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <h4 className="font-semibold text-[#203c37] text-[14px]">
                {group.title}
              </h4>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="hover:text-[#15594f] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Trust Badges Strip */}
        <div className="py-6 border-t border-[#e2e7e1] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-[#eaf2ed] flex items-center justify-center text-[#15594f]">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#203c37]">
                Xác thực chủ nhà 100%
              </p>
              <p className="text-[11px] text-[#74817b]">
                Giấy tờ pháp lý, phòng thực tế đã kiểm duyệt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-[#eaf2ed] flex items-center justify-center text-[#15594f]">
              <HeartHandshake className="size-4" />
            </div>
            <div>
              <p className="text-[12px] font-semibold text-[#203c37]">
                Bảo vệ cọc & Hợp đồng số
              </p>
              <p className="text-[11px] text-[#74817b]">
                Hợp đồng điện tử minh bạch, hỗ trợ đối soát tranh chấp
              </p>
            </div>
          </div>

          <div className="px-3 py-1 bg-[#f7f6f2] rounded-full border border-[#e2e7e1] text-[11px] text-[#203c37] font-medium">
            Phiên bản: 5K-Rental Manager v2.4.1
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 border-t border-[#e2e7e1] flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]">
          <p>© 2026 5K-Rental Manager. Tất cả các quyền được bảo lưu.</p>
          <p className="text-[#74817b]">
            Phát triển vì cộng đồng người thuê và chủ trọ văn minh.
          </p>
        </div>
      </div>
    </footer>
  );
}
