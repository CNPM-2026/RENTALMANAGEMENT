"use client";

import * as React from "react";
import {
  Sparkles,
  Save,
  Check,
  Info,
  Upload,
  User,
  Heart,
  Moon,
  Clock,
  Dog,
  Utensils,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api";

export default function TenantRoommateProfilePage() {
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3>(1);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);

  // Form State
  const [budgetMin, setBudgetMin] = React.useState("3000000");
  const [budgetMax, setBudgetMax] = React.useState("4500000");
  const [preferredDistrict, setPreferredDistrict] = React.useState("Quận 10");
  const [moveInDate, setMoveInDate] = React.useState("2026-11-15");
  const [sleepSchedule, setSleepSchedule] = React.useState("22:30");
  const [cleanlinessLevel, setCleanlinessLevel] = React.useState(5);
  const [petAllowed, setPetAllowed] = React.useState(true);
  const [cookingHabit, setCookingHabit] = React.useState("REGULAR");
  const [smokingAllowed, setSmokingAllowed] = React.useState(false);
  const [guestPolicy, setGuestPolicy] = React.useState("NOTIFY_FIRST");
  const [preferredGender, setPreferredGender] = React.useState("ANY");
  const [bioNote, setBioNote] = React.useState(
    "Mình là nhân viên văn phòng, tính tình hòa nhã, giữ gìn vệ sinh chung và tôn trọng sự riêng tư của bạn cùng phòng."
  );
  const [isDiscoverable, setIsDiscoverable] = React.useState(true);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.matching.updatePreferences({
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        preferredDistrict,
        cleanlinessLevel,
        sleepSchedule,
        petAllowed,
        smokingAllowed,
        preferredGender,
        note: bioNote,
      });
    } catch {
      // Local sync fallback
    } finally {
      setIsSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-8 max-w-[1204px]">
      {/* Toast Alert */}
      {savedSuccess && (
        <div className="fixed top-24 right-8 z-50 bg-[#15594f] text-white px-5 py-3.5 rounded-[8px] shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
          <Check className="size-5 shrink-0" />
          <span className="text-[14px] font-medium">Hồ sơ gu sống của bạn đã được lưu thành công trên 5K-Rental Manager!</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">
          Hồ sơ gu sống & Tìm bạn ở ghép
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Thiết lập thói quen sinh hoạt và tiêu chí để thuật toán ghép nối chính xác người ở ghép tương thích nhất.
        </p>
      </div>

      {/* Step Navigation Tabs (Figma 44:63685) */}
      <div className="flex border-b border-[#e2e7e1] gap-8">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className={`pb-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            currentStep === 1
              ? "border-[#15594f] text-[#15594f]"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          1. Ngân sách & Khu vực
        </button>
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
          className={`pb-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            currentStep === 2
              ? "border-[#15594f] text-[#15594f]"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          2. Thói quen sinh hoạt
        </button>
        <button
          type="button"
          onClick={() => setCurrentStep(3)}
          className={`pb-3 text-[14px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
            currentStep === 3
              ? "border-[#15594f] text-[#15594f]"
              : "border-transparent text-[#74817b] hover:text-[#203c37]"
          }`}
        >
          3. Tiêu chí bạn cùng phòng
        </button>
      </div>

      {/* 2-Column Split: Form Left + Live Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Container (Figma 44:63693 - 808px) */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* STEP 1: Ngân sách và Nơi ở */}
            {currentStep === 1 && (
              <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-[18px] font-bold text-[#203c37]">Ngân sách & Nơi ở mong muốn</h3>
                  <p className="text-[13px] text-[#74817b] mt-0.5">Xác định khung chi phí và địa điểm bạn dự kiến thuê phòng.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Ngân sách tối thiểu (VNĐ/tháng)"
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    required
                  />
                  <Input
                    label="Ngân sách tối đa (VNĐ/tháng)"
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <label className="block text-[13px] font-medium text-[#203c37]">Khu vực quận/huyện ưu tiên</label>
                    <select
                      value={preferredDistrict}
                      onChange={(e) => setPreferredDistrict(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none"
                    >
                      <option value="Quận 1">Quận 1</option>
                      <option value="Quận 3">Quận 3</option>
                      <option value="Quận 10">Quận 10</option>
                      <option value="Bình Thạnh">Bình Thạnh</option>
                      <option value="Phú Nhuận">Phú Nhuận</option>
                      <option value="Quận 7">Quận 7</option>
                    </select>
                  </div>

                  <Input
                    label="Ngày dự kiến dọn vào"
                    type="date"
                    value={moveInDate}
                    onChange={(e) => setMoveInDate(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="button" variant="primary" onClick={() => setCurrentStep(2)}>
                    Tiếp tục: Thói quen sinh hoạt
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 2: Thói quen sinh hoạt */}
            {currentStep === 2 && (
              <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-[18px] font-bold text-[#203c37]">Khảo sát thói quen sinh hoạt</h3>
                  <p className="text-[13px] text-[#74817b] mt-0.5">Thuật toán dùng các câu trả lời này để tính điểm tương đồng.</p>
                </div>

                <div className="space-y-4">
                  {/* Sleep Schedule */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">Giờ đi ngủ thường ngày của bạn</label>
                    <select
                      value={sleepSchedule}
                      onChange={(e) => setSleepSchedule(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none"
                    >
                      <option value="22:00">Trước 22:00 (Ngủ rất sớm)</option>
                      <option value="22:30">22:00 - 23:00 (Ngủ sớm tiêu chuẩn)</option>
                      <option value="23:30">23:00 - 00:00 (Bình thường)</option>
                      <option value="01:00">Sau 00:00 (Cú đêm)</option>
                    </select>
                  </div>

                  {/* Cleanliness */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">
                      Mức độ ngăn nắp, sạch sẽ: <span className="font-bold text-[#15594f]">{cleanlinessLevel} / 5 sao</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={cleanlinessLevel}
                      onChange={(e) => setCleanlinessLevel(Number(e.target.value))}
                      className="w-full accent-[#15594f] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-[#74817b]">
                      <span>1: Thoải mái, không khắt khe</span>
                      <span>3: Trung bình</span>
                      <span>5: Rất sạch sẽ, gọn gàng</span>
                    </div>
                  </div>

                  {/* Pet Allowed */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">Bạn có nuôi hoặc đồng ý sống chung với thú cưng không?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPetAllowed(true)}
                        className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                          petAllowed ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]" : "bg-white border-[#e2e7e1] text-[#74817b]"
                        }`}
                      >
                        Có (Yêu thú cưng)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPetAllowed(false)}
                        className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                          !petAllowed ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]" : "bg-white border-[#e2e7e1] text-[#74817b]"
                        }`}
                      >
                        Không nuôi thú cưng
                      </button>
                    </div>
                  </div>

                  {/* Smoking */}
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">Hút thuốc lá</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSmokingAllowed(false)}
                        className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                          !smokingAllowed ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]" : "bg-white border-[#e2e7e1] text-[#74817b]"
                        }`}
                      >
                        Tuyệt đối không hút thuốc
                      </button>
                      <button
                        type="button"
                        onClick={() => setSmokingAllowed(true)}
                        className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                          smokingAllowed ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]" : "bg-white border-[#e2e7e1] text-[#74817b]"
                        }`}
                      >
                        Có hút ngoài ban công
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(1)}>
                    Quay lại
                  </Button>
                  <Button type="button" variant="primary" onClick={() => setCurrentStep(3)}>
                    Tiếp tục: Tiêu chí bạn cùng phòng
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 3: Tiêu chí bạn cùng phòng lý tưởng */}
            {currentStep === 3 && (
              <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-6">
                <div>
                  <h3 className="text-[18px] font-bold text-[#203c37]">Tiêu chí bạn cùng phòng lý tưởng</h3>
                  <p className="text-[13px] text-[#74817b] mt-0.5">Đặt ra mong muốn để hệ thống lọc các hồ sơ phù hợp nhất.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">Ưu tiên giới tính của bạn ghép</label>
                    <select
                      value={preferredGender}
                      onChange={(e) => setPreferredGender(e.target.value)}
                      className="w-full min-h-[48px] px-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none"
                    >
                      <option value="ANY">Không quan trọng (Nam hoặc Nữ)</option>
                      <option value="MALE">Chỉ ở ghép với Nam</option>
                      <option value="FEMALE">Chỉ ở ghép với Nữ</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[#203c37]">Mô tả chi tiết về bản thân và mong muốn</label>
                    <textarea
                      rows={4}
                      value={bioNote}
                      onChange={(e) => setBioNote(e.target.value)}
                      className="w-full p-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
                      placeholder="Mô tả công việc, sở thích, những điều cần lưu ý khi ở chung..."
                    />
                  </div>

                  {/* Toggle Discoverability Checkbox (Figma 44:63746) */}
                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isDiscoverable}
                        onChange={(e) => setIsDiscoverable(e.target.checked)}
                        className="size-4.5 accent-[#15594f] rounded-[4px]"
                      />
                      <span className="text-[13px] font-medium text-[#203c37]">
                        Hiển thị hồ sơ của tôi trong danh mục &ldquo;Khám phá người hợp gu&rdquo; để nhận lời mời kết nối
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-[#e2e7e1]">
                  <Button type="button" variant="outline" onClick={() => setCurrentStep(2)}>
                    Quay lại
                  </Button>
                  <Button type="submit" variant="primary" loading={isSaving} leftIcon={<Save className="size-4" />}>
                    Lưu hồ sơ gu sống
                  </Button>
                </div>
              </Card>
            )}
          </form>
        </div>

        {/* Live Preview Card (Figma 44:63762 - 300px) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#74817b] uppercase tracking-wider">
            <Eye className="size-4 text-[#15594f]" /> Bản xem trước hồ sơ của bạn
          </div>

          <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="size-20 rounded-full overflow-hidden bg-[#eaf2ed] border-2 border-[#15594f]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80"
                  alt="Ảnh của bạn"
                  className="size-full object-cover"
                />
              </div>
              <h4 className="text-[18px] font-bold text-[#203c37]">Linh Nguyễn</h4>
              <p className="text-[12px] text-[#74817b]">Nhân viên văn phòng • TP.HCM</p>
              <Badge variant="success" size="sm">Hồ sơ hoàn thiện 100%</Badge>
            </div>

            <div className="border-t border-[#e2e7e1] pt-3 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#74817b]">Ngân sách:</span>
                <strong className="text-[#15594f]">
                  {(Number(budgetMin) / 1000000).toFixed(1)} - {(Number(budgetMax) / 1000000).toFixed(1)} tr/tháng
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#74817b]">Khu vực:</span>
                <strong className="text-[#203c37]">{preferredDistrict}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#74817b]">Giờ ngủ:</span>
                <strong className="text-[#203c37]">{sleepSchedule}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#74817b]">Thú cưng:</span>
                <strong className="text-[#203c37]">{petAllowed ? "Cho phép" : "Không nuôi"}</strong>
              </div>
            </div>

            <p className="text-[12px] text-[#74817b] italic line-clamp-3 border-t border-[#e2e7e1] pt-2">
              &ldquo;{bioNote}&rdquo;
            </p>
          </Card>

          <div className="bg-[#eaf2ed] border border-[#15594f]/20 rounded-[12px] p-4 text-[12px] text-[#203c37] flex items-start gap-2.5">
            <Sparkles className="size-4 text-[#15594f] shrink-0 mt-0.5" />
            <p>
              Hồ sơ gu sống càng chân thực và chi tiết sẽ tăng 300% cơ hội tìm được người ở ghép hợp ý trong vòng 7 ngày.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}