"use client";

import * as React from "react";
import { Settings, Save, Shield, Mail, Database, Bell } from "lucide-react";

export default function AdminSettingsPage() {
  const [siteName, setSiteName] = React.useState("5K-Rental Manager");
  const [platformFee, setPlatformFee] = React.useState("1.5");
  const [supportEmail, setSupportEmail] = React.useState("support@5k-rental.vn");
  const [allowRegistration, setAllowRegistration] = React.useState(true);
  const [autoApproveLandlord, setAutoApproveLandlord] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-[12px] text-[#74817b]">Quản trị hệ thống</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Cấu hình Hệ thống</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Các tham số vận hành chung, chính sách phí và dịch vụ nền tảng.</p>
      </div>

      {saved && (
        <div className="rounded-[8px] bg-[#eaf2ed] border border-[#b2d3c2] text-[#15594f] px-4 py-3 text-[13px] font-semibold">
          Đã lưu thay đổi cấu hình thành công!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-[16px] font-bold text-[#203c37] flex items-center gap-2">
            <Settings className="size-4 text-[#15594f]" />
            <span>Thông tin nền tảng</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
            <div>
              <label className="block font-medium text-[#203c37] mb-1">Tên thương hiệu</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] border border-[#e2e7e1] outline-none focus:border-[#15594f]"
              />
            </div>
            <div>
              <label className="block font-medium text-[#203c37] mb-1">Email liên hệ hỗ trợ</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-[8px] border border-[#e2e7e1] outline-none focus:border-[#15594f]"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-[16px] font-bold text-[#203c37] flex items-center gap-2">
            <Shield className="size-4 text-[#15594f]" />
            <span>Chính sách kiểm duyệt & Phí dịch vụ</span>
          </h2>

          <div className="space-y-3 text-[13px]">
            <div>
              <label className="block font-medium text-[#203c37] mb-1">Phí hoa hồng giao dịch sàn (%)</label>
              <input
                type="number"
                step="0.1"
                value={platformFee}
                onChange={(e) => setPlatformFee(e.target.value)}
                className="w-48 px-3 py-2 rounded-[8px] border border-[#e2e7e1] outline-none focus:border-[#15594f]"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#203c37]">Cho phép người dùng mới đăng ký tự do</p>
                <p className="text-[12px] text-[#74817b]">Tạm khóa đăng ký khi hệ thống bảo trì</p>
              </div>
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="size-4 accent-[#15594f] cursor-pointer"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#203c37]">Tự động duyệt bài đăng của chủ trọ đã KYC</p>
                <p className="text-[12px] text-[#74817b]">Không cần admin duyệt thủ công từng tin</p>
              </div>
              <input
                type="checkbox"
                checked={autoApproveLandlord}
                onChange={(e) => setAutoApproveLandlord(e.target.checked)}
                className="size-4 accent-[#15594f] cursor-pointer"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] cursor-pointer shadow-sm"
        >
          <Save className="size-4" />
          <span>Lưu cấu hình</span>
        </button>
      </form>
    </div>
  );
}
