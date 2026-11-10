"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Receipt,
  XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { Notification, NotificationType, Post } from "@/types/models";
import { formatCurrency, formatDate } from "@/lib/utils";

function getNotificationTypeBadge(type: NotificationType) {
  switch (type) {
    case "POST_REJECTED":
      return {
        label: "Bài đăng bị từ chối",
        icon: XCircle,
        bg: "bg-[#fbeae6]",
        text: "text-[#a4422c]",
        border: "border-[#f6cbc1]",
      };
    case "POST_APPROVED":
      return {
        label: "Bài đăng được duyệt",
        icon: CheckCircle2,
        bg: "bg-[#eaf2ed]",
        text: "text-[#15594f]",
        border: "border-[#cce1d5]",
      };
    case "MESSAGE":
      return {
        label: "Tin nhắn mới",
        icon: MessageSquare,
        bg: "bg-[#e0f2fe]",
        text: "text-[#075985]",
        border: "border-[#bae6fd]",
      };
    case "APPOINTMENT":
      return {
        label: "Lịch xem phòng",
        icon: Calendar,
        bg: "bg-[#fbf1dc]",
        text: "text-[#9a6a12]",
        border: "border-[#f4deb4]",
      };
    case "INVOICE":
      return {
        label: "Hóa đơn & Thanh toán",
        icon: Receipt,
        bg: "bg-[#fef3c7]",
        text: "text-[#92400e]",
        border: "border-[#fde68a]",
      };
    case "CONTRACT":
      return {
        label: "Hợp đồng thuê",
        icon: FileText,
        bg: "bg-[#eaf2ed]",
        text: "text-[#15594f]",
        border: "border-[#cce1d5]",
      };
    default:
      return {
        label: "Thông báo hệ thống",
        icon: Bell,
        bg: "bg-[#f7f6f2]",
        text: "text-[#74817b]",
        border: "border-[#e2e7e1]",
      };
  }
}

