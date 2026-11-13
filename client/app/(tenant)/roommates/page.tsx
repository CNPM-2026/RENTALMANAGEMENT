"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Sparkles,
  Check,
  UserPlus,
  ArrowRight,
  Info,
  Filter,
  RotateCcw,
  Loader2,
  MapPin,
  Wallet,
  CalendarDays,
  Building2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { Contract, Post, RoommatePostFilters, RoommatePostItem, User } from "@/types/models";
import { Avatar } from "@/components/ui/avatar";

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
  id: string;
  postId: string;
  fullName: string;
  age: number;
  gender: string;
  occupation: string;
  avatarUrl: string;
  matchScore: number;
  budgetMin: number;
  budgetMax: number;
  preferredDistrict: string;
  statusNote: string;
  postTitle: string;
  postDescription: string;
  postCreatedAt: string;
  postExpiredAt: string | null;
  propertyName: string | null;
  roomNumber: string | null;
  maxOccupants: number | null;
  sleepSchedule: string;
  petAllowed: boolean | null;
  smokingAllowed: boolean | null;
  cleanliness: number;
  hasRoom: boolean;
  bio: string;
  tags: string[];
  createdAt: string;
};

type RoommateFilterState = {
  keyword: string;
  province: string;
  district: string;
  minPrice: string;
  maxPrice: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER";
  hasRoom: "" | "true" | "false";
  sleepSchedule: string;
  smokingAllowed: "" | "true" | "false";
  petAllowed: "" | "true" | "false";
  minCleanliness: string;
  sortBy: "best_match" | "newest" | "price_asc" | "price_desc";
};

const DEFAULT_FILTERS: RoommateFilterState = {
  keyword: "",
  province: "",
  district: "",
  minPrice: "",
  maxPrice: "",
  gender: "",
  hasRoom: "",
  sleepSchedule: "",
  smokingAllowed: "",
  petAllowed: "",
  minCleanliness: "",
  sortBy: "best_match",
};

const SLEEP_SCHEDULE_LABELS: Record<string, string> = {
  "22:00": "Ngủ trước 22:00",
  "22:30": "Ngủ 22:00 - 23:00",
  "23:30": "Ngủ 23:00 - 00:00",
  "01:00": "Ngủ sau 00:00",
};

const ROOMMATE_POST_STATUS_META: Record<string, { label: string; description: string; className: string }> = {
  PENDING: {
    label: "Chờ duyệt",
    description: "Tin đang chờ quản trị viên kiểm duyệt. Bạn sẽ nhận thông báo khi tin được duyệt.",
    className: "border-[#f0d9a8] bg-[#fff4e5] text-[#8a5700]",
  },
  APPROVED: {
    label: "Đã duyệt",
    description: "Tin đã được duyệt và hiển thị công khai với những người đang tìm bạn ở ghép.",
    className: "border-[#b2d3c2] bg-[#eaf2ed] text-[#15594f]",
  },
  REJECTED: {
    label: "Bị từ chối",
    description: "Tin chưa được duyệt. Vui lòng cập nhật nội dung hoặc liên hệ bộ phận hỗ trợ.",
    className: "border-[#efc6bb] bg-[#fbeae6] text-[#a4422c]",
  },
  CLOSED: {
    label: "Đã đóng",
    description: "Tin đã đóng và không còn hiển thị với người tìm bạn ở ghép.",
    className: "border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b]",
  },
};

function formatSleepSchedule(value: string | null | undefined) {
  if (!value) return "Chưa cập nhật";
  return SLEEP_SCHEDULE_LABELS[value] ?? value;
}

function formatGender(value: string | null | undefined) {
  if (!value) return "Chưa cập nhật";
  const normalized = value.toUpperCase();
  if (normalized === "MALE" || normalized === "NAM") return "Nam";
  if (normalized === "FEMALE" || normalized === "NỮ") return "Nữ";
  if (normalized === "OTHER" || normalized === "KHÁC") return "Khác";
  return value;
}

