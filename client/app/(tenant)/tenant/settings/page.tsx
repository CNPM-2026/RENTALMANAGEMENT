"use client";

import * as React from "react";
import Link from "next/link";
import {
  Lock,
  Monitor,
  Smartphone,
  Bell,
  Download,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";

export default function TenantSettingsPage() {
  const [sessionFeedback, setSessionFeedback] = React.useState<string | null>(null);
  // Password Change State
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordFeedback, setPasswordFeedback] = React.useState<string | null>(null);

  // Privacy Toggles
  const [showRoommateProfile, setShowRoommateProfile] = React.useState(true);
  const [allowLandlordContact, setAllowLandlordContact] = React.useState(true);
  const [hidePhoneOnPosts, setHidePhoneOnPosts] = React.useState(false);

  // Notification Toggles
  const [emailAlerts, setEmailAlerts] = React.useState(true);
  const [pushAlerts, setPushAlerts] = React.useState(true);
  const [messageAlerts, setMessageAlerts] = React.useState(true);
  const [contractAlerts, setContractAlerts] = React.useState(true);

  // Delete Account Modal
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordFeedback("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback("Mật khẩu xác nhận không khớp.");
      return;
    }
    setPasswordFeedback("Cập nhật mật khẩu thành công!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function handleExportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      platform: "5K-Rental Manager",
      preferences: {
        showRoommateProfile,
        allowLandlordContact,
        hidePhoneOnPosts,
        emailAlerts,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `5k-rental-data-${Date.now()}.json`;
    a.click();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <nav className="text-[12px] text-[#74817b] flex items-center gap-1.5 mb-2">
          <Link href="/" className="hover:text-[#203c37]">Trang chủ</Link>
          <span>/</span>
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-[#203c37] font-semibold">Cài đặt & Quyền riêng tư</span>
        </nav>
        <h1 className="text-[28px] font-semibold text-[#203c37] tracking-tight">
          Cài đặt & Quyền riêng tư
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Quản lý mật khẩu đăng nhập, các phiên hoạt động và tùy chọn quyền riêng tư dữ liệu.
        </p>
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 Cols): Security & Sessions */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Change Password Form */}
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2.5 text-[#203c37]">
              <Lock className="size-5 text-[#15594f]" />
              <h2 className="text-[18px] font-semibold">Đổi mật khẩu</h2>
            </div>

            {passwordFeedback && (
              <div
                className={`p-3.5 rounded-[8px] text-[13px] ${
                  passwordFeedback.includes("thành công")
                    ? "bg-[#eaf2ed] text-[#15594f]"
                    : "bg-[#fee2e2] text-[#991b1b]"
                }`}
              >
                {passwordFeedback}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu đang dùng"
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] outline-none focus:border-[#15594f]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] outline-none focus:border-[#15594f]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Xác nhận mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] outline-none focus:border-[#15594f]"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="h-[44px] px-6 rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[13px] font-semibold transition-colors cursor-pointer"
              >
                Cập nhật mật khẩu
              </button>
            </form>
          </div>

          {/* Card 2: Active Sessions (Figma 44:66340) */}
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-5">
            <h2 className="text-[18px] font-semibold text-[#203c37]">
              Phiên đăng nhập đang hoạt động
            </h2>

            <div className="space-y-4 divide-y divide-[#e2e7e1]">
              {/* Session 1: Current desktop */}
              <div className="flex items-center justify-between pt-3 first:pt-0">
                <div className="flex items-center gap-3.5">
                  <div className="size-10 rounded-[8px] bg-[#eaf2ed] text-[#15594f] flex items-center justify-center">
                    <Monitor className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#203c37]">
                        Chrome trên Windows (Máy tính này)
                      </p>
                      <span className="px-2 py-0.5 rounded-[100px] bg-[#eaf2ed] text-[#15594f] text-[11px] font-bold">
                        Đang hoạt động
                      </span>
                    </div>
                    <p className="text-[12px] text-[#74817b] mt-0.5">
                      IP: 118.69.182.44 • TP. Hồ Chí Minh
                    </p>
                  </div>
                </div>
              </div>

              {/* Session 2: Mobile device */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-3.5">
                  <div className="size-10 rounded-[8px] bg-[#f2ede3] text-[#74817b] flex items-center justify-center">
                    <Smartphone className="size-5" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#203c37]">
                      Safari trên iPhone 14
                    </p>
                    <p className="text-[12px] text-[#74817b] mt-0.5">
                      Hoạt động 2 ngày trước • Hà Nội
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSessionFeedback("Thiết bị Safari đã được đánh dấu đăng xuất.")}
                  className="text-[13px] text-[#991b1b] font-medium hover:underline cursor-pointer"
                >
                  Đăng xuất
                </button>
              </div>
            </div>

            <button
              onClick={async () => {
                await logout();
                setSessionFeedback("Đã đăng xuất khỏi các phiên khác.");
              }}
              className="h-[40px] px-4 rounded-[8px] border border-[#e2e7e1] text-[#74817b] hover:text-[#203c37] text-[13px] font-medium hover:bg-[#f7f6f2] transition-colors cursor-pointer"
            >
              Đăng xuất khỏi tất cả thiết bị khác
            </button>
          </div>

          {/* Card 3: Privacy & Discovery Toggles */}
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-4">
            <h2 className="text-[18px] font-semibold text-[#203c37]">
              Quyền riêng tư & Tìm kiếm
            </h2>

            <div className="space-y-4 divide-y divide-[#e2e7e1]">
              <label className="flex items-center justify-between pt-3 first:pt-0 cursor-pointer">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-[#203c37]">
                    Hiển thị hồ sơ ở ghép trong mục khám phá
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    Cho phép những người tìm bạn ở ghép xem được điểm tương thích lối sống của bạn.
                  </p>
                </div>
                {sessionFeedback && <p className="text-sm text-[#15594f]">{sessionFeedback}</p>}
                <input
                  type="checkbox"
                  checked={showRoommateProfile}
                  onChange={(e) => setShowRoommateProfile(e.target.checked)}
                  className="size-5 accent-[#15594f] rounded"
                />
              </label>

              <label className="flex items-center justify-between pt-3 cursor-pointer">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-[#203c37]">
                    Cho phép chủ trọ liên hệ trực tiếp
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    Chủ trọ có phòng phù hợp với tiêu chí tìm kiếm của bạn có thể gửi tin nhắn đề xuất.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowLandlordContact}
                  onChange={(e) => setAllowLandlordContact(e.target.checked)}
                  className="size-5 accent-[#15594f] rounded"
                />
              </label>

              <label className="flex items-center justify-between pt-3 cursor-pointer">
                <div className="pr-4">
                  <p className="text-[14px] font-medium text-[#203c37]">
                    Ẩn số điện thoại trên các tin đăng tìm bạn ở ghép
                  </p>
                  <p className="text-[12px] text-[#74817b]">
                    Mọi người chỉ có thể nhắn tin cho bạn qua hệ thống trò chuyện nội bộ của 5K-Rental Manager.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={hidePhoneOnPosts}
                  onChange={(e) => setHidePhoneOnPosts(e.target.checked)}
                  className="size-5 accent-[#15594f] rounded"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right Column (4 Cols): Notifications & Danger Zone */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Card: Notification Preferences */}
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#203c37]">
              <Bell className="size-5 text-[#15594f]" />
              <h3 className="text-[16px] font-semibold">Tùy chọn thông báo</h3>
            </div>

            <div className="space-y-3.5 divide-y divide-[#e2e7e1] text-[13px]">
              <label className="flex items-center justify-between pt-2 first:pt-0 cursor-pointer">
                <span>Thông báo qua Email</span>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="size-4 accent-[#15594f]"
                />
              </label>

              <label className="flex items-center justify-between pt-2 cursor-pointer">
                <span>Thông báo đẩy trên trình duyệt</span>
                <input
                  type="checkbox"
                  checked={pushAlerts}
                  onChange={(e) => setPushAlerts(e.target.checked)}
                  className="size-4 accent-[#15594f]"
                />
              </label>

              <label className="flex items-center justify-between pt-2 cursor-pointer">
                <span>Tin nhắn mới từ chủ trọ</span>
                <input
                  type="checkbox"
                  checked={messageAlerts}
                  onChange={(e) => setMessageAlerts(e.target.checked)}
                  className="size-4 accent-[#15594f]"
                />
              </label>

              <label className="flex items-center justify-between pt-2 cursor-pointer">
                <span>Nhắc nhở hợp đồng & hóa đơn</span>
                <input
                  type="checkbox"
                  checked={contractAlerts}
                  onChange={(e) => setContractAlerts(e.target.checked)}
                  className="size-4 accent-[#15594f]"
                />
              </label>
            </div>
          </div>

          {/* Card: Export & Data */}
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-4">
            <h3 className="text-[16px] font-semibold text-[#203c37]">Dữ liệu cá nhân</h3>
            <p className="text-[12px] text-[#74817b] leading-relaxed">
              Bạn có quyền sao lưu và tải xuống toàn bộ dữ liệu lịch sử phòng đã lưu và thông tin hồ sơ của mình.
            </p>

            <button
              onClick={handleExportData}
              className="w-full h-[42px] rounded-[8px] border border-[#e2e7e1] text-[#15594f] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[#eaf2ed] transition-colors cursor-pointer"
            >
              <Download className="size-4" />
              <span>Tải xuống dữ liệu (.JSON)</span>
            </button>
          </div>

          {/* Danger Zone: Delete Account */}
          <div className="bg-[#fee2e2]/30 rounded-[12px] border border-[#fee2e2] p-6 space-y-3">
            <h3 className="text-[15px] font-semibold text-[#991b1b]">Xóa tài khoản</h3>
            <p className="text-[12px] text-[#74817b] leading-relaxed">
              Xóa vĩnh viễn tài khoản 5K-Rental Manager và toàn bộ lịch sử hợp đồng liên kết. Hành động này không thể hoàn tác.
            </p>

            <button
              onClick={() => setDeleteModalOpen(true)}
              className="w-full h-[40px] rounded-[8px] bg-[#991b1b] text-white text-[13px] font-semibold hover:bg-[#7f1d1d] transition-colors cursor-pointer"
            >
              Yêu cầu xóa tài khoản
            </button>
          </div>
        </aside>
      </div>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Xác nhận xóa tài khoản vĩnh viễn"
        description="Vui lòng nhập 'XÓA TÀI KHOẢN' để xác nhận."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={deleteConfirmText !== "XÓA TÀI KHOẢN"}
              onClick={() => {
                setDeleteModalOpen(false);
                setPasswordFeedback("Yêu cầu xóa tài khoản đã được ghi nhận và sẽ được bộ phận hỗ trợ liên hệ.");
              }}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-[#991b1b]">
            Cảnh báo: Toàn bộ danh sách phòng yêu thích, các cuộc trò chuyện và dữ liệu hồ sơ sẽ bị xóa hoàn toàn khỏi hệ thống 5K-Rental Manager.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="XÓA TÀI KHOẢN"
            className="w-full h-[40px] px-3 rounded-[8px] border border-[#e2e7e1] text-[13px] outline-none"
          />
        </div>
      </Modal>
    </div>
  );
}
