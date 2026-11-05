"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Search,
  SlidersHorizontal,
  Moon,
  Sun,
  Dog,
  Utensils,
  Sparkles,
  MapPin,
  Check,
  UserPlus,
  ArrowRight,
  Info,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { SuggestedRoommate } from "@/types/models";
import { getCurrentUser } from "@/lib/auth";

/* Legacy design fixture retained only for type inference; candidates are loaded from the matching API.
const LEGACY_CANDIDATES = [
  {
    id: "candidate-1",
    fullName: "Nguyễn Hoàng Nam",
    age: 24,
    gender: "Nam",
    occupation: "Kỹ sư phần mềm • FPT Software",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    matchScore: 96,
    budgetMin: 3500000,
    budgetMax: 5000000,
    preferredDistrict: "Quận 10, Quận 3",
    statusNote: "Đã có phòng Studio 35m² tại Quận 10, tìm 1 bạn nam ở ghép",
    sleepSchedule: "Ngủ sớm (22:30)",
    petAllowed: true,
    cooking: "Thường xuyên nấu ăn",
    cleanliness: 5,
    smoking: false,
    bio: "Mình làm IT, tính tình vui vẻ, ngăn nắp. Buổi tối thường đọc sách hoặc học thêm, không ồn ào. Muốn tìm bạn ghép hợp gu để chia đôi tiền phòng.",
    tags: ["Ngủ sớm", "Thích mèo", "Sạch sẽ 5★", "Nấu ăn ngon", "Không hút thuốc"],
  },
  {
    id: "candidate-2",
    fullName: "Trần Mai Phương",
    age: 22,
    gender: "Nữ",
    occupation: "Sinh viên năm cuối • ĐH Kinh Tế",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
    matchScore: 92,
    budgetMin: 2500000,
    budgetMax: 4000000,
    preferredDistrict: "Bình Thạnh, Phú Nhuận",
    statusNote: "Tìm 1-2 bạn nữ thuê chung căn hộ 2PN quanh Bình Thạnh",
    sleepSchedule: "Ngủ lúc 23:30",
    petAllowed: true,
    cooking: "Cuối tuần tự nấu",
    cleanliness: 5,
    smoking: false,
    bio: "Mình hòa đồng, tôn trọng không gian riêng tư. Thích nhà cửa luôn sạch sẽ, thơm tho. Đã nuôi 1 bé mèo ta rất ngoan và tiêm phòng đầy đủ.",
    tags: ["Thích thú cưng", "Gọn gàng", "Tôn trọng riêng tư", "Không hút thuốc"],
  },
  {
    id: "candidate-3",
    fullName: "Lê Minh Quân",
    age: 26,
    gender: "Nam",
    occupation: "Chuyên viên Marketing • Shopee",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    matchScore: 88,
    budgetMin: 4000000,
    budgetMax: 6000000,
    preferredDistrict: "Quận 1, Quận 4",
    statusNote: "Đang tìm phòng chung cư mini 1PN+1 hoặc 2PN gần trung tâm",
    sleepSchedule: "Cú đêm (sau 0h)",
    petAllowed: false,
    cooking: "Ăn ngoài / Đặt món",
    cleanliness: 4,
    smoking: false,
    bio: "Công việc sáng tạo nên thỉnh thoảng ngủ hơi muộn. Cực kỳ sòng phẳng tài chính, hòa nhã, lịch sự. Thích nghe nhạc qua tai nghe.",
    tags: ["Sòng phẳng", "Lịch sự", "Độc lập", "Không hút thuốc"],
  },
  {
    id: "candidate-4",
    fullName: "Phạm Thu Hà",
    age: 23,
    gender: "Nữ",
    occupation: "Graphic Designer • Freelancer",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&auto=format&fit=crop&q=80",
    matchScore: 85,
    budgetMin: 3000000,
    budgetMax: 4500000,
    preferredDistrict: "Quận 7, Nhà Bè",
    statusNote: "Đã có phòng tại Sunrise City, tìm 1 bạn nữ ở ghép share tiền",
    sleepSchedule: "Linh hoạt",
    petAllowed: true,
    cooking: "Thích làm bánh",
    cleanliness: 5,
    smoking: false,
    bio: "Mình làm việc tại nhà, thích trồng cây và làm bánh ngọt cuối tuần. Phòng đã sắm đủ máy giặt, tủ lạnh, bếp từ.",
    tags: ["Full nội thất", "Thích làm bánh", "Yêu cây cối", "Sạch sẽ"],
  },
]; */
type CandidateShape = {
  id: string; fullName: string; age: number; gender: string; occupation: string; avatarUrl: string;
  matchScore: number; budgetMin: number; budgetMax: number; preferredDistrict: string; statusNote: string;
  sleepSchedule: string; petAllowed: boolean; cooking: string; cleanliness: number; smoking: boolean; bio: string; tags: string[];
};