function formatBudget(min: number, max: number) {
  const toMillion = (value: number) =>
    `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (min <= 0 && max <= 0) return "Thương lượng";
  if (min > 0 && max > 0 && min !== max) return `${toMillion(min)} - ${toMillion(max)}/tháng`;
  return `${toMillion(max > 0 ? max : min)}/tháng`;
}

function mapRoommatePost(item: RoommatePostItem): CandidateShape {
  const preference = item.preference;
  const price = item.post.price ?? 0;
  const preferenceBudgetMin = preference?.budgetMin ?? null;
  const preferenceBudgetMax = preference?.budgetMax ?? null;
  const hasFullPreferenceBudget = preferenceBudgetMin !== null && preferenceBudgetMax !== null;
  const budgetMin = hasFullPreferenceBudget ? preferenceBudgetMin : price;
  const budgetMax = hasFullPreferenceBudget ? preferenceBudgetMax : price;
  const locationParts = [item.location?.district, item.location?.province].filter(Boolean);
  const tags: string[] = [];
  if (preference?.hasRoom) tags.push("Đã có phòng");
  if (preference?.sleepSchedule) tags.push(formatSleepSchedule(preference.sleepSchedule));
  if (preference?.smokingAllowed === false) tags.push("Không hút thuốc");
  if (preference?.petAllowed) tags.push("Cho phép thú cưng");
  if (preference?.cleanlinessLevel) tags.push(`Sạch sẽ ${preference.cleanlinessLevel}★`);
  if (preference?.roommateSlots) tags.push(`Cần ${preference.roommateSlots} người`);

  return {
    id: item.user.id,
    postId: item.post.id,
    fullName: item.user.fullName,
    age: item.user.age ?? 0,
    gender: formatGender(item.user.gender),
    occupation: item.user.occupation ?? "Chưa cập nhật nghề nghiệp",
    avatarUrl: item.user.avatarUrl ?? "/images/default-avatar.svg",
    matchScore: item.compatibilityPercent,
    budgetMin,
    budgetMax,
    preferredDistrict: locationParts.length > 0
      ? locationParts.join(", ")
      : preference?.preferredDistrict ?? "Chưa cập nhật",
    statusNote: item.post.title,
    postTitle: item.post.title,
    postDescription: item.post.description,
    postCreatedAt: item.post.createdAt,
    postExpiredAt: item.post.expiredAt ?? null,
    propertyName: item.post.property?.name ?? null,
    roomNumber: item.post.room?.roomNumber ?? null,
    maxOccupants: item.post.room?.maxOccupants ?? null,
    sleepSchedule: formatSleepSchedule(preference?.sleepSchedule),
    petAllowed: preference?.petAllowed ?? null,
    smokingAllowed: preference?.smokingAllowed ?? null,
    cleanliness: preference?.cleanlinessLevel ?? 0,
    hasRoom: Boolean(preference?.hasRoom || item.post.room),
    bio: item.user.bio || "Người đăng chưa cập nhật giới thiệu.",
    tags,
    createdAt: item.post.createdAt,
  };
}

function formatPostedDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export default function RoommateDiscoveryPage() {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [filters, setFilters] = React.useState<RoommateFilterState>(DEFAULT_FILTERS);
  const [invitedIds, setInvitedIds] = React.useState<string[]>([]);
  const [feedbackMessage, setFeedbackMessage] = React.useState<string | null>(null);
  const [isPostFormOpen, setIsPostFormOpen] = React.useState(false);
  const [isPosting, setIsPosting] = React.useState(false);
  const [postError, setPostError] = React.useState<string | null>(null);
  const [postForm, setPostForm] = React.useState({
    title: "",
    description: "",
    price: "",
    roomId: "",
    expiredAt: "",
  });
  const [expiryMinDate, setExpiryMinDate] = React.useState("");
  const [expiryMaxDate, setExpiryMaxDate] = React.useState("");
  const [myRooms, setMyRooms] = React.useState<Array<{
    roomId: string;
    label: string;
    roomNumber: string;
    propertyName: string;
  }>>([]);
  const [profileReady, setProfileReady] = React.useState<boolean | null>(null);
  const [myRoommatePost, setMyRoommatePost] = React.useState<Post | null>(null);
  const [myPostVersion, setMyPostVersion] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [candidates, setCandidates] = React.useState<CandidateShape[]>([]);

  React.useEffect(() => {
    // Chỉ lấy danh tính từ localStorage — thao tác này không đọc thời gian hệ
    // thống, nên an toàn khi Next prerender Client Component.
    const frame = window.requestAnimationFrame(() => {
      setCurrentUser(getCurrentUser());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    if (!currentUser) {
      const frame = window.requestAnimationFrame(() => setMyRoommatePost(null));
      return () => window.cancelAnimationFrame(frame);
    }

    let cancelled = false;
    void apiClient.posts.getMyPosts()
      .then((posts) => {
        if (cancelled) return;
        setMyRoommatePost(posts.find((post) => post.postType === "FIND_ROOMMATE") ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyRoommatePost(null);
      });

    void apiClient.contracts.getMyContracts()
      .then((contracts: Contract[]) => {
        if (cancelled) return;
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
        setPostForm((form) => ({
          ...form,
          roomId: form.roomId || rooms[0]?.roomId || "",
        }));
      })
      .catch(() => {
        if (!cancelled) setMyRooms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, myPostVersion]);

  const loadRoommates = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const viewer = getCurrentUser();
    const query: RoommatePostFilters = {
      ...(filters.keyword.trim() && { keyword: filters.keyword.trim() }),
      ...(filters.province.trim() && { province: filters.province.trim() }),
      ...(filters.district.trim() && { district: filters.district.trim() }),
      ...(filters.minPrice && { minPrice: Number(filters.minPrice) }),
      ...(filters.maxPrice && { maxPrice: Number(filters.maxPrice) }),
      ...(filters.gender && { gender: filters.gender }),
      ...(filters.hasRoom && { hasRoom: filters.hasRoom === "true" }),
      ...(filters.sleepSchedule && { sleepSchedule: filters.sleepSchedule }),
      ...(filters.smokingAllowed && { smokingAllowed: filters.smokingAllowed === "true" }),
      ...(filters.petAllowed && { petAllowed: filters.petAllowed === "true" }),
      ...(filters.minCleanliness && { minCleanliness: Number(filters.minCleanliness) }),
      sortBy: filters.sortBy,
    };

    try {
      const items = await apiClient.matching.getRoommatePosts(query);
      setCandidates(items.map(mapRoommatePost));
      if (viewer) {
        void apiClient.matching.getPreferences()
          .then((preferences) => setProfileReady(Boolean(preferences)))
          .catch(() => setProfileReady(null));
      } else {
        setProfileReady(null);
      }
    } catch (error) {
      setCandidates([]);
      setLoadError(error instanceof Error ? error.message : "Không thể tải danh sách bạn ở ghép.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRoommates();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRoommates]);

  const handleCreateRoommatePost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPosting) return;
    if (postForm.description.trim().length < 10) {
      setPostError("Mô tả nhu cầu phải có ít nhất 10 ký tự.");
      return;
    }
    const today = getLocalDateString();
    if (postForm.expiredAt && postForm.expiredAt <= today) {
      setPostError("Hạn đăng tin phải sau ngày hiện tại.");
      return;
    }
    if (postForm.expiredAt && postForm.expiredAt > getDateAfterDays(180)) {
      setPostError("Hạn đăng tin không được vượt quá 180 ngày.");
      return;
    }

    setIsPosting(true);
    setPostError(null);
    try {
      await apiClient.posts.create({
        title: postForm.title.trim(),
        description: postForm.description.trim(),
        postType: "FIND_ROOMMATE",
        ...(postForm.price ? { price: Number(postForm.price) } : {}),
        ...(postForm.roomId ? { roomId: postForm.roomId } : {}),
        ...(postForm.expiredAt
          ? { expiredAt: new Date(`${postForm.expiredAt}T23:59:59`).toISOString() }
          : {}),
      });
      setPostForm((form) => ({
        title: "",
        description: "",
        price: "",
        roomId: form.roomId,
        expiredAt: getDateAfterDays(30),
      }));
      setIsPostFormOpen(false);
      setFeedbackMessage("Đã đăng nhu cầu tìm bạn ở ghép. Tin sẽ hiển thị sau khi được duyệt.");
      setTimeout(() => setFeedbackMessage(null), 5000);
      setMyPostVersion((version) => version + 1);
      loadRoommates();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Không thể đăng nhu cầu ở ghép.");
    } finally {
      setIsPosting(false);
    }
  };

  const activeTab = filters.hasRoom === "true"
    ? "has_room"
    : filters.hasRoom === "false"
      ? "looking"
      : "best_match";

  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key === "sortBy" ? value !== "best_match" : Boolean(value)
  );

  const myPostMeta = myRoommatePost
    ? ROOMMATE_POST_STATUS_META[myRoommatePost.status] ?? ROOMMATE_POST_STATUS_META.PENDING
    : null;

  const updateFilter = <K extends keyof RoommateFilterState>(
    key: K,
    value: RoommateFilterState[K],
  ) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  /**
   * Mở form đăng tin. Các mốc ngày chỉ được tính TẠI ĐÂY (event handler), không
   * tính trong render/effect — Next 16 coi `new Date()` lúc prerender là lỗi
   * "Blocking Route" vì giá trị sẽ bị đóng băng vào HTML tĩnh.
   */
  const openPostForm = () => {
    const today = getLocalDateString();
    setPostError(null);
    setExpiryMinDate(today);
    setExpiryMaxDate(getDateAfterDays(180));
    setPostForm((form) => ({
      ...form,
      expiredAt: form.expiredAt || getDateAfterDays(30),
    }));
    setIsPostFormOpen((open) => !open);
  };

  const handleSendInvite = async (id: string, name: string, postId: string) => {
    if (invitedIds.includes(id)) return;
    try {
      await apiClient.roommateInvitations.create({ recipientId: id, postId });
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
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                leftIcon={<UserPlus className="size-4" />}
                onClick={openPostForm}
              >
                Đăng nhu cầu ở ghép
              </Button>
              <Link href="/tenant/roommate-profile">
                <Button variant="outline" size="md" leftIcon={<Sparkles className="size-4" />}>
                  Cập nhật hồ sơ gu sống
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {isPostFormOpen && (
          <Card className="border border-[#d2e4d7] bg-white rounded-[12px] shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-[17px] font-bold text-[#203c37]">Đăng nhu cầu tìm bạn ở ghép</h2>
                  <p className="text-[13px] text-[#74817b] mt-1">
                    Chia sẻ ngân sách và nhu cầu để người phù hợp có thể kết nối với bạn.
                  </p>
                </div>
                <button type="button" onClick={() => setIsPostFormOpen(false)} className="text-sm text-[#74817b] hover:text-[#203c37]">
                  Đóng
                </button>
              </div>
              {postError && <p className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{postError}</p>}
              <form onSubmit={handleCreateRoommatePost} className="space-y-4">
                <input
                  required
                  minLength={3}
                  maxLength={200}
                  value={postForm.title}
                  onChange={(event) => setPostForm((form) => ({ ...form, title: event.target.value }))}
                  placeholder="Tiêu đề (VD: Tìm bạn nữ ở ghép tại Bình Thạnh)"
                  className="w-full h-11 rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-sm outline-none focus:border-[#15594f]"
                />
                <textarea
                  required
                  minLength={10}
                  maxLength={10000}
                  value={postForm.description}
                  onChange={(event) => setPostForm((form) => ({ ...form, description: event.target.value }))}
                  placeholder="Mô tả khu vực, thói quen sinh hoạt và mong muốn tìm bạn..."
                  className="min-h-28 w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] p-3 text-sm outline-none focus:border-[#15594f]"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[#74817b]">
                    Phòng đang thuê (dùng để kiểm tra sức chứa)
                    <select
                      value={postForm.roomId}
                      onChange={(event) => setPostForm((form) => ({ ...form, roomId: event.target.value }))}
                      className="mt-1 w-full h-11 rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-sm font-normal text-[#203c37] outline-none focus:border-[#15594f]"
                    >
                      <option value="">Không gắn phòng cụ thể</option>
                      {myRooms.map((room) => (
                        <option key={room.roomId} value={room.roomId}>{room.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[#74817b]">
                    Hạn đăng tin
                    <input
                      type="date"
                      value={postForm.expiredAt}
                      min={expiryMinDate}
                      max={expiryMaxDate}
                      onChange={(event) => setPostForm((form) => ({ ...form, expiredAt: event.target.value }))}
                      className="mt-1 w-full h-11 rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-sm font-normal text-[#203c37] outline-none focus:border-[#15594f]"
                    />
                  </label>
                </div>
                {myRooms.length === 0 && (
                  <p className="rounded-[8px] border border-[#f0d9a8] bg-[#fff4e5] px-3 py-2 text-xs text-[#8a5700]">
                    Bạn chưa có hợp đồng thuê đang hiệu lực. Tin vẫn có thể đăng, nhưng hệ thống chưa thể tự kiểm tra sức chứa khi có người nhận ở ghép.
                  </p>
                )}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex-1 text-xs font-semibold text-[#74817b]">
                    Ngân sách dự kiến (đ/tháng, không bắt buộc)
                    <input
                      type="number"
                      min="0"
                      max="99999999"
                      value={postForm.price}
                      onChange={(event) => setPostForm((form) => ({ ...form, price: event.target.value }))}
                      className="mt-1 w-full h-11 rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-sm font-normal text-[#203c37] outline-none focus:border-[#15594f]"
                    />
                  </label>
                  <Button type="submit" variant="primary" size="md" disabled={isPosting}>
                    {isPosting ? "Đang đăng..." : "Đăng nhu cầu"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {profileReady === false && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[10px] border border-[#f1c9bf] bg-[#fbeae6] px-4 py-3 text-sm text-[#7f1d1d]">
            <span>Hãy hoàn thiện hồ sơ gu sống để hệ thống tự lọc bạn ở ghép phù hợp với bạn.</span>
            <Link href="/tenant/roommate-profile" className="font-semibold underline">
              Hoàn thiện hồ sơ
            </Link>
          </div>
        )}

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

        {myRoommatePost && myPostMeta && (
          <Card className="border border-[#e2e7e1] bg-white rounded-[12px] shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-4 shrink-0 text-[#15594f]" />
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-[#74817b]">
                    Bài đăng tìm bạn ở ghép của bạn
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#203c37]">{myRoommatePost.title}</p>
                  <p className="mt-1 text-[13px] text-[#74817b]">{myPostMeta.description}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold ${myPostMeta.className}`}>
                  {myPostMeta.label}
                </span>
                {myRoommatePost.status === "APPROVED" && (
                  <Link href={`/roommates/${myRoommatePost.authorId}`}>
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="size-3.5" />}>
                      Xem hồ sơ
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3. Bộ lọc tìm bạn ở ghép */}
        <Card className="border border-[#e2e7e1] bg-white rounded-[12px] p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Filter className="mt-0.5 size-4 shrink-0 text-[#15594f]" />
              <div>
                <p className="text-[14px] font-semibold text-[#203c37]">Bộ lọc bạn ở ghép</p>
                <p className="text-[12px] text-[#74817b]">
                  Lọc theo khu vực, ngân sách và thói quen sinh hoạt. Kết quả cập nhật tự động.
                </p>
              </div>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 self-start text-[12px] font-semibold text-[#15594f] hover:underline"
              >
                <RotateCcw className="size-3.5" />
                Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Từ khóa</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 size-4 text-[#74817b]" />
                <input
                  type="text"
                  placeholder="Tên, nghề nghiệp, mô tả nhu cầu..."
                  value={filters.keyword}
                  onChange={(event) => updateFilter("keyword", event.target.value)}
                  className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] pl-10 pr-3.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Tỉnh / thành phố</label>
              <input
                type="text"
                placeholder="VD: TP. Hồ Chí Minh"
                value={filters.province}
                onChange={(event) => updateFilter("province", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Quận / huyện</label>
              <input
                type="text"
                placeholder="VD: Bình Thạnh"
                value={filters.district}
                onChange={(event) => updateFilter("district", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Sắp xếp</label>
              <select
                value={filters.sortBy}
                onChange={(event) => updateFilter("sortBy", event.target.value as RoommateFilterState["sortBy"])}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="best_match">Tương thích cao nhất</option>
                <option value="newest">Mới đăng gần đây</option>
                <option value="price_asc">Ngân sách thấp đến cao</option>
                <option value="price_desc">Ngân sách cao đến thấp</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Ngân sách từ (VNĐ)</label>
              <input
                type="number"
                min={0}
                placeholder="VD: 2000000"
                value={filters.minPrice}
                onChange={(event) => updateFilter("minPrice", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Ngân sách đến (VNĐ)</label>
              <input
                type="number"
                min={0}
                placeholder="VD: 5000000"
                value={filters.maxPrice}
                onChange={(event) => updateFilter("maxPrice", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3.5 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Giới tính</label>
              <select
                value={filters.gender}
                onChange={(event) => updateFilter("gender", event.target.value as RoommateFilterState["gender"])}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả giới tính</option>
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Tình trạng phòng</label>
              <select
                value={filters.hasRoom}
                onChange={(event) => updateFilter("hasRoom", event.target.value as RoommateFilterState["hasRoom"])}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả</option>
                <option value="true">Đã có phòng sẵn</option>
                <option value="false">Đang tìm phòng</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Giờ giấc sinh hoạt</label>
              <select
                value={filters.sleepSchedule}
                onChange={(event) => updateFilter("sleepSchedule", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả</option>
                <option value="22:00">Ngủ trước 22:00</option>
                <option value="22:30">Ngủ 22:00 - 23:00</option>
                <option value="23:30">Ngủ 23:00 - 00:00</option>
                <option value="01:00">Ngủ sau 00:00</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Hút thuốc</label>
              <select
                value={filters.smokingAllowed}
                onChange={(event) => updateFilter("smokingAllowed", event.target.value as RoommateFilterState["smokingAllowed"])}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả</option>
                <option value="false">Không hút thuốc</option>
                <option value="true">Có thể hút thuốc</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Thú cưng</label>
              <select
                value={filters.petAllowed}
                onChange={(event) => updateFilter("petAllowed", event.target.value as RoommateFilterState["petAllowed"])}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả</option>
                <option value="true">Cho phép thú cưng</option>
                <option value="false">Không nuôi thú cưng</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-wider text-[#203c37]">Mức độ sạch sẽ tối thiểu</label>
              <select
                value={filters.minCleanliness}
                onChange={(event) => updateFilter("minCleanliness", event.target.value)}
                className="h-[46px] w-full rounded-[8px] border border-[#e2e7e1] bg-[#f7f6f2] px-3 text-[14px] text-[#203c37] outline-none focus:border-[#15594f] focus:bg-white"
              >
                <option value="">Tất cả</option>
                <option value="3">Từ 3★ trở lên</option>
                <option value="4">Từ 4★ trở lên</option>
                <option value="5">5★ - Rất gọn gàng</option>
              </select>
            </div>

          </div>
        </Card>

        {/* 4. Sorting & Filter Tabs (Figma 44:63563) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e7e1] pb-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => updateFilter("hasRoom", "")}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === "best_match"
                  ? "bg-[#15594f] text-white shadow-sm"
                  : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
              }`}
            >
              Độ tương thích cao nhất
            </button>
            <button
              onClick={() => updateFilter("hasRoom", "true")}
              className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === "has_room"
                  ? "bg-[#15594f] text-white shadow-sm"
                  : "bg-white text-[#74817b] hover:text-[#203c37] border border-[#e2e7e1]"
              }`}
            >
              Đã có phòng sẵn
            </button>
            <button
              onClick={() => updateFilter("hasRoom", "false")}
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
            Tìm thấy <strong className="text-[#203c37]">{candidates.length}</strong> ứng viên phù hợp
          </div>
        </div>

        {/* 5. Candidates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-[14px] text-[#74817b]">
            <Loader2 className="size-5 animate-spin text-[#15594f]" />
            Đang tải bài đăng tìm bạn ở ghép...
          </div>
        ) : loadError ? (
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-[14px] font-semibold text-red-700">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadRoommates()}>
              Thử lại
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-white border border-[#e2e7e1] rounded-[12px] p-12 text-center space-y-4">
            <div className="size-14 mx-auto rounded-full bg-[#f7f6f2] flex items-center justify-center text-[#74817b]">
              <Users className="size-7" />
            </div>
            <h3 className="text-[18px] font-semibold text-[#203c37]">Không tìm thấy ứng viên phù hợp với bộ lọc</h3>
            <p className="text-[14px] text-[#74817b] max-w-md mx-auto">
              Hãy thử nới lỏng các tiêu chí về khu vực, ngân sách hoặc thói quen sinh hoạt
              để khám phá thêm nhiều ứng viên.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              Xóa tất cả bộ lọc
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {candidates.map((candidate) => {
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
                          <Avatar
                            src={candidate.avatarUrl}
                            alt={candidate.fullName}
                            className="size-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#15594f]">
                            Người đăng tin
                          </p>
                          <h4 className="text-[16px] font-bold text-[#203c37] leading-tight">
                            {candidate.fullName}
                          </h4>
                          <p className="text-[13px] text-[#74817b] mt-0.5">
                            {candidate.age > 0 ? `${candidate.age} tuổi • ` : ""}{candidate.gender}
                          </p>
                          <p className="text-[12px] text-[#74817b] truncate max-w-[170px]">{candidate.occupation}</p>
                        </div>
                      </div>

                      {/* Compatibility Badge (Figma 44:63577) */}
                      <div className="px-3 py-1.5 rounded-[100px] bg-[#eaf2ed] border border-[#15594f]/20 flex items-center gap-1 shrink-0">
                        <Sparkles className="size-3.5 text-[#15594f]" />
                        <span className="text-[13px] font-bold text-[#15594f]">
                          {candidate.matchScore > 0 ? `${candidate.matchScore}%` : "Mới"}
                        </span>
                      </div>
                    </div>

                    {/* Bài đăng + thông tin phòng */}
                    <div className="rounded-[10px] border border-[#d2e4d7] bg-[#f7faf8] p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#15594f]">
                          <FileText className="size-3.5" /> Bài đăng
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-[#74817b]">
                          <CalendarDays className="size-3.5" />
                          {formatPostedDate(candidate.postCreatedAt)}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-bold leading-snug text-[#203c37]">
                        {candidate.postTitle}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-[#5d6b65] line-clamp-3">
                        {candidate.postDescription}
                      </p>
                      {(candidate.propertyName || candidate.roomNumber || candidate.postExpiredAt) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {candidate.propertyName && (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-white px-2 py-1 text-[11px] text-[#203c37] border border-[#e2e7e1]">
                              <Building2 className="size-3" /> {candidate.propertyName}
                            </span>
                          )}
                          {candidate.roomNumber && (
                            <span className="inline-flex items-center gap-1 rounded-[6px] bg-white px-2 py-1 text-[11px] text-[#203c37] border border-[#e2e7e1]">
                              Phòng {candidate.roomNumber}
                              {candidate.maxOccupants ? ` · tối đa ${candidate.maxOccupants} người` : ""}
                            </span>
                          )}
                          {candidate.postExpiredAt && (
                            <span className="rounded-[6px] bg-white px-2 py-1 text-[11px] text-[#74817b] border border-[#e2e7e1]">
                              Hạn tin: {formatPostedDate(candidate.postExpiredAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Budget & Target District */}
                    <div className="grid grid-cols-2 gap-2 text-[13px] border-t border-[#e2e7e1] pt-3">
                      <div>
                        <span className="text-[#74817b] flex items-center gap-1 text-[11px] uppercase font-semibold">
                          <Wallet className="size-3" /> Ngân sách
                        </span>
                        <span className="font-semibold text-[#15594f]">
                          {formatBudget(candidate.budgetMin, candidate.budgetMax)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#74817b] flex items-center gap-1 text-[11px] uppercase font-semibold">
                          <MapPin className="size-3" /> Khu vực
                        </span>
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

                    {/* Giới thiệu của người đăng */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#74817b]">
                        Về người đăng
                      </p>
                      <p className="text-[13px] text-[#74817b] line-clamp-2 italic">
                        &ldquo;{candidate.bio}&rdquo;
                      </p>
                    </div>
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
                      onClick={() => handleSendInvite(candidate.id, candidate.fullName, candidate.postId)}
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