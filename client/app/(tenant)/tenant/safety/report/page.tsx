"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShieldAlert,
  Flag,
  Upload,
  Check,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ImagePlus,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { ReportTargetType } from "@/types/models";

function SafetyReportViolationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTargetType = (searchParams?.get("targetType") as ReportTargetType) || "POST";
  const queryTargetId = searchParams?.get("targetId") || "";
  const queryTargetUrl = searchParams?.get("targetUrl") || "";

  // State
  const [targetType, setTargetType] = React.useState<ReportTargetType>(queryTargetType);
  const [targetIdentifier, setTargetIdentifier] = React.useState(queryTargetId);
  const [targetUrl, setTargetUrl] = React.useState(queryTargetUrl);
  const [violationCategory, setViolationCategory] = React.useState("FAKE_LISTING");
  const [reasonDescription, setReasonDescription] = React.useState("");
  const [contactInfo, setContactInfo] = React.useState("");
  const [isCommitted, setIsCommitted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submittedSuccess, setSubmittedSuccess] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const categories = [
    {
      id: "FAKE_LISTING",
      label: "Tin đăng ảo / Hình ảnh không đúng thực tế",
      description: "Phòng thực tế khác xa với hình ảnh trên tin đăng hoặc phòng không có thật.",
    },
    {
      id: "ILLEGAL_DEPOSIT",
      label: "Đòi tiền đặt cọc giữ chỗ trái quy định",
      description: "Yêu cầu chuyển cọc trước khi xem phòng hoặc né tránh ký hợp đồng.",
    },
    {
      id: "PRICE_FRAUD",
      label: "Giá thuê thực tế cao hơn giá niêm yết",
      description: "Cố tình đăng giá rẻ để thu hút khách rồi nâng giá khi đến xem phòng.",
    },
    {
      id: "HARASSMENT",
      label: "Thái độ xúc phạm, quấy rối hoặc đe dọa",
      description: "Có ngôn từ thiếu văn hóa, quấy rối qua tin nhắn hoặc số điện thoại.",
    },
    {
      id: "OTHER",
      label: "Hành vi gian lận hoặc vi phạm an ninh khác",
      description: "Các hành vi vi phạm pháp luật hoặc điều khoản nền tảng 5K-Rental Manager.",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonDescription.trim()) {
      setErrorMessage("Vui lòng nhập mô tả chi tiết bằng chứng vi phạm.");
      return;
    }
    if (!isCommitted) {
      setErrorMessage("Bạn cần cam kết tính xác thực của thông tin báo cáo.");
      return;
    }
    if (!targetIdentifier.trim()) {
      setErrorMessage("Vui lòng cung cấp mã tin đăng hoặc đối tượng cần báo cáo.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await apiClient.reports.create({
        targetType,
        targetId: targetIdentifier.trim(),
        reason: `[${violationCategory}] ${reasonDescription.trim()} (URL: ${targetUrl || "Không có"}) (Liên hệ xác minh: ${contactInfo})`,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể gửi báo cáo. Vui lòng thử lại.");
      setIsSubmitting(false);
      return;
    } finally {
      setIsSubmitting(false);
    }
    setSubmittedSuccess(true);
    setTimeout(() => router.push("/tenant/safety?reported=true"), 2500);
  };

  return (
    <div className="space-y-6 max-w-[1204px]">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
        <Link href="/tenant/safety" className="hover:text-[#15594f] flex items-center gap-1 transition-colors">
          <ChevronLeft className="size-4" />
          Quay lại Trung tâm an toàn
        </Link>
        <span>/</span>
        <span className="text-[#203c37] font-medium">Báo cáo vi phạm</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">
          Báo cáo vi phạm & Khiếu nại an toàn
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          5K-Rental Manager cam kết bảo mật 100% danh tính của bạn và xử lý nghiêm minh mọi hành vi gian lận.
        </p>
      </div>

      {submittedSuccess ? (
        <Card className="border border-emerald-200 bg-emerald-50 rounded-[12px] p-8 text-center space-y-3">
          <div className="size-12 rounded-full bg-[#15594f] text-white flex items-center justify-center mx-auto">
            <Check className="size-6" />
          </div>
          <h3 className="text-[20px] font-bold text-[#15594f]">Đã gửi báo cáo vi phạm thành công!</h3>
          <p className="text-[14px] text-[#203c37] max-w-md mx-auto leading-relaxed">
            Cảm ơn bạn đã chung tay bảo vệ cộng đồng. Đội ngũ an ninh 5K-Rental Manager sẽ xác minh độc lập và xử lý đối tượng trong vòng 2 giờ làm việc.
          </p>
        </Card>
      ) : (
        /* 2-Column Split: Form Left + Policy Right */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Container (Figma 44:66830 - 788px) */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-5">
                <h3 className="text-[18px] font-bold text-[#203c37]">Thông tin đối tượng và nội dung vi phạm</h3>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-[8px] text-[13px] text-red-700 flex items-center gap-2">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Target Type Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Loại đối tượng vi phạm <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetType("POST")}
                      className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                        targetType === "POST"
                          ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]"
                          : "bg-white border-[#e2e7e1] text-[#74817b]"
                      }`}
                    >
                      Bài đăng cho thuê
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("USER")}
                      className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                        targetType === "USER"
                          ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]"
                          : "bg-white border-[#e2e7e1] text-[#74817b]"
                      }`}
                    >
                      Chủ trọ / Người dùng
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetType("ROOM")}
                      className={`p-3 rounded-[8px] border text-[13px] font-semibold text-center cursor-pointer transition-all ${
                        targetType === "ROOM"
                          ? "bg-[#eaf2ed] border-[#15594f] text-[#15594f]"
                          : "bg-white border-[#e2e7e1] text-[#74817b]"
                      }`}
                    >
                      Phòng trọ cụ thể
                    </button>
                  </div>
                </div>

                {/* Target Identifier / Link */}
                <Input
                  label="Link bài đăng hoặc mã đối tượng"
                  placeholder="Dán URL tin đăng hoặc nhập mã đối tượng..."
                  value={targetUrl || targetIdentifier}
                  onChange={(e) => {
                    setTargetUrl(e.target.value);
                    if (!queryTargetUrl) setTargetIdentifier(e.target.value);
                  }}
                />
                {targetUrl && <p className="text-xs text-[#74817b]">Mã bài đăng đã được gắn tự động để hệ thống xử lý.</p>}

                {/* Violation Category Selector (Figma 44:66842) */}
                <div className="space-y-2 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Lý do báo cáo vi phạm <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-start gap-3 p-3 rounded-[8px] border cursor-pointer transition-colors ${
                          violationCategory === cat.id
                            ? "bg-[#eaf2ed]/60 border-[#15594f]"
                            : "bg-[#f7f6f2]/50 border-[#e2e7e1] hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="category"
                          value={cat.id}
                          checked={violationCategory === cat.id}
                          onChange={(e) => setViolationCategory(e.target.value)}
                          className="size-4.5 accent-[#15594f] mt-0.5"
                        />
                        <div>
                          <strong className="text-[13px] text-[#203c37] block leading-tight">{cat.label}</strong>
                          <span className="text-[12px] text-[#74817b]">{cat.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Detailed Description */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Mô tả chi tiết bằng chứng vi phạm <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Mô tả cụ thể thời gian, diễn biến sự việc, số tiền bị đòi hỏi (nếu có)..."
                    value={reasonDescription}
                    onChange={(e) => setReasonDescription(e.target.value)}
                    className="w-full p-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
                    required
                  />
                </div>

                {/* Contact phone/email for follow-up */}
                <Input
                  label="Số điện thoại hoặc Email của bạn để xác minh khi cần"
                  placeholder="0987.xxx.xxx"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                />

                {/* Evidence Screenshot Dropzone (Figma 44:66866) */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#203c37]">
                    Hình ảnh chụp màn hình tin nhắn / chuyển khoản (Nếu có)
                  </label>
                  <div className="border-2 border-dashed border-[#e2e7e1] rounded-[8px] p-5 text-center hover:bg-[#f7f6f2] transition-colors cursor-pointer space-y-1">
                    <ImagePlus className="size-6 text-[#15594f] mx-auto" />
                    <p className="text-[13px] font-semibold text-[#203c37]">Tải ảnh chụp màn hình bằng chứng</p>
                    <p className="text-[11px] text-[#74817b]">PNG, JPG dung lượng tối đa 10MB</p>
                  </div>
                </div>

                {/* Legal Commitment Checkbox (Figma 44:66870) */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCommitted}
                      onChange={(e) => setIsCommitted(e.target.checked)}
                      className="size-4.5 accent-[#15594f] rounded-[4px] mt-0.5"
                    />
                    <span className="text-[13px] text-[#203c37] font-medium leading-relaxed">
                      Tôi cam kết những thông tin và bằng chứng cung cấp trên đây là hoàn toàn đúng sự thật và chịu trách nhiệm trước pháp luật về báo cáo này.
                    </span>
                  </label>
                </div>

                {/* Action Buttons (Figma 44:66874) */}
                <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e7e1]">
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Hủy bỏ
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    loading={isSubmitting}
                    leftIcon={<Flag className="size-4" />}
                  >
                    Gửi báo cáo vi phạm
                  </Button>
                </div>
              </Card>
            </form>
          </div>

          {/* Policy & Anonymity Commitment (Figma 44:66880 - 320px) */}
          <div className="lg:col-span-4 space-y-5">
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm space-y-4">
              <h3 className="text-[16px] font-bold text-[#203c37] flex items-center gap-2">
                <Lock className="size-4.5 text-[#15594f]" /> Bảo mật danh tính 100%
              </h3>
              <p className="text-[13px] text-[#74817b] leading-relaxed">
                Danh tính và thông tin cá nhân của người gửi báo cáo được mã hóa và bảo vệ tuyệt đối. Đối tượng bị báo cáo sẽ không bao giờ biết ai là người tố giác.
              </p>
              <div className="border-t border-[#e2e7e1]/60 pt-3 space-y-2 text-[12px]">
                <strong className="block text-[#15594f]">Quy trình điều tra độc lập:</strong>
                <ol className="list-decimal list-inside space-y-1 text-[#74817b]">
                  <li>Phong tỏa bài đăng tạm thời trong 2 giờ</li>
                  <li>Đối soát lịch sử tin nhắn & cuộc gọi</li>
                  <li>Khóa tài khoản vĩnh viễn nếu vi phạm</li>
                </ol>
              </div>
            </Card>

            <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[12px] p-4 text-[12px] text-[#203c37] space-y-1.5">
              <strong className="block text-[#15594f]">Cam kết minh bạch:</strong>
              <p className="text-[#74817b]">
                5K-Rental Manager kiên quyết loại bỏ mọi hành vi lừa đảo, chiếm đoạt tiền cọc để bảo vệ quyền lợi chính đáng của cộng đồng người thuê.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SafetyReportViolationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-[400px] flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải biểu mẫu báo cáo...
        </div>
      }
    >
      <SafetyReportViolationContent />
    </React.Suspense>
  );
}