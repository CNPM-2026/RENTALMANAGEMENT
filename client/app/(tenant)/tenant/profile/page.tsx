"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Save, User, ShieldCheck, Heart, Calendar, FileText, Info } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api";
import { getCurrentUser, updateStoredUser } from "@/lib/auth";
import { UserWithProfile } from "@/types/models";

export default function TenantProfilePage() {
  const [user, setUser] = React.useState<UserWithProfile | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [dob, setDob] = React.useState("");
  const [gender, setGender] = React.useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [occupation, setOccupation] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);

  const [, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Load user data on mount
  React.useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        const currentUser = await apiClient.auth.getMe();
        setUser(currentUser as UserWithProfile);
        setFullName(currentUser.fullName || "");
        setPhone(currentUser.phone || "");
        setAvatarPreview(currentUser.avatarUrl || null);

        const profile = (currentUser as UserWithProfile).profile;
        if (profile) {
          setDob(profile.dob ? profile.dob.split("T")[0] : "");
          setGender((profile.gender as "MALE" | "FEMALE" | "OTHER") || "MALE");
          setOccupation(profile.occupation || "");
          setBio(profile.bio || "");
        }
      } catch {
        // Fallback to local storage profile if offline
        const local = getCurrentUser();
        if (local) {
          setUser(local as UserWithProfile);
          setFullName(local.fullName || "");
          setPhone(local.phone || "");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFeedback({ type: "error", message: "Kích thước ảnh tối đa là 5MB." });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setFeedback(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      if (fullName.trim()) formData.append("fullName", fullName.trim());
      if (phone.trim()) formData.append("phone", phone.trim());
      if (dob) formData.append("dob", dob);
      if (gender) formData.append("gender", gender);
      if (occupation.trim()) formData.append("occupation", occupation.trim());
      if (bio.trim()) formData.append("bio", bio.trim());
      if (avatarFile) formData.append("avatar", avatarFile);

      const updated = await apiClient.users.updateProfile(formData);
      updateStoredUser({
        fullName: updated.fullName,
        phone: updated.phone,
        avatarUrl: updated.avatarUrl,
      });

      setUser((prev) => ({ ...prev, ...updated }));
      setFeedback({ type: "success", message: "Cập nhật hồ sơ cá nhân thành công!" });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFeedback({ type: "error", message: err.message || "Không thể cập nhật hồ sơ." });
      } else {
        setFeedback({ type: "error", message: "Lỗi kết nối máy chủ. Vui lòng thử lại sau." });
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Screen Header */}
      <div>
        <nav className="text-[12px] text-[#74817b] flex items-center gap-1.5 mb-2">
          <Link href="/" className="hover:text-[#203c37]">Trang chủ</Link>
          <span>/</span>
          <span>Tài khoản</span>
          <span>/</span>
          <span className="text-[#203c37] font-semibold">Chỉnh sửa hồ sơ</span>
        </nav>
        <h1 className="text-[28px] font-semibold text-[#203c37] tracking-tight">
          Hồ sơ cá nhân
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Quản lý thông tin định danh và thông tin liên hệ của bạn trên 5K-Rental Manager.
        </p>
      </div>

      {/* Profile Section Tabs */}
      <div className="flex border-b border-[#e2e7e1] gap-6 text-[14px] font-medium">
        <button className="pb-3 border-b-2 border-[#15594f] text-[#15594f] font-semibold cursor-pointer">
          Thông tin cơ bản
        </button>
        <Link
          href="/tenant/roommate-profile"
          className="pb-3 text-[#74817b] hover:text-[#203c37] transition-colors"
        >
          Hồ sơ gu sống & Ở ghép
        </Link>
        <Link
          href="/tenant/settings"
          className="pb-3 text-[#74817b] hover:text-[#203c37] transition-colors"
        >
          Bảo mật & Cài đặt
        </Link>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-[8px] text-[13px] border ${
            feedback.type === "success"
              ? "bg-[#eaf2ed] border-[#d2e4d7] text-[#15594f]"
              : "bg-[#fee2e2] border-[#fecaca] text-[#991b1b]"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Main 2-Column Grid (808px Form + 300px Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Card 1: Basic Info */}
            <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-6">
              <h2 className="text-[18px] font-semibold text-[#203c37]">
                Thông tin chung
              </h2>

              {/* Avatar Uploader Section */}
              <div className="flex items-center gap-5">
                <div className="relative size-[94px] rounded-full overflow-hidden bg-[#eaf2ed] border-2 border-[#15594f]/20 shrink-0 flex items-center justify-center text-[#15594f]">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-10" />
                  )}
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-[38px] px-4 rounded-[8px] border border-[#e2e7e1] bg-white text-[#203c37] text-[13px] font-semibold flex items-center gap-2 hover:bg-[#f7f6f2] transition-colors cursor-pointer"
                  >
                    <Camera className="size-4 text-[#15594f]" />
                    <span>Thay đổi ảnh đại diện</span>
                  </button>
                  <p className="text-[12px] text-[#74817b]">
                    Định dạng JPG, PNG hoặc WebP. Dung lượng tối đa 5MB.
                  </p>
                </div>
              </div>

              {/* Name & DOB Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Họ và tên <span className="text-[#991b1b]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Ngày sinh
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f]"
                  />
                </div>
              </div>

              {/* Occupation & Gender Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Nghề nghiệp / Lĩnh vực
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="Kỹ sư phần mềm, Sinh viên..."
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Giới tính
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f]"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              {/* Bio Field */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[13px] font-semibold text-[#203c37]">
                    Giới thiệu bản thân
                  </label>
                  <span className="text-[12px] text-[#74817b]">{bio.length}/200</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Chia sẻ ngắn gọn về thói quen sinh hoạt và tính cách của bạn..."
                  className="w-full p-3 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f] resize-none"
                />
              </div>
            </div>

            {/* Card 2: Contact Info */}
            <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-4">
              <h2 className="text-[18px] font-semibold text-[#203c37]">
                Thông tin liên hệ
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Địa chỉ email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-[#f7f6f2] border border-[#e2e7e1] text-[14px] text-[#74817b] cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912 345 678"
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-[8px] bg-white border border-[#e2e7e1] text-[14px] text-[#203c37] outline-none focus:border-[#15594f]"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-[8px] bg-[#eaf2ed] border border-[#d2e4d7] flex items-start gap-2.5">
                <Info className="size-4 text-[#15594f] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#15594f] leading-relaxed">
                  Thông tin liên hệ chỉ được hiển thị cho chủ trọ khi bạn gửi yêu cầu thuê phòng hoặc đặt lịch xem phòng trực tiếp.
                </p>
              </div>
            </div>

            {/* Form Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="h-[46px] px-6 rounded-[8px] border border-[#e2e7e1] bg-white text-[#203c37] text-[14px] font-semibold hover:bg-[#f7f6f2] transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="h-[46px] px-6 rounded-[8px] bg-[#15594f] hover:bg-[#103f39] text-white text-[14px] font-semibold flex items-center gap-2 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                <Save className="size-4" />
                <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Profile Summary (4 Cols) */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[12px] border border-[#e2e7e1] p-6 shadow-sm space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="size-[84px] rounded-full overflow-hidden bg-[#eaf2ed] border-2 border-[#15594f]/20 flex items-center justify-center text-[#15594f] mb-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-9" />
                )}
              </div>

              <h3 className="text-[17px] font-semibold text-[#203c37]">
                {fullName || "Người dùng"}
              </h3>
              <p className="text-[13px] text-[#74817b] mt-0.5">{occupation || "Người thuê phòng"}</p>

              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-[100px] bg-[#eaf2ed] text-[#15594f] text-[11px] font-bold">
                <ShieldCheck className="size-3.5" />
                <span>Người thuê đã xác thực</span>
              </div>
            </div>

            <div className="h-px bg-[#e2e7e1]" />

            {/* Activity Quick Stats */}
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between text-[#74817b]">
                <span className="flex items-center gap-2">
                  <Heart className="size-4 text-[#15594f]" />
                  <span>Phòng đã lưu</span>
                </span>
                <span className="font-semibold text-[#203c37]">12 phòng</span>
              </div>

              <div className="flex items-center justify-between text-[#74817b]">
                <span className="flex items-center gap-2">
                  <Calendar className="size-4 text-[#15594f]" />
                  <span>Lịch xem phòng</span>
                </span>
                <span className="font-semibold text-[#203c37]">2 lịch hẹn</span>
              </div>

              <div className="flex items-center justify-between text-[#74817b]">
                <span className="flex items-center gap-2">
                  <FileText className="size-4 text-[#15594f]" />
                  <span>Hợp đồng hiệu lực</span>
                </span>
                <span className="font-semibold text-[#203c37]">1 hợp đồng</span>
              </div>
            </div>

            <Link
              href="/roommates"
              className="block w-full text-center h-[42px] leading-[40px] rounded-[8px] border border-[#15594f] text-[#15594f] text-[13px] font-semibold hover:bg-[#eaf2ed] transition-colors"
            >
              Xem hồ sơ công khai
            </Link>
          </div>

          {/* Safety Card */}
          <div className="bg-[#f2ede3] rounded-[12px] border border-[#e2e7e1] p-5 space-y-2">
            <div className="flex items-center gap-2 text-[#15594f]">
              <ShieldCheck className="size-5" />
              <h4 className="text-[13px] font-bold">Bảo vệ quyền lợi</h4>
            </div>
            <p className="text-[12px] text-[#74817b] leading-relaxed">
              5K-Rental Manager bảo mật 100% dữ liệu cá nhân của bạn. Không chia sẻ mã OTP hoặc giấy tờ tùy thân với các bên trung gian không rõ nguồn gốc.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
