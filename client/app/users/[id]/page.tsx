"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Home,
  Loader2,
  MapPin,
  Star,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { translateRole, translateServiceCategory } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { PublicUserProfile } from "@/types/models";

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString("vi-VN")} đ` : null;
}

/**
 * TRANG CÁ NHÂN CÔNG KHAI `/users/[id]` — hiển thị theo ROLE.
 *
 * Dữ liệu lấy từ `/users/:id/public-profile`: không có email/số điện thoại hay
 * toạ độ nhà của thợ. Staff hiển thị kỹ năng + kinh nghiệm + điểm đánh giá;
 * landlord hiển thị quy mô cơ sở; tenant hiển thị mô tả/nghề nghiệp.
 */
function PublicUserProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params?.id;
  const [profile, setProfile] = React.useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    apiClient.users
      .getPublicProfile(userId)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được hồ sơ.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[900px] items-center gap-2 p-8 text-sm text-[#74817b]">
        <Loader2 className="size-4 animate-spin" /> Đang tải hồ sơ...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 p-8">
        <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f]">
          <ArrowLeft className="size-4" /> Quay lại
        </button>
        <div className="rounded-[12px] border border-[#f6cbc1] bg-[#fbeae6] p-6 text-sm text-[#a4422c]">
          {error ?? "Không tìm thấy hồ sơ người dùng."}
        </div>
      </div>
    );
  }

  const staff = profile.staffProfile;
  const priceRange = [formatMoney(staff?.priceMin), formatMoney(staff?.priceMax)].filter(Boolean).join(" – ");

  return (
    <div className="min-h-screen bg-[#f7f6f2] px-4 py-8">
      <div className="mx-auto max-w-[900px] space-y-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#15594f] hover:underline"
        >
          <ArrowLeft className="size-4" /> Quay lại
        </button>

        <section className="rounded-[14px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="size-24 rounded-full border border-[#e2e7e1] object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-[#eaf2ed] text-[#15594f]">
                <UserRound className="size-10" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[26px] font-semibold text-[#203c37]">{profile.fullName}</h1>
                {profile.kycVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf2ed] px-2.5 py-1 text-[11px] font-semibold text-[#15594f]">
                    <BadgeCheck className="size-3.5" /> Đã xác minh
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[13px] text-[#74817b]">
                <span className="rounded-full bg-[#f2ede3] px-2.5 py-1 font-semibold text-[#6b5a3e]">
                  {translateRole(profile.role)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> Tham gia {formatDate(profile.joinedAt, "short")}
                </span>
                {profile.occupation && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="size-3.5" /> {profile.occupation}
                  </span>
                )}
              </div>
              {profile.bio && <p className="mt-3 text-[14px] leading-7 text-[#3f4f49]">{profile.bio}</p>}
            </div>
          </div>
        </section>

        {profile.role === "STAFF" && (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
                <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
                  <ClipboardCheck className="size-3.5" /> Việc đã hoàn thành
                </p>
                <p className="mt-1 text-[24px] font-semibold text-[#203c37]">{profile.stats.completedTasks ?? 0}</p>
              </div>
              <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
                <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
                  <Star className="size-3.5" /> Đánh giá trung bình
                </p>
                <p className="mt-1 text-[24px] font-semibold text-[#203c37]">
                  {(profile.stats.averageRating ?? 0).toFixed(1)}
                  <span className="ml-1 text-[13px] font-normal text-[#74817b]">/ 5</span>
                </p>
                <p className="text-[12px] text-[#74817b]">{profile.stats.reviewCount ?? 0} lượt đánh giá</p>
              </div>
              <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
                <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]">
                  <Wallet className="size-3.5" /> Khoảng giá
                </p>
                <p className="mt-1 text-[15px] font-semibold text-[#203c37]">{priceRange || "Thương lượng"}</p>
                <p className="text-[12px] text-[#74817b]">{staff?.isAvailable ? "Đang nhận việc" : "Tạm không nhận việc"}</p>
              </div>
            </section>

            <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold text-[#203c37]">
                <Wrench className="size-4 text-[#15594f]" /> Kỹ năng &amp; kinh nghiệm
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(staff?.skills ?? []).map((skill) => (
                  <span key={skill.category} className="rounded-full bg-[#eaf2ed] px-3 py-1 text-[12px] font-semibold text-[#15594f]">
                    {translateServiceCategory(skill.category)}
                  </span>
                ))}
                {(staff?.skills ?? []).length === 0 && (
                  <span className="text-[13px] text-[#74817b]">Chưa khai báo kỹ năng.</span>
                )}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-[#3f4f49]">
                {staff?.description || "Thợ chưa cập nhật mô tả kinh nghiệm."}
              </p>
              {staff?.serviceAddress && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[#74817b]">
                  <MapPin className="size-4 text-[#15594f]" /> Khu vực làm việc: {staff.serviceAddress}
                </p>
              )}
            </section>
          </>
        )}

        {profile.role === "LANDLORD" && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
              <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]"><Building2 className="size-3.5" /> Cơ sở</p>
              <p className="mt-1 text-[24px] font-semibold text-[#203c37]">{profile.stats.properties ?? 0}</p>
            </div>
            <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
              <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]"><Home className="size-3.5" /> Phòng</p>
              <p className="mt-1 text-[24px] font-semibold text-[#203c37]">{profile.stats.rooms ?? 0}</p>
            </div>
            <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5">
              <p className="flex items-center gap-1.5 text-[12px] text-[#74817b]"><ClipboardCheck className="size-3.5" /> Công việc hoàn thành</p>
              <p className="mt-1 text-[24px] font-semibold text-[#203c37]">{profile.stats.completedTasks ?? 0}</p>
            </div>
          </section>
        )}

        {profile.role === "TENANT" && (
          <section className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
            <h2 className="text-[16px] font-semibold text-[#203c37]">Thông tin cá nhân</h2>
            <p className="mt-2 text-[14px] leading-7 text-[#3f4f49]">
              {profile.bio || "Người dùng chưa cập nhật mô tả bản thân."}
            </p>
            <p className="mt-2 text-[13px] text-[#74817b]">
              Hợp đồng đang hiệu lực: <span className="font-semibold text-[#203c37]">{profile.stats.activeContracts ?? 0}</span>
            </p>
          </section>
        )}

        <p className="text-center text-[12px] text-[#9aa8a0]">
          Trang cá nhân công khai · Không hiển thị email, số điện thoại hay toạ độ.{" "}
          <Link href="/" className="text-[#15594f] hover:underline">Về trang chủ</Link>
        </p>
      </div>
    </div>
  );
}

export default function PublicUserProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-[900px] p-8 text-sm text-[#74817b]">Đang tải hồ sơ...</div>
      }
    >
      <PublicUserProfileContent />
    </React.Suspense>
  );
}

