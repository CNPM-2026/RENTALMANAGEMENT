"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Sparkles,
  UserPlus,
  MessageCircle,
  Flag,
  ShieldCheck,
  Check,
  Info,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  Heart,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";

interface CompatibilityCriterion {
  name: string;
  score: number;
  explanation: string;
  myHabit: string;
  candidateHabit: string;
}

function RoommateDetailContent() {
  const params = useParams();
  const router = useRouter();
  const candidateId = (params?.id as string) || "candidate-1";

  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [inviteNote, setInviteNote] = React.useState("");
  const [isSent, setIsSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Candidate Mock Detail
  const candidate = {
    id: candidateId,
    fullName: "Nguyễn Hoàng Nam",
    age: 24,
    gender: "Nam",
    occupation: "Kỹ sư phần mềm • FPT Software",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    matchScore: 92,
    statusNote: "Đang tìm 1 bạn nam ở ghép căn hộ 2PN tại Quận 10",
    budgetMonthly: "3.500.000 - 4.500.000 đ/tháng",
    targetLocation: "Quận 10, Quận 3, Quận 1",
    moveInDate: "Đầu tháng 11/2026",
    bio: "Chào bạn! Mình là Nam, tốt nghiệp Bách Khoa và hiện làm lập trình viên. Mình ít nhậu nhẹt, không hút thuốc, giữ phòng ốc luôn sạch sẽ và tôn trọng tuyệt đối sự riêng tư của bạn cùng phòng. Mình thường tự nấu ăn đơn giản buổi tối.",
  };

  const compatibilityCriteria: CompatibilityCriterion[] = [
    {
      name: "Giờ giấc sinh hoạt",
      score: 100,
      explanation: "Hoàn hảo! Cả hai bạn đều đi ngủ trước 23:00 và thức dậy khoảng 06:30 sáng.",
      myHabit: "Ngủ lúc 22:30 • Dậy lúc 06:30",
      candidateHabit: "Ngủ lúc 22:30 • Dậy lúc 06:30",
    },
    {
      name: "Khả năng tài chính & Ngân sách",
      score: 95,
      explanation: "Khoảng ngân sách dự kiến của hai bạn trùng khớp 95% (3.5 - 4.5 triệu/tháng).",
      myHabit: "Ngân sách 4.0 triệu/tháng",
      candidateHabit: "Ngân sách 3.5 - 4.5 triệu/tháng",
    },
    {
      name: "Mức độ ngăn nắp & Sạch sẽ",
      score: 90,
      explanation: "Cả hai đều đánh giá tiêu chuẩn sạch sẽ 5/5 sao và đồng thuận dọn dẹp chung hàng tuần.",
      myHabit: "Sạch sẽ 5★, quét dọn mỗi ngày",
      candidateHabit: "Sạch sẽ 5★, không để bát đĩa qua đêm",
    },
    {
      name: "Thú cưng & Động vật",
      score: 100,
      explanation: "Cả hai bạn đều yêu quý mèo và không ai bị dị ứng lông động vật.",
      myHabit: "Thích nuôi mèo",
      candidateHabit: "Yêu thích thú cưng",
    },
    {
      name: "Nấu ăn & Sinh hoạt bếp",
      score: 85,
      explanation: "Đều có thói quen tự nấu ăn tại nhà 3-4 buổi/tuần, sẵn sàng chia sẻ chi phí gia vị cơ bản.",
      myHabit: "Tự nấu ăn 4 buổi/tuần",
      candidateHabit: "Tự nấu bữa tối",
    },
    {
      name: "Bạn bè & Khách ghé thăm",
      score: 90,
      explanation: "Thống nhất quy tắc báo trước ít nhất 2 giờ khi có bạn bè hoặc người thân ghé phòng chơi.",
      myHabit: "Báo trước khi có bạn tới",
      candidateHabit: "Báo trước và không ở lại qua đêm",
    },
  ];

  const handleSendInvitation = async () => {
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsSubmitting(false);
    setIsSent(true);
    setInviteModalOpen(false);
  };

  return (
    <div className="w-full bg-[#f7f6f2] min-h-screen py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
          <Link href="/roommates" className="hover:text-[#15594f] flex items-center gap-1 transition-colors">
            <ChevronLeft className="size-4" />
            Quay lại danh sách
          </Link>
          <span>/</span>
          <span className="text-[#203c37] font-medium">{candidate.fullName}</span>
        </div>

        {/* 2-Column Split: Left Profile + Right Compatibility Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Candidate Profile Summary (Figma 44:63831 - 325px) */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-6">
              {/* Avatar & Basic Info */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative size-[110px] rounded-full overflow-hidden bg-[#eaf2ed] border-3 border-[#15594f] shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={candidate.avatarUrl}
                    alt={candidate.fullName}
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-[22px] font-bold text-[#203c37] leading-tight">{candidate.fullName}</h2>
                  <p className="text-[14px] text-[#74817b] mt-1">{candidate.age} tuổi • Giới tính: {candidate.gender}</p>
                  <p className="text-[13px] font-medium text-[#15594f] mt-0.5">{candidate.occupation}</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaf2ed] text-[#15594f] text-[12px] font-semibold">
                  <ShieldCheck className="size-4" />
                  Đã xác minh qua 5K-Rental Manager
                </div>
              </div>

              {/* Status Note */}
              <div className="bg-[#f7f6f2] p-3.5 rounded-[8px] text-[13px] text-[#203c37] font-medium leading-relaxed">
                {candidate.statusNote}
              </div>

              {/* Key Specs */}
              <div className="space-y-3 border-t border-[#e2e7e1] pt-4 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#74817b] flex items-center gap-2">
                    <DollarSign className="size-4 text-[#15594f]" /> Ngân sách thuê
                  </span>
                  <span className="font-semibold text-[#203c37]">{candidate.budgetMonthly}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#74817b] flex items-center gap-2">
                    <MapPin className="size-4 text-[#15594f]" /> Khu vực ưu tiên
                  </span>
                  <span className="font-semibold text-[#203c37]">{candidate.targetLocation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#74817b] flex items-center gap-2">
                    <Calendar className="size-4 text-[#15594f]" /> Ngày dọn vào
                  </span>
                  <span className="font-semibold text-[#203c37]">{candidate.moveInDate}</span>
                </div>
              </div>

              {/* Bio */}
              <div className="border-t border-[#e2e7e1] pt-4 space-y-1.5">
                <span className="text-[12px] font-semibold text-[#74817b] uppercase tracking-wider">Giới thiệu bản thân</span>
                <p className="text-[13px] text-[#203c37] leading-relaxed italic">
                  &ldquo;{candidate.bio}&rdquo;
                </p>
              </div>

              {/* Action Buttons (Figma 44:63849, 44:63852, 44:63854) */}
              <div className="space-y-2.5 pt-2">
                <Button
                  variant={isSent ? "secondary" : "primary"}
                  size="md"
                  className="w-full"
                  disabled={isSent}
                  onClick={() => setInviteModalOpen(true)}
                  leftIcon={isSent ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                >
                  {isSent ? "Đã gửi lời mời kết nối" : "Gửi lời mời kết nối"}
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => router.push(`/tenant/messages?user=${candidate.id}`)}
                  leftIcon={<MessageCircle className="size-4" />}
                >
                  Nhắn tin trao đổi
                </Button>

                <Link
                  href={`/tenant/safety/report?targetType=USER&targetId=${candidate.id}`}
                  className="block w-full text-center text-[12px] text-[#74817b] hover:text-[#991b1b] transition-colors pt-2"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Flag className="size-3.5" /> Báo cáo hồ sơ không phù hợp
                  </span>
                </Link>
              </div>
            </Card>

            {/* Safety Tip Box (Figma 44:63857) */}
            <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[12px] p-4 text-[12px] text-[#203c37] flex items-start gap-3">
              <Info className="size-4 text-[#15594f] shrink-0 mt-0.5" />
              <p>
                <strong>Lời khuyên an toàn:</strong> Tuyệt đối không chuyển khoản đặt cọc khi chưa gặp mặt trực tiếp hoặc chưa xem phòng thực tế.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Compatibility Breakdown (Figma 44:63860 - 783px) */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Overall Score Banner (Figma 44:63861) */}
            <Card className="border border-[#e2e7e1] bg-gradient-to-r from-[#eaf2ed] to-white rounded-[12px] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Score Gauge Circle */}
                <div className="relative size-[120px] flex items-center justify-center shrink-0">
                  <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#d2e4d7" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#15594f"
                      strokeWidth="8"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * candidate.matchScore) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-[32px] font-bold text-[#15594f] leading-none">{candidate.matchScore}%</span>
                    <span className="text-[10px] font-semibold text-[#74817b] uppercase mt-1">Hợp gu</span>
                  </div>
                </div>

                {/* Score Commentary (Figma 44:63867) */}
                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#15594f] text-white text-[11px] font-semibold uppercase">
                    Độ tương thích rất cao
                  </span>
                  <h3 className="text-[20px] font-bold text-[#203c37]">Hai bạn có nhịp sống cực kỳ đồng điệu!</h3>
                  <p className="text-[14px] text-[#74817b] leading-relaxed">
                    Dựa trên khảo sát thói quen sinh hoạt và tiêu chí tìm kiếm, hai bạn tương đồng tuyệt đối về giờ giấc ngủ sớm, sự ngăn nắp và thiện cảm với thú cưng.
                  </p>
                </div>
              </div>
            </Card>

            {/* 2. Breakdown Criteria List (Figma 44:63870) */}
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-[18px] font-bold text-[#203c37]">Chi tiết điểm tương đồng theo từng tiêu chí</h3>
                <p className="text-[13px] text-[#74817b] mt-0.5">
                  Đối chiếu giữa câu trả lời khảo sát của bạn và ứng viên Nguyễn Hoàng Nam.
                </p>
              </div>

              <div className="space-y-6">
                {compatibilityCriteria.map((criterion, idx) => (
                  <div key={idx} className="space-y-2 border-b border-[#e2e7e1]/60 pb-5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="font-semibold text-[#203c37]">{criterion.name}</span>
                      <span className="font-bold text-[#15594f]">{criterion.score}%</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#f7f6f2] h-2 rounded-full overflow-hidden border border-[#e2e7e1]">
                      <div
                        className="bg-[#15594f] h-full rounded-full transition-all duration-500"
                        style={{ width: `${criterion.score}%` }}
                      />
                    </div>

                    {/* Explanation */}
                    <p className="text-[13px] text-[#74817b] leading-relaxed">{criterion.explanation}</p>

                    {/* Side-by-Side Comparison Pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[12px]">
                      <div className="bg-[#f7f6f2] px-3 py-2 rounded-[6px] border border-[#e2e7e1]">
                        <span className="text-[#74817b] block font-medium">Thói quen của bạn:</span>
                        <strong className="text-[#203c37]">{criterion.myHabit}</strong>
                      </div>
                      <div className="bg-[#eaf2ed] px-3 py-2 rounded-[6px] border border-[#d2e4d7]">
                        <span className="text-[#15594f] block font-medium">Thói quen của ứng viên:</span>
                        <strong className="text-[#15594f]">{criterion.candidateHabit}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Modal: Gửi lời mời kết nối */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Gửi lời mời kết nối ở ghép"
        description={`Bạn đang gửi lời mời kết nối tới ${candidate.fullName}. Bạn có thể đính kèm một lời nhắn ngắn để giới thiệu bản thân.`}
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setInviteModalOpen(false)}>
              Hủy bỏ
            </Button>
            <Button variant="primary" size="sm" loading={isSubmitting} onClick={handleSendInvitation}>
              Gửi lời mời ngay
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#203c37]">Lời nhắn gửi kèm (Tùy chọn)</label>
            <textarea
              rows={4}
              placeholder="Ví dụ: Chào Nam, mình thấy bạn cũng tìm phòng quanh Quận 10 và thích không gian yên tĩnh giống mình. Chúng mình có thể hẹn cà phê trao đổi thêm nhé!"
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              className="w-full p-3.5 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
            />
          </div>
          <p className="text-[12px] text-[#74817b]">
            Sau khi {candidate.fullName} đồng ý lời mời, hai bạn có thể bắt đầu nhắn tin trực tiếp và xem số điện thoại liên lạc của nhau trên hệ thống 5K-Rental Manager.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default function RoommateDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-[#74817b]">
          Đang tải thông tin ứng viên...
        </div>
      }
    >
      <RoommateDetailContent />
    </React.Suspense>
  );
}