export default function RoommateDiscoveryPage() {
  const currentUser = getCurrentUser();
  const [searchKeyword, setSearchKeyword] = React.useState("");
  const [districtFilter, setDistrictFilter] = React.useState("ALL");
  const [sleepFilter, setSleepFilter] = React.useState("ALL");
  const [petFilter, setPetFilter] = React.useState("ALL");
  const [budgetFilter, setBudgetFilter] = React.useState("ALL");
  const [activeTab, setActiveTab] = React.useState("best_match");
  const [invitedIds, setInvitedIds] = React.useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);

  // Filter candidates
  const [candidates, setCandidates] = React.useState<CandidateShape[]>([]);

  React.useEffect(() => {
    apiClient.matching.getSuggestions()
      .then((items) => setCandidates(items.map((item) => ({
        id: item.user.id,
        fullName: item.user.fullName,
        age: 0,
        gender: item.user.gender ?? "Chưa cập nhật",
        occupation: item.user.occupation ?? "Chưa cập nhật",
        avatarUrl: item.user.avatarUrl ?? "/images/default-avatar.svg",
        matchScore: item.compatibilityPercent,
        budgetMin: 0,
        budgetMax: item.post.price ?? 0,
        preferredDistrict: item.post.property?.district ?? "Chưa cập nhật",
        statusNote: item.post.title,
        sleepSchedule: "Chưa cập nhật",
        petAllowed: false,
        cooking: "Chưa cập nhật",
        cleanliness: 0,
        smoking: false,
        bio: item.post.description,
        tags: [],
      }))))
      .catch(() => setCandidates([]));
  }, []);

  const filteredCandidates = candidates.filter((candidate) => {
    if (
      searchKeyword &&
      !candidate.fullName.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !candidate.preferredDistrict.toLowerCase().includes(searchKeyword.toLowerCase()) &&
      !candidate.occupation.toLowerCase().includes(searchKeyword.toLowerCase())
    ) {
      return false;
    }
    if (districtFilter !== "ALL" && !candidate.preferredDistrict.includes(districtFilter)) {
      return false;
    }
    if (sleepFilter === "EARLY" && !candidate.sleepSchedule.includes("sớm")) return false;
    if (sleepFilter === "NIGHT" && !candidate.sleepSchedule.includes("Cú đêm")) return false;
    if (petFilter === "YES" && !candidate.petAllowed) return false;
    if (petFilter === "NO" && candidate.petAllowed) return false;
    if (budgetFilter === "UNDER_3M" && candidate.budgetMax > 3500000) return false;
    if (budgetFilter === "3M_5M" && (candidate.budgetMin > 5000000 || candidate.budgetMax < 3000000)) return false;
    return true;
  });

  const handleSendInvite = async (id: string, name: string) => {
    if (invitedIds.includes(id)) return;
    try {
      await apiClient.roommateInvitations.create({ recipientId: id });
      setInvitedIds((prev) => [...prev, id]);
      setFeedbackMessage(`Đã gửi lời mời kết nối thành công tới ${name}!`);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Không thể gửi lời mời.");
    }
  };

  return (
    <div className="w-full bg-[#f7f6f2] min-h-screen py-8">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Toast Alert */}
        {feedbackMessage && (
          <div className="fixed top-24 right-6 z-50 bg-[#15594f] text-white px-5 py-3.5 rounded-[8px] shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top duration-200">
            <Check className="size-5 shrink-0" />
            <span className="text-[14px] font-medium">{feedbackMessage}</span>
          </div>
        )}

        {/* 1. Page Header & Hero Breadcrumb */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
            <Link href="/" className="hover:text-[#15594f] transition-colors">Trang chủ</Link>
            <span>/</span>
            <span className="text-[#203c37] font-medium">Tìm bạn ở ghép</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-[28px] md:text-[34px] font-bold text-[#203c37] tracking-tight">
                Khám phá người ở ghép hợp gu
              </h1>
              <p className="text-[14px] md:text-[15px] text-[#74817b] mt-1 max-w-2xl">
                Thuật toán 5K-Rental Manager kết nối bạn với những người cùng nhịp sống, thói quen sinh hoạt và ngân sách tương thích.
              </p>
            </div>
            <Link href="/tenant/roommate-profile">
              <Button variant="primary" size="md" leftIcon={<Sparkles className="size-4" />}>
                Cập nhật hồ sơ gu sống
              </Button>
            </Link>
          </div>
        </div>

        {/* 2. My Profile Status Widget (Figma 44:63537) */}
        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] shadow-sm overflow-hidden">
          <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative size-[60px] rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border-2 border-[#15594f]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentUser?.avatarUrl || "/images/default-avatar.svg"}
                  alt="Ảnh đại diện của bạn"
                  className="size-full object-cover"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-[16px] font-semibold text-[#203c37]">Hồ sơ gu sống của bạn: {currentUser?.fullName ?? "Chưa cập nhật"}</h3>
                  <Badge variant="success" size="sm">Đang tìm phòng & bạn ghép</Badge>
                </div>
                <p className="text-[13px] text-[#74817b]">
                  Cập nhật hồ sơ để hệ thống tính điểm tương thích dựa trên dữ liệu thực tế.
                </p>
                <div className="w-full max-w-xs bg-[#eaf2ed] h-2 rounded-full overflow-hidden">
                  <div className="bg-[#15594f] h-full rounded-full transition-all duration-300" style={{ width: "0%" }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link href="/tenant/roommate-invitations">
                <Button variant="outline" size="sm">
                  Xem lời mời kết nối
                </Button>
              </Link>
              <Link href="/tenant/roommate-profile">
                <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="size-3.5" />}>
                  Làm khảo sát chi tiết
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* 3. Search and Lifestyle Filter Bar (Figma 44:63547) */}
        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#203c37] uppercase tracking-wider">Từ khóa tìm kiếm</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 size-4 text-[#74817b]" />
                <input
                  type="text"
                  placeholder="Tên, nghề nghiệp, trường học..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full h-[46px] pl-10 pr-3.5 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] focus:bg-white outline-none"
                />
              </div>
            </div>

            {/* District Selector */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#203c37] uppercase tracking-wider">Khu vực mong muốn</label>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full h-[46px] px-3.5 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] focus:bg-white outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả khu vực (TP.HCM)</option>
                <option value="Quận 1">Quận 1</option>
                <option value="Quận 3">Quận 3</option>
                <option value="Quận 10">Quận 10</option>
                <option value="Bình Thạnh">Bình Thạnh</option>
                <option value="Phú Nhuận">Phú Nhuận</option>
                <option value="Quận 7">Quận 7</option>
              </select>
            </div>

            {/* Sleep Schedule */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#203c37] uppercase tracking-wider">Giờ giấc sinh hoạt</label>
              <select
                value={sleepFilter}
                onChange={(e) => setSleepFilter(e.target.value)}
                className="w-full h-[46px] px-3.5 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] focus:bg-white outline-none cursor-pointer"
              >
                <option value="ALL">Mọi khung giờ</option>
                <option value="EARLY">Ngủ sớm (trước 23h)</option>
                <option value="NIGHT">Cú đêm (sau 0h)</option>
              </select>
            </div>

            {/* Budget Range */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold text-[#203c37] uppercase tracking-wider">Ngân sách mỗi người</label>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value)}
                className="w-full h-[46px] px-3.5 bg-[#f7f6f2] border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] focus:border-[#15594f] focus:bg-white outline-none cursor-pointer"
              >
                <option value="ALL">Mọi mức ngân sách</option>
                <option value="UNDER_3M">Dưới 3 triệu / tháng</option>
                <option value="3M_5M">3 - 5 triệu / tháng</option>
              </select>
            </div>
          </div>
        </Card>

        {/* 4. Sorting & Filter Tabs (Figma 44:63563) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e7e1] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab("best_match")}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === "best_match"
                  ? "bg-[#15594f] text-white shadow-sm"
                  : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
              }`}
            >
              Độ tương thích cao nhất
            </button>
            <button
              onClick={() => setActiveTab("has_room")}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === "has_room"
                  ? "bg-[#15594f] text-white shadow-sm"
                  : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
              }`}
            >
              Đã có phòng sẵn
            </button>
            <button
              onClick={() => setActiveTab("looking")}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === "looking"
                  ? "bg-[#15594f] text-white shadow-sm"
                  : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
              }`}
            >
              Tìm bạn thuê chung
            </button>
          </div>

          <div className="text-[13px] text-[#74817b]">
            Tìm thấy <strong className="text-[#203c37]">{filteredCandidates.length}</strong> ứng viên phù hợp
          </div>
        </div>

        {/* 5. Candidates Grid (Figma 44:63573) */}
        {filteredCandidates.length === 0 ? (
          <div className="bg-white border border-[#e2e7e1] rounded-[12px] p-12 text-center space-y-4">
            <div className="size-14 mx-auto rounded-full bg-[#f7f6f2] flex items-center justify-center text-[#74817b]">
              <Users className="size-7" />
            </div>
            <h3 className="text-[18px] font-semibold text-[#203c37]">Không tìm thấy ứng viên phù hợp với bộ lọc</h3>
            <p className="text-[14px] text-[#74817b] max-w-md mx-auto">
              Hãy thử nới lỏng các tiêu chí tìm kiếm về ngân sách hoặc khung giờ sinh hoạt để khám phá thêm nhiều ứng viên.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchKeyword("");
                setDistrictFilter("ALL");
                setSleepFilter("ALL");
                setPetFilter("ALL");
                setBudgetFilter("ALL");
              }}
            >
              Xóa tất cả bộ lọc
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCandidates.map((candidate) => {
              const isInvited = invitedIds.includes(candidate.id);

              return (
                <Card
                  key={candidate.id}
                  className="bg-white border border-[#e2e7e1] rounded-[12px] overflow-hidden shadow-sm hover:shadow-md hover:border-[#15594f]/40 transition-all flex flex-col justify-between"
                >
                  <CardContent className="p-6 space-y-5">
                    {/* Header: Avatar, Name, Match Score */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="relative size-[64px] rounded-full overflow-hidden bg-[#eaf2ed] shrink-0 border border-[#e2e7e1]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={candidate.avatarUrl}
                            alt={candidate.fullName}
                            className="size-full object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="text-[16px] font-bold text-[#203c37] leading-tight">
                            {candidate.fullName}
                          </h4>
                          <p className="text-[13px] text-[#74817b] mt-0.5">{candidate.age} tuổi • {candidate.gender}</p>
                          <p className="text-[12px] text-[#74817b] truncate max-w-[170px]">{candidate.occupation}</p>
                        </div>
                      </div>

                      {/* Compatibility Badge (Figma 44:63577) */}
                      <div className="px-3 py-1.5 rounded-[100px] bg-[#eaf2ed] border border-[#15594f]/20 flex items-center gap-1 shrink-0">
                        <Sparkles className="size-3.5 text-[#15594f]" />
                        <span className="text-[13px] font-bold text-[#15594f]">{candidate.matchScore}%</span>
                      </div>
                    </div>

                    {/* Status Snippet */}
                    <div className="bg-[#f7f6f2] p-3 rounded-[8px] text-[13px] text-[#203c37] font-medium leading-snug">
                      {candidate.statusNote}
                    </div>

                    {/* Budget & Target District */}
                    <div className="grid grid-cols-2 gap-2 text-[13px] border-t border-[#e2e7e1] pt-3">
                      <div>
                        <span className="text-[#74817b] block text-[11px] uppercase font-semibold">Ngân sách</span>
                        <span className="font-semibold text-[#15594f]">
                          {(candidate.budgetMin / 1000000).toFixed(1)} - {(candidate.budgetMax / 1000000).toFixed(1)} tr/tháng
                        </span>
                      </div>
                      <div>
                        <span className="text-[#74817b] block text-[11px] uppercase font-semibold">Khu vực</span>
                        <span className="font-medium text-[#203c37] truncate block">{candidate.preferredDistrict}</span>
                      </div>
                    </div>

                    {/* Lifestyle Tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {candidate.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-[6px] bg-[#f7f6f2] text-[#74817b] text-[11px] font-medium border border-[#e2e7e1]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Bio Snippet */}
                    <p className="text-[13px] text-[#74817b] line-clamp-2 italic">
                      &ldquo;{candidate.bio}&rdquo;
                    </p>
                  </CardContent>

                  {/* Actions (Figma 44:63589, 44:63591) */}
                  <div className="p-6 pt-0 space-y-2 border-t border-[#e2e7e1]/60">
                    <Link href={`/roommates/${candidate.id}`} className="block w-full">
                      <Button variant="outline" size="md" className="w-full">
                        Xem chi tiết & Điểm tương thích
                      </Button>
                    </Link>

                    <Button
                      variant={isInvited ? "secondary" : "primary"}
                      size="md"
                      className="w-full"
                      disabled={isInvited}
                      onClick={() => handleSendInvite(candidate.id, candidate.fullName)}
                      leftIcon={isInvited ? <Check className="size-4" /> : <UserPlus className="size-4" />}
                    >
                      {isInvited ? "Đã gửi lời mời kết nối" : "Gửi lời mời kết nối"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* 6. Security Note Banner (Figma 44:63634) */}
        <div className="bg-[#eaf2ed] border border-[#15594f]/20 rounded-[12px] p-5 flex items-start gap-3.5">
          <Info className="size-5 text-[#15594f] shrink-0 mt-0.5" />
          <div className="text-[13px] text-[#203c37] leading-relaxed">
            <strong className="font-semibold text-[#15594f]">Cam kết an tâm từ 5K-Rental Manager:</strong> Mọi hồ sơ bạn cùng phòng đều được đối soát số điện thoại xác thực. Chúng tôi khuyến nghị bạn trao đổi kỹ về thói quen, lịch sinh hoạt và cùng nhau xem phòng trực tiếp trước khi quyết định ký hợp đồng hoặc chuyển tiền đặt cọc.
          </div>
        </div>
      </div>
    </div>
  );
}