"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  UserPlus,
  MessageCircle,
  Flag,
  ShieldCheck,
  Check,
  Info,
  Calendar,
  DollarSign,
  MapPin,
  ChevronLeft,
  FileText,
  CalendarDays,
  AlertCircle,
  Building2,
  Users,
  Home,
  ClipboardList,
  BedDouble,
  Layers,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { apiClient } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { SuggestedRoommate, User, Contract } from "@/types/models";

function formatSystemRoleLabel(role?: string | null) {
  switch (role) {
    case "ADMIN":
      return "Quản trị viên";
    case "LANDLORD":
      return "Chủ trọ";
    case "STAFF":
      return "Nhân viên";
    case "TENANT":
      return "Người thuê";
    default:
      return role || "Thành viên";
  }
}

function formatGenderLabel(value?: string | null) {
  if (!value) return "Chưa cập nhật";
  const norm = value.toUpperCase();
  if (norm === "MALE" || norm === "NAM") return "Nam";
  if (norm === "FEMALE" || norm === "NỮ") return "Nữ";
  if (norm === "OTHER" || norm === "KHÁC") return "Khác";
  return value;
}

const SLEEP_SCHEDULE_LABELS: Record<string, string> = {
  "22:00": "Ngủ trước 22:00",
  "22:30": "Ngủ 22:00 - 23:00",
  "23:30": "Ngủ 23:00 - 00:00",
  "01:00": "Ngủ sau 00:00",
};