function LandlordNotificationDetailContent() {
  const params = useParams();
  const notificationId = params?.id as string;

  const [notification, setNotification] = React.useState<Notification | null>(null);
  const [post, setPost] = React.useState<Post | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!notificationId) return;

    let isMounted = true;

    apiClient.notifications
      .getById(notificationId)
      .then(async (data) => {
        if (!isMounted) return;
        setNotification(data);

        // Mark as read if not already read
        if (!data.isRead) {
          apiClient.notifications.markAsRead(data.id).catch(() => {});
        }

        // If post related notification, fetch post details
        if (
          data.referenceId &&
          (data.type === "POST_REJECTED" || data.type === "POST_APPROVED")
        ) {
          try {
            const postData = await apiClient.posts.getById(data.referenceId);
            if (isMounted) setPost(postData);
          } catch {
            // post might have been deleted, handled gracefully
          }
        }
      })
      .catch((err) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Không tải được thông báo.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [notificationId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <div className="h-6 w-36 bg-gray-200 rounded animate-pulse" />
        <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !notification) {
    return (
      <div className="mx-auto max-w-xl py-14 text-center space-y-4">
        <div className="size-14 rounded-full bg-[#fbeae6] text-[#a4422c] flex items-center justify-center mx-auto">
          <Bell className="size-7" />
        </div>
        <h2 className="text-xl font-semibold text-[#203c37]">Không tìm thấy thông báo</h2>
        <p className="text-sm text-[#74817b]">{error || "Thông báo này không tồn tại hoặc đã bị xóa."}</p>
        <Link
          href="/landlord/notifications"
          className="inline-flex items-center gap-2 rounded-lg bg-[#15594f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#124b42]"
        >
          <ArrowLeft className="size-4" />
          <span>Quay lại thông báo</span>
        </Link>
      </div>
    );
  }

  const badge = getNotificationTypeBadge(notification.type);
  const Icon = badge.icon;

  const targetLink = (() => {
    const ref = notification.referenceId;
    if (notification.type === "POST_REJECTED" || notification.type === "POST_APPROVED") {
      return ref ? `/landlord/listings/${ref}` : "/landlord/listings";
    }
    if (notification.type === "CONTRACT") {
      return ref ? `/tenant/contracts/${ref}` : "/landlord/contracts";
    }
    if (notification.type === "INVOICE") {
      return "/landlord/invoices";
    }
    if (notification.type === "APPOINTMENT") {
      return "/landlord/calendar";
    }
    if (notification.type === "MESSAGE") {
      return ref ? `/landlord/messages?conversation=${encodeURIComponent(ref)}` : "/landlord/messages";
    }
    return "/landlord/rental-requests";
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-xs text-[#74817b]">
          <Link href="/landlord/dashboard" className="hover:text-[#203c37]">
            Vận hành
          </Link>
          <span>/</span>
          <Link href="/landlord/notifications" className="hover:text-[#203c37]">
            Thông báo
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#203c37]">Chi tiết thông báo</span>
        </nav>

        <Link
          href="/landlord/notifications"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e7e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#203c37] hover:bg-[#f7f6f2] transition-colors shadow-2xs"
        >
          <ArrowLeft className="size-3.5" />
          <span>Danh sách thông báo</span>
        </Link>
      </div>

      {/* Main Notification Card */}
      <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-4">
          <div className={`size-12 rounded-full ${badge.bg} ${badge.text} flex items-center justify-center shrink-0`}>
            <Icon className="size-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                {badge.label}
              </span>
              <span className="text-xs text-[#74817b] flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(notification.createdAt, "datetime")}
              </span>
            </div>

            <h1 className="text-xl font-bold text-[#203c37] tracking-tight">
              {notification.title}
            </h1>

            <p className="text-sm leading-relaxed text-[#4a5854] pt-1">
              {notification.content}
            </p>
          </div>
        </div>
      </div>

      {/* Linked Resource Detail Preview */}
      {post ? (
        <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#203c37] flex items-center gap-2">
              <FileText className="size-4 text-[#15594f]" />
              <span>Nội dung bài đăng liên quan</span>
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                post.status === "REJECTED"
                  ? "bg-[#fbeae6] text-[#a4422c]"
                  : post.status === "APPROVED"
                  ? "bg-[#eaf2ed] text-[#15594f]"
                  : "bg-[#fbf1dc] text-[#9a6a12]"
              }`}
            >
              {post.status === "REJECTED"
                ? "Bị từ chối"
                : post.status === "APPROVED"
                ? "Đang hiển thị"
                : "Chờ duyệt"}
            </span>
          </div>

          {/* Rejection Alert if post is REJECTED */}
          {post.status === "REJECTED" && (
            <div className="rounded-lg border border-[#f6cbc1] bg-[#fbeae6] p-4 text-xs text-[#a4422c] space-y-1">
              <p className="font-semibold flex items-center gap-1.5 text-sm">
                <XCircle className="size-4" />
                <span>Bài đăng này đã bị quản trị viên từ chối</span>
              </p>
              <p className="leading-relaxed">
                Bạn có thể mở trang chi tiết bài viết bên dưới để kiểm tra lại các thông tin mô tả, giá cả, hình ảnh phòng và tiến hành chỉnh sửa lại bài đăng.
              </p>
            </div>
          )}

          {/* Post mini preview */}
          <div className="flex flex-col sm:flex-row gap-4 rounded-lg border border-[#eef3ef] bg-[#f7f6f2] p-4">
            {post.images && post.images.length > 0 ? (
              <div className="aspect-4/3 w-full sm:w-36 overflow-hidden rounded-md bg-gray-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.images[0].imageUrl}
                  alt={post.title}
                  className="size-full object-cover"
                />
              </div>
            ) : null}

            <div className="flex-1 space-y-2">
              <h3 className="text-base font-bold text-[#203c37] line-clamp-1">{post.title}</h3>
              {post.property && (
                <p className="flex items-center gap-1 text-xs text-[#74817b]">
                  <MapPin className="size-3.5 text-[#15594f] shrink-0" />
                  <span>{post.property.name} - {post.property.address}</span>
                </p>
              )}
              {post.room && (
                <p className="text-xs text-[#74817b]">
                  Phòng: <span className="font-semibold text-[#203c37]">{post.room.roomNumber}</span> • Diện tích: {post.room.area}m²
                </p>
              )}
              <p className="text-sm font-bold text-[#15594f]">
                {formatCurrency(Number(post.room?.priceMonthly ?? post.price ?? 0))} / tháng
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Link
              href={`/landlord/listings/${post.id}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#15594f] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#124b42] transition-colors shadow-2xs"
            >
              <span>Xem chi tiết bài đăng {post.status === "REJECTED" ? "bị từ chối" : ""}</span>
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      ) : notification.referenceId ? (
        <div className="rounded-xl border border-[#e2e7e1] bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#203c37]">Thao tác liên kết</h2>
          <p className="text-sm text-[#74817b]">
            Thông báo này liên kết tới một mục trên hệ thống quản lý của bạn.
          </p>
          <div className="pt-2">
            <Link
              href={targetLink}
              className="inline-flex items-center gap-2 rounded-lg bg-[#15594f] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#124b42] transition-colors shadow-2xs"
            >
              <span>Đi đến trang chi tiết</span>
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LandlordNotificationDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[#74817b]">
          Đang tải thông báo...
        </div>
      }
    >
      <LandlordNotificationDetailContent />
    </React.Suspense>
  );
}