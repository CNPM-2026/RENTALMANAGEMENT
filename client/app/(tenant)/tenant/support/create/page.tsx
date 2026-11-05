"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  HelpCircle,
  Upload,
  Send,
  X,
  FileImage,
  Info,
  Clock,
  ShieldCheck,
  Phone,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { Contract } from "@/types/models";

export default function CreateSupportTicketPage() {
  const router = useRouter();

  const [category, setCategory] = React.useState("MAINTENANCE");
  const [roomId, setRoomId] = React.useState("");
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [allowEntryWhenAbsent, setAllowEntryWhenAbsent] = React.useState(true);
  const [attachedFiles, setAttachedFiles] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiClient.contracts.getMyContracts().then(setContracts).catch(() => setContracts([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      await apiClient.support.create({
        roomId: roomId === "other" ? undefined : roomId,
        category,
        subject: title.trim(),
        description: description.trim(),
      });
      router.push("/tenant/support?created=true");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFile = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6 max-w-[1204px]">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
        <Link href="/tenant/support" className="hover:text-[#15594f] flex items-center gap-1 transition-colors">
          <ChevronLeft className="size-4" />
          Quay lại Trung tâm hỗ trợ
        </Link>
        <span>/</span>
        <span className="text-[#203c37] font-medium">Tạo phiếu yêu cầu</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-[26px] font-bold text-[#203c37] tracking-tight">
          Gửi yêu cầu hỗ trợ kỹ thuật & dịch vụ
        </h1>
        <p className="text-[14px] text-[#74817b] mt-1">
          Mô tả chi tiết sự cố bạn đang gặp phải để đội ngũ 5K-Rental Manager điều phối nhân sự xử lý nhanh nhất.
        </p>
      </div>

      {/* 2-Column Split: Form Left + Guidance Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Form Container (Figma 44:66610 - 788px) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-5">
              <h3 className="text-[18px] font-bold text-[#203c37]">Nội dung sự cố cần xử lý</h3>

              {/* Room Selector */}
              <div className="space-y-1.5 text-left">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Phòng / Bất động sản liên quan <span className="text-red-500">*</span>
                </label>
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none"
                >
                  <option value="">Chọn phòng liên quan</option>
                  {contracts.filter((contract) => contract.status === "ACTIVE").map((contract) => (
                    <option key={contract.id} value={contract.roomId}>Phòng {contract.room?.roomNumber ?? contract.roomId} - Hợp đồng {contract.id}</option>
                  ))}
                  <option value="other">Vấn đề chung khác / Ngoài hợp đồng</option>
                </select>
              </div>

              {/* Issue Category */}
              <div className="space-y-1.5 text-left">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Nhóm sự cố <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none"
                >
                  <option value="MAINTENANCE">Cơ sở vật chất & Điện nước (Hỏng điều hòa, bóng đèn, vòi nước...)</option>
                  <option value="CONTRACT">Hợp đồng & Pháp lý (Gia hạn, chuyển nhượng, cọc)</option>
                  <option value="BILLING">Hóa đơn & Tiền tệ (Sai chỉ số điện nước, phí dịch vụ)</option>
                  <option value="NEIGHBOR">Tiếng ồn & Bạn cùng phòng (Trật tự an ninh tòa nhà)</option>
                  <option value="OTHER">Vấn đề khác</option>
                </select>
              </div>

              {/* Title */}
              <Input
                label="Tiêu đề yêu cầu tóm tắt"
                placeholder="Ví dụ: Điều hòa phòng 302 bị rò rỉ nước và kém lạnh..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              {/* Description */}
              <div className="space-y-1.5 text-left">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Mô tả chi tiết hiện trạng <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Mô tả cụ thể thời gian bắt đầu xảy ra sự cố, mức độ ảnh hưởng..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
                  required
                />
              </div>

              {/* File Attachment Dropzone (Figma 44:66630) */}
              <div className="space-y-2">
                <label className="block text-[13px] font-medium text-[#203c37]">
                  Hình ảnh / Video minh chứng sự cố (Tối đa 5 tệp)
                </label>
                <div
                  onClick={() => setAttachedFiles((prev) => [...prev, `file_dinh_kem_${Date.now()}.png`])}
                  className="border-2 border-dashed border-[#e2e7e1] rounded-[8px] p-6 text-center hover:bg-[#f7f6f2] transition-colors cursor-pointer space-y-1"
                >
                  <Upload className="size-6 text-[#15594f] mx-auto" />
                  <p className="text-[13px] font-semibold text-[#203c37]">Kéo thả tệp hoặc bấm vào đây để tải ảnh lên</p>
                  <p className="text-[11px] text-[#74817b]">Định dạng JPG, PNG, MP4 dung lượng tối đa 15MB/tệp</p>
                </div>

                {/* Attached Files List (Figma 44:66634) */}
                {attachedFiles.map((filename, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 px-3.5 bg-[#f7f6f2] rounded-[6px] border border-[#e2e7e1] text-[13px]"
                  >
                    <div className="flex items-center gap-2 text-[#203c37]">
                      <FileImage className="size-4 text-[#15594f]" />
                      <span className="font-medium">{filename}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-[#74817b] hover:text-[#991b1b] cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Contact Phone & Permission */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#e2e7e1] pt-4">
                <Input
                  label="Số điện thoại kỹ thuật viên liên hệ"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  required
                />
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowEntryWhenAbsent}
                    onChange={(e) => setAllowEntryWhenAbsent(e.target.checked)}
                    className="size-4.5 accent-[#15594f] rounded-[4px] mt-0.5"
                  />
                  <span className="text-[13px] text-[#203c37]">
                    Cho phép chủ trọ / kỹ thuật viên mở cửa vào kiểm tra và sửa chữa trong trường hợp tôi vắng nhà (có ghi biên bản).
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e7e1]">
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Hủy bỏ
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting} leftIcon={<Send className="size-4" />}>
                  Gửi phiếu hỗ trợ
                </Button>
              </div>
            </Card>
          </form>
        </div>

        {/* Guidance & SLA Information (Figma 44:66659 - 320px) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm space-y-4">
            <h3 className="text-[16px] font-bold text-[#203c37] flex items-center gap-2">
              <Clock className="size-4.5 text-[#15594f]" /> Cam kết thời gian xử lý (SLA)
            </h3>
            <p className="text-[13px] text-[#74817b] leading-relaxed">
              5K-Rental Manager cam kết tiếp nhận và phản hồi phiếu hỗ trợ trong vòng:
            </p>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between py-1.5 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Tiếp nhận ban đầu:</span>
                <strong className="text-[#15594f]">Dưới 15 phút</strong>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#e2e7e1]/60">
                <span className="text-[#74817b]">Kỹ thuật viên liên hệ:</span>
                <strong className="text-[#203c37]">Trong 2 giờ</strong>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#74817b]">Khắc phục dứt điểm:</span>
                <strong className="text-[#203c37]">24 - 48 giờ</strong>
              </div>
            </div>
          </Card>

          <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[12px] p-4 text-[12px] text-[#203c37] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#15594f]">
              <Phone className="size-4" /> Tổng đài khẩn cấp 1900 5858
            </div>
            <p className="text-[#74817b]">
              Nếu sự cố khẩn cấp (chập điện, rò rỉ nước nghiêm trọng), vui lòng gọi trực tiếp hotline để được ngắt nguồn và xử lý ngay lập tức.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}