function RoommateDetailContent() {
  const params = useParams();
  const router = useRouter();
  const candidateId = (params?.id as string) || "candidate-1";

  const [currentUser] = React.useState<User | null>(() => {
    if (typeof window !== "undefined") {
      return getCurrentUser();
    }
    return null;
  });
  const [myRooms, setMyRooms] = React.useState<Array<{ roomId: string; label: string; roomNumber: string; propertyName: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = React.useState<string>("");

  const [inviteModalOpen, setInviteModalOpen] = React.useState(false);
  const [inviteNote, setInviteNote] = React.useState("");
  const [isSent, setIsSent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);

  const [suggestion, setSuggestion] = React.useState<SuggestedRoommate | null>(null);

  React.useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      apiClient.contracts.getMyContracts("tenant")
        .then((contracts: Contract[]) => {
          const seen = new Set<string>();
          const rooms = contracts
            .filter((contract) => contract.status === "ACTIVE" && contract.room?.id)
            .flatMap((contract) => {
              const room = contract.room!;
              if (seen.has(room.id)) return [];
              seen.add(room.id);
              return [{
                roomId: room.id,
                roomNumber: room.roomNumber,
                propertyName: room.property?.name ?? "Nhà trọ",
                label: `${room.property?.name ?? "Nhà trọ"} · Phòng ${room.roomNumber}`,
              }];
            });
          setMyRooms(rooms);
          if (rooms.length > 0) {
            setSelectedRoomId(rooms[0].roomId);
          }
        })
        .catch(() => setMyRooms([]));
    }
  }, []);

  React.useEffect(() => {
    apiClient.matching.getRoommateProfile(candidateId)
      .then((item) => setSuggestion(item))
      .catch(() => {
        apiClient.matching.getSuggestions()
          .then((items) => setSuggestion(items.find((item) => item.user.id === candidateId) ?? null))
          .catch(() => setSuggestion(null));
      });
  }, [candidateId]);

  const candidate = suggestion ? {
    id: suggestion.user.id,
    fullName: suggestion.user.fullName,
    role: suggestion.user.role,
    age: suggestion.user.age ?? 0,
    gender: formatGenderLabel(suggestion.user.gender),
    occupation: suggestion.user.occupation ?? "Chưa cập nhật",
    avatarUrl: suggestion.user.avatarUrl ?? "/images/default-avatar.svg",
    matchScore: suggestion.compatibilityPercent,
    postId: suggestion.post.id,
    postRoomId: suggestion.post.room?.id ?? null,
    postRoomNumber: suggestion.post.room?.roomNumber ?? null,
    postPropertyName: suggestion.post.property?.name ?? null,
    postTitle: suggestion.post.title,
    postDescription: suggestion.post.description,
    postCreatedAt: suggestion.post.createdAt,
    postMaxOccupants: suggestion.post.room?.maxOccupants ?? null,
    postExpiredAt: suggestion.post.expiredAt ?? null,
    hasRoom: Boolean(suggestion.post.room || suggestion.preference?.hasRoom),
    roomDetail: suggestion.post.room ?? null,
    propertyDetail: suggestion.post.property ?? null,
    postImages: suggestion.post.images ?? [],
    occupants: suggestion.post.room?.occupants ?? [],
    lifestyleAnswers: suggestion.lifestyleAnswers ?? [],
    preference: suggestion.preference ?? null,
    statusNote: suggestion.post.title,
    budgetMonthly: suggestion.post.price ? `${formatCurrency(suggestion.post.price, { showUnit: false })} đ/tháng` : "Thương lượng",
    targetLocation: suggestion.location?.district
      ?? suggestion.location?.province
      ?? suggestion.preference?.currentDistrict
      ?? suggestion.preference?.preferredDistrict
      ?? "Chưa cập nhật",
    moveInDate: suggestion.preference?.moveInDate
      ? new Date(suggestion.preference.moveInDate).toLocaleDateString("vi-VN")
      : "Chưa cập nhật",
    bio: suggestion.user.bio || "Người dùng chưa cập nhật giới thiệu.",
  } : {
    id: candidateId, fullName: "Đang tải hồ sơ", role: "TENANT", age: 0, gender: "Chưa cập nhật",
    occupation: "Chưa cập nhật", avatarUrl: "/images/default-avatar.svg", matchScore: 0,
    postId: "", postRoomId: null, postRoomNumber: null, postPropertyName: null, postTitle: "Chưa có dữ liệu bài đăng", postDescription: "",
    postCreatedAt: null, postMaxOccupants: null, postExpiredAt: null, hasRoom: false,
    roomDetail: null, propertyDetail: null, postImages: [], occupants: [], lifestyleAnswers: [], preference: null,
    statusNote: "Chưa có dữ liệu hồ sơ", budgetMonthly: "Chưa cập nhật",
    targetLocation: "Chưa cập nhật", moveInDate: "Chưa cập nhật", bio: "",
  };

  const fullRoomAddress = [
    candidate.propertyDetail?.address ?? candidate.preference?.currentAddress,
    candidate.propertyDetail?.ward ?? candidate.preference?.currentWard,
    candidate.propertyDetail?.district ?? candidate.preference?.currentDistrict,
    candidate.propertyDetail?.province ?? candidate.preference?.currentProvince,
  ]
    .filter(Boolean)
    .join(", ");

  const isOwnPost = Boolean(currentUser && currentUser.id === candidate.id);

  const handleSendInvitation = async () => {
    const isPostWithoutRoom = !candidate.postRoomId;
    if (isPostWithoutRoom) {
      if (currentUser?.role === "LANDLORD") {
        setInviteError(
          "Tài khoản chủ trọ không được phép đứng tên chủ hợp đồng trong hợp đồng ở ghép. Bạn chỉ có thể gửi lời mời kết nối với các tin đăng đã có phòng sẵn."
        );
        return;
      }
      if (myRooms.length === 0) {
        setInviteError(
          "Tin đăng này chưa có phòng. Bạn bắt buộc phải có hợp đồng thuê phòng đang hiệu lực và chọn phòng để gửi lời mời."
        );
        return;
      }
      if (!selectedRoomId) {
        setInviteError("Vui lòng chọn phòng đang thuê của bạn.");
        return;
      }
    }

    setIsSubmitting(true);
    setInviteError(null);
    try {
      await apiClient.roommateInvitations.create({
        recipientId: candidate.id,
        message: inviteNote.trim() || undefined,
        ...(candidate.postId ? { postId: candidate.postId } : {}),
        roomId: isPostWithoutRoom ? selectedRoomId : candidate.postRoomId || undefined,
      });
      setIsSent(true);
      setInviteModalOpen(false);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Không thể gửi lời mời.");
    } finally {
      setIsSubmitting(false);
    }
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
                  <Avatar
                    src={candidate.avatarUrl}
                    alt={candidate.fullName}
                    className="size-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h2 className="text-[22px] font-bold text-[#203c37] leading-tight">{candidate.fullName}</h2>
                    <Badge variant="neutral" size="sm">{formatSystemRoleLabel(candidate.role)}</Badge>
                  </div>
                  <p className="text-[14px] text-[#74817b] mt-1">
                    {candidate.age > 0 ? `${candidate.age} tuổi • ` : ""}Giới tính: {candidate.gender}
                  </p>
                  <p className="text-[13px] font-medium text-[#15594f] mt-0.5">{candidate.occupation}</p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaf2ed] text-[#15594f] text-[12px] font-semibold">
                    <ShieldCheck className="size-4" />
                    Đã xác minh qua 5K-Rental
                  </div>
                  <Link
                    href={`/users/${candidate.id}`}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#15594f] hover:underline"
                  >
                    Hồ sơ công khai <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Bài đăng của người này */}
              <div className="space-y-2.5 rounded-[10px] border border-[#d2e4d7] bg-[#f7faf8] p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#15594f]">
                      <FileText className="size-3.5" /> Bài đăng ở ghép
                    </span>
                    {candidate.hasRoom ? (
                      <Badge variant="success" size="sm">Đã có phòng</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">Chưa có phòng</Badge>
                    )}
                  </div>
                  {candidate.postExpiredAt && (
                    <span className="flex items-center gap-1 text-[10px] text-[#74817b]">
                      <CalendarDays className="size-3" />
                      Hạn {new Date(candidate.postExpiredAt).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-bold leading-snug text-[#203c37]">{candidate.postTitle}</p>
                <p className="text-[13px] leading-relaxed text-[#5d6b65] whitespace-pre-line">{candidate.postDescription}</p>
                {candidate.postCreatedAt && (
                  <p className="text-[11px] text-[#74817b]">
                    Đăng ngày: {new Date(candidate.postCreatedAt).toLocaleDateString("vi-VN")}
                  </p>
                )}
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
                  <span className="font-semibold text-[#203c37] text-right">{candidate.targetLocation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#74817b] flex items-center gap-2">
                    <Calendar className="size-4 text-[#15594f]" /> Ngày dọn vào
                  </span>
                  <span className="font-semibold text-[#203c37]">{candidate.moveInDate}</span>
                </div>
                {candidate.preference?.sleepSchedule && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#74817b]">Giờ giấc sinh hoạt</span>
                    <span className="font-semibold text-[#203c37]">
                      {SLEEP_SCHEDULE_LABELS[candidate.preference.sleepSchedule] ?? candidate.preference.sleepSchedule}
                    </span>
                  </div>
                )}
                {candidate.preference?.roommateSlots && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#74817b]">Số bạn ghép cần tìm</span>
                    <span className="font-semibold text-[#203c37]">{candidate.preference.roommateSlots} người</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div className="border-t border-[#e2e7e1] pt-4 space-y-1.5">
                <span className="text-[12px] font-semibold text-[#74817b] uppercase tracking-wider">Giới thiệu bản thân</span>
                <p className="text-[13px] text-[#203c37] leading-relaxed italic">
                  &ldquo;{candidate.bio}&rdquo;
                </p>
              </div>

              {/* Action Buttons (Figma 44:63849, 44:63852, 44:63854) */}
              {!isOwnPost && (
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
                    onClick={async () => {
                      const conversation = await apiClient.chats.getOrCreateConversationWithUser(candidate.id);
                      router.push(`/tenant/messages?conversation=${conversation.id}`);
                    }}
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
              )}
            </Card>

            {/* Safety Tip Box (Figma 44:63857) */}
            <div className="bg-[#f2ede3] border border-[#e2e7e1] rounded-[12px] p-4 text-[12px] text-[#203c37] flex items-start gap-3">
              <Info className="size-4 text-[#15594f] shrink-0 mt-0.5" />
              <p>
                <strong>Lời khuyên an toàn:</strong> Tuyệt đối không chuyển khoản đặt cọc khi chưa gặp mặt trực tiếp hoặc chưa xem phòng thực tế.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Room Info, Current Occupants, Survey Answers */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Overall Score Banner */}
            <Card className="border border-[#e2e7e1] bg-gradient-to-r from-[#eaf2ed] to-white rounded-[12px] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-6">
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

                <div className="space-y-1.5 text-center sm:text-left">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#15594f] text-white text-[11px] font-semibold uppercase">
                    Điểm tương thích
                  </span>
                  <h3 className="text-[20px] font-bold text-[#203c37]">Mức độ phù hợp được tính từ dữ liệu hiện có</h3>
                  <p className="text-[14px] text-[#74817b] leading-relaxed">
                    Điểm số và thông tin bên dưới được tổng hợp từ hồ sơ cá nhân, phòng trọ gắn kèm và bài khảo sát lối sống.
                  </p>
                </div>
              </div>
            </Card>

            {/* 2. Thông tin phòng trọ (nếu đã gắn phòng) */}
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-[8px] bg-[#eaf2ed] flex items-center justify-center text-[#15594f]">
                    <Home className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold text-[#203c37]">Thông tin phòng trọ</h3>
                    <p className="text-[12px] text-[#74817b]">
                      Chi tiết phòng trọ gắn với bài đăng tìm người ở ghép
                    </p>
                  </div>
                </div>
                {candidate.hasRoom ? (
                  <Badge variant="success" size="md">Đã có phòng</Badge>
                ) : (
                  <Badge variant="warning" size="md">Chưa có phòng</Badge>
                )}
              </div>

              {candidate.hasRoom ? (
                <div className="space-y-4">
                  <div className="rounded-[10px] border border-[#d2e4d7] bg-[#f7faf8] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h4 className="text-[16px] font-bold text-[#203c37] flex items-center gap-2">
                          <Building2 className="size-4 text-[#15594f]" />
                          {candidate.propertyDetail?.name || "Phòng trọ"}
                          {candidate.roomDetail?.roomNumber ? ` · Phòng ${candidate.roomDetail.roomNumber}` : ""}
                        </h4>
                        {fullRoomAddress && (
                          <p className="text-[13px] text-[#5d6b65] mt-1 flex items-start gap-1.5">
                            <MapPin className="size-4 text-[#15594f] shrink-0 mt-0.5" />
                            <span>{fullRoomAddress}</span>
                          </p>
                        )}
                      </div>
                      {candidate.postRoomId && (
                        <Link href={`/rooms/${candidate.postRoomId}`} target="_blank">
                          <Button variant="outline" size="sm" rightIcon={<ExternalLink className="size-3.5" />}>
                            Xem chi tiết phòng
                          </Button>
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[#d2e4d7]/70 text-[13px]">
                      {candidate.propertyDetail?.landlord?.fullName && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block">Người cho thuê / Chủ trọ</span>
                          <strong className="text-[#203c37]">{candidate.propertyDetail.landlord.fullName}</strong>
                        </div>
                      )}
                      {(candidate.roomDetail?.priceMonthly ?? candidate.preference?.currentRent) != null && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block">Giá thuê phòng</span>
                          <strong className="text-[#15594f]">
                            {formatCurrency(candidate.roomDetail?.priceMonthly ?? candidate.preference?.currentRent ?? 0)}/tháng
                          </strong>
                        </div>
                      )}
                      {candidate.roomDetail?.depositAmount != null && candidate.roomDetail.depositAmount > 0 && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block">Tiền cọc</span>
                          <strong className="text-[#203c37]">{formatCurrency(candidate.roomDetail.depositAmount)}</strong>
                        </div>
                      )}
                      {(candidate.roomDetail?.area ?? candidate.preference?.currentArea) != null && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block">Diện tích</span>
                          <strong className="text-[#203c37]">{candidate.roomDetail?.area ?? candidate.preference?.currentArea} m²</strong>
                        </div>
                      )}
                      <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                        <span className="text-[11px] text-[#74817b] block">Số người ở</span>
                        <strong className="text-[#203c37]">
                          {candidate.roomDetail
                            ? `${candidate.roomDetail.currentOccupants ?? candidate.occupants.length}/${candidate.roomDetail.maxOccupants} người`
                            : candidate.preference?.currentOccupants
                              ? `Hiện có ${candidate.preference.currentOccupants} người`
                              : "Đang cập nhật"}
                        </strong>
                      </div>
                      {candidate.roomDetail?.floor != null && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block flex items-center gap-1">
                            <Layers className="size-3" /> Tầng
                          </span>
                          <strong className="text-[#203c37]">Tầng {candidate.roomDetail.floor}</strong>
                        </div>
                      )}
                      {candidate.roomDetail?.bedType && (
                        <div className="bg-white rounded-[8px] p-2.5 border border-[#e2e7e1]">
                          <span className="text-[11px] text-[#74817b] block flex items-center gap-1">
                            <BedDouble className="size-3" /> Loại giường
                          </span>
                          <strong className="text-[#203c37]">{candidate.roomDetail.bedType}</strong>
                        </div>
                      )}
                    </div>

                    {candidate.roomDetail?.amenities && candidate.roomDetail.amenities.length > 0 && (
                      <div className="pt-2 border-t border-[#d2e4d7]/70">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#74817b] block mb-2">
                          Tiện ích phòng
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.roomDetail.amenities.map((am) => (
                            <span
                              key={am.id}
                              className="px-2.5 py-1 rounded-[6px] bg-white border border-[#e2e7e1] text-[12px] text-[#203c37]"
                            >
                              {am.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {candidate.postImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {candidate.postImages.slice(0, 6).map((img) => (
                        <div key={img.id} className="aspect-[4/3] rounded-[8px] overflow-hidden border border-[#e2e7e1] bg-[#f7f6f2]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.imageUrl} alt="Ảnh phòng trọ" className="size-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[10px] border border-[#f0d9a8] bg-[#fffaf0] p-4 text-[13px] text-[#8a5700]">
                  Người đăng hiện <strong>chưa có phòng trọ sẵn</strong> và đang tìm bạn đồng hành để cùng thuê phòng mới hoặc ghép vào phòng phù hợp.
                </div>
              )}
            </Card>

            {/* 3. Danh sách người đang ở / người ở ghép trong phòng (nếu có) */}
            {candidate.postRoomId && (
              <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-[8px] bg-[#eaf2ed] flex items-center justify-center text-[#15594f]">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#203c37]">Người đang ở trong phòng</h3>
                      <p className="text-[12px] text-[#74817b]">
                        Danh sách thành viên hiện tại và vai trò trong phòng trọ
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {candidate.occupants.length} thành viên
                  </Badge>
                </div>

                {candidate.occupants.length === 0 ? (
                  <p className="text-[13px] text-[#74817b]">
                    Chưa ghi nhận danh sách người ở ghép công khai trong phòng này.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {candidate.occupants.map((occ) => (
                      <div
                        key={occ.id}
                        className="flex items-start gap-3 p-3.5 rounded-[10px] border border-[#e2e7e1] bg-[#f7faf8]"
                      >
                        <div className="size-12 rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#d2e4d7]">
                          <Avatar
                            src={occ.avatarUrl || "/images/default-avatar.svg"}
                            alt={occ.fullName}
                            className="size-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              href={`/users/${occ.id}`}
                              className="text-[14px] font-bold text-[#203c37] hover:text-[#15594f] hover:underline truncate"
                            >
                              {occ.fullName}
                            </Link>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant={occ.isPrimary ? "success" : "info"} size="sm">
                              {occ.isPrimary ? "Chủ hợp đồng" : "Người ở ghép"}
                            </Badge>
                            <Badge variant="neutral" size="sm">
                              {formatSystemRoleLabel(occ.systemRole)}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-[#5d6b65]">
                            {[
                              occ.age && occ.age > 0 ? `${occ.age} tuổi` : null,
                              occ.gender ? formatGenderLabel(occ.gender) : null,
                              occ.occupation || null,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "Thành viên phòng"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* 4. Đáp án bài khảo sát lối sống của người đăng */}
            <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-[8px] bg-[#eaf2ed] flex items-center justify-center text-[#15594f]">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-[#203c37]">Đáp án khảo sát lối sống của người đăng</h3>
                  <p className="text-[13px] text-[#74817b] mt-0.5">
                    Các thói quen sinh hoạt được {candidate.fullName} lựa chọn khi làm khảo sát.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {candidate.lifestyleAnswers.length === 0 ? (
                  <p className="text-sm text-[#74817b]">Người đăng chưa hoàn thành bài khảo sát lối sống.</p>
                ) : (
                  candidate.lifestyleAnswers.map((ans) => {
                    const hasMyAnswer = ans.myScoreValue !== null && ans.myScoreValue !== undefined;
                    const diff = hasMyAnswer ? Math.abs((ans.myScoreValue ?? 0) - ans.scoreValue) : null;
                    const itemScore = diff === 0 ? 100 : diff === 1 ? 50 : diff !== null ? 0 : null;

                    return (
                      <div key={ans.questionId} className="space-y-2.5 border-b border-[#e2e7e1]/60 pb-4 last:border-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#f7f6f2] text-[#74817b] border border-[#e2e7e1]">
                              {ans.category}
                            </span>
                            <p className="text-[14px] font-semibold text-[#203c37]">{ans.questionText}</p>
                          </div>
                          {itemScore !== null && (
                            <span className="text-[13px] font-bold text-[#15594f] shrink-0">
                              Hợp {itemScore}%
                            </span>
                          )}
                        </div>

                        <div className={`grid grid-cols-1 ${ans.myOptionText ? "sm:grid-cols-2" : ""} gap-2 text-[12px]`}>
                          <div className="bg-[#eaf2ed] px-3 py-2 rounded-[6px] border border-[#d2e4d7]">
                            <span className="text-[#15594f] block font-medium">Lựa chọn của {candidate.fullName}:</span>
                            <strong className="text-[#203c37]">{ans.optionText}</strong>
                          </div>
                          {ans.myOptionText && (
                            <div className="bg-[#f7f6f2] px-3 py-2 rounded-[6px] border border-[#e2e7e1]">
                              <span className="text-[#74817b] block font-medium">Lựa chọn của bạn:</span>
                              <strong className="text-[#203c37]">{ans.myOptionText}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
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
        description={`Bạn đang gửi lời mời kết nối tới ${candidate.fullName}.`}
        size="md"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setInviteModalOpen(false)}>
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={Boolean(
                !candidate.postRoomId && (currentUser?.role === "LANDLORD" || myRooms.length === 0 || !selectedRoomId)
              )}
              onClick={handleSendInvitation}
            >
              Gửi lời mời ngay
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {inviteError && (
            <div className="rounded-[8px] border border-[#f1c9bf] bg-[#fbeae6] px-3.5 py-2.5 text-sm text-[#a4422c] flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {!candidate.postRoomId ? (
            // Tin đăng chưa có phòng: Bắt buộc người gửi phải có phòng và chọn phòng
            <div className="space-y-3">
              <div className="p-3 bg-[#fff4e5] border border-[#f0d9a8] rounded-[8px] text-[12px] text-[#8a5700]">
                <strong>Tin đăng chưa có phòng:</strong> Người đăng đang tìm phòng để ở ghép. Bạn bắt buộc phải chọn một phòng đang thuê của mình để mời họ vào ở cùng.
              </div>

              {currentUser?.role === "LANDLORD" ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[8px] text-[13px] text-red-700">
                  Chủ trọ không được phép đứng tên làm chủ hợp đồng đại diện trong hợp đồng ở ghép. Bạn không thể gửi lời mời cho tin đăng chưa có phòng.
                </div>
              ) : myRooms.length === 0 ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[8px] text-[13px] text-red-700">
                  Bạn hiện chưa có hợp đồng thuê phòng nào đang có hiệu lực. Bạn cần có phòng đang thuê để mời người này ở ghép.
                </div>
              ) : (
                <div>
                  <label className="block text-[13px] font-semibold text-[#203c37] mb-1.5">
                    Chọn phòng của bạn để mời ở ghép <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full h-11 rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-sm font-medium text-[#203c37] outline-none focus:border-[#15594f]"
                  >
                    <option value="">-- Chọn phòng --</option>
                    {myRooms.map((room) => (
                      <option key={room.roomId} value={room.roomId}>
                        {room.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            // Tin đăng đã có sẵn phòng
            <div className="p-3 bg-[#eaf2ed] border border-[#b2d3c2] rounded-[8px] text-[12px] text-[#15594f]">
              <strong>Tin đăng đã có phòng:</strong> Bạn đang gửi lời mời xin ở ghép vào phòng của {candidate.fullName} ({candidate.postPropertyName || "Nhà trọ"} · Phòng {candidate.postRoomNumber}).
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-[#203c37]">Lời nhắn gửi kèm (Tùy chọn)</label>
            <textarea
              rows={3}
              placeholder="Ví dụ: Chào Nam, mình thấy bạn cũng tìm phòng quanh Quận 10 và thích không gian yên tĩnh giống mình..."
              value={inviteNote}
              onChange={(e) => setInviteNote(e.target.value)}
              className="w-full p-3 bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] outline-none resize-none"
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