"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  X,
  User,
  CreditCard,
  Calendar,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldX,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { translateRole } from "@/lib/labels";
import type { KycSubmission } from "@/types/models";

function AdminKycDetailContent() {
  const params = useParams();
  const id = params?.id as string;

  const [kyc, setKyc] = React.useState<KycSubmission | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [showRejectModal, setShowRejectModal] = React.useState(false);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let isCancelled = false;
    apiClient.adminGovernance
      .getKycById(id)
      .then((data) => {
        if (!isCancelled) {
          setKyc(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Không tìm thấy hồ sơ KYC");
        }
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [id]);

  const handleApprove = async () => {
    if (!kyc || !window.confirm("Bạn có chắc chắn muốn phê duyệt hồ sơ KYC này?")) return;
    setActionLoading(true);
    try {
      const updated = await apiClient.adminGovernance.updateKyc(kyc.id, { status: "APPROVED" });
      setKyc(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể duyệt hồ sơ");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!kyc) return;
    if (!rejectionReason.trim()) {
      alert("Vui lòng nhập lý do từ chối");
      return;
    }
    setActionLoading(true);
    try {
      const updated = await apiClient.adminGovernance.updateKyc(kyc.id, {
        status: "REJECTED",
        rejectionReason: rejectionReason.trim(),
      });
      setKyc(updated);
      setShowRejectModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể từ chối hồ sơ");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="h-10 w-64 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  if (error || !kyc) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="size-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-[#203c37]">{error || "Hồ sơ không tồn tại"}</h2>
        <Link
          href="/admin/landlords/kyc"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#15594f] text-white rounded-lg text-sm font-semibold"
        >
          <ArrowLeft className="size-4" /> Quay lại danh sách KYC
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header & Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/landlords/kyc"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#15594f] hover:underline mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Quay lại danh sách hồ sơ KYC
          </Link>
          <h1 className="text-2xl font-bold text-[#203c37]">
            Chi tiết hồ sơ xác minh danh tính
          </h1>
          <p className="text-xs text-[#74817b] mt-0.5">Mã hồ sơ: {kyc.id}</p>
        </div>

        {/* Status Badge */}
        <div>
          {kyc.status === "PENDING" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fbf1dc] text-[#9a6a12] text-xs font-bold">
              <Clock className="size-4" />
              Đang chờ xét duyệt
            </span>
          )}
          {kyc.status === "APPROVED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eaf2ed] text-[#15594f] text-xs font-bold">
              <ShieldCheck className="size-4" />
              Đã được phê duyệt
            </span>
          )}
          {kyc.status === "REJECTED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-700 text-xs font-bold border border-red-200">
              <ShieldX className="size-4" />
              Đã bị từ chối
            </span>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Profile info */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-[#e2e7e1] p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#74817b] flex items-center gap-2">
              <User className="size-4 text-[#15594f]" />
              Thông tin người dùng
            </h2>

            <div className="space-y-3 pt-2">
              <div>
                <p className="text-xs text-[#74817b]">Họ và tên</p>
                <p className="text-sm font-bold text-[#203c37]">{kyc.user?.fullName || "Chưa cập nhật"}</p>
              </div>

              <div>
                <p className="text-xs text-[#74817b]">Vai trò tài khoản</p>
                <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#eaf2ed] text-[#15594f]">
                  {translateRole(kyc.user?.role)}
                </span>
              </div>

              <div>
                <p className="text-xs text-[#74817b]">Email liên hệ</p>
                <p className="text-sm text-[#203c37] font-medium">{kyc.user?.email || "—"}</p>
              </div>

              <div>
                <p className="text-xs text-[#74817b]">Số điện thoại</p>
                <p className="text-sm text-[#203c37] font-medium">{kyc.user?.phone || "Chưa cập nhật"}</p>
              </div>

              {kyc.user?.id && (
                <div className="pt-2">
                  <Link
                    href={`/users/${kyc.user.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#15594f] hover:underline"
                  >
                    Xem hồ sơ công khai <ExternalLink className="size-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Submission Info */}
          <div className="bg-white rounded-xl border border-[#e2e7e1] p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#74817b] flex items-center gap-2">
              <Calendar className="size-4 text-[#15594f]" />
              Lịch sử hồ sơ
            </h2>
            <div className="space-y-2 text-xs text-[#74817b]">
              <div>
                <span>Thời gian nộp: </span>
                <span className="font-semibold text-[#203c37]">
                  {new Date(kyc.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
              <div>
                <span>Cập nhật lần cuối: </span>
                <span className="font-semibold text-[#203c37]">
                  {new Date(kyc.updatedAt).toLocaleString("vi-VN")}
                </span>
              </div>
              {kyc.rejectionReason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 space-y-1 mt-2">
                  <p className="font-bold">Lý do từ chối:</p>
                  <p>{kyc.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Identity Document Details & Images */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-[#e2e7e1] p-6 shadow-xs space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#74817b] flex items-center gap-2">
              <CreditCard className="size-4 text-[#15594f]" />
              Thông tin Căn cước công dân / Hộ chiếu
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
              <div className="p-3 bg-[#f7f6f2] rounded-lg border border-[#e2e7e1]">
                <p className="text-xs text-[#74817b] mb-1">Số CCCD / Mã định danh</p>
                <p className="text-base font-bold text-[#203c37] font-mono">{kyc.idNumber}</p>
              </div>

              <div className="p-3 bg-[#f7f6f2] rounded-lg border border-[#e2e7e1]">
                <p className="text-xs text-[#74817b] mb-1">Địa chỉ thường trú</p>
                <p className="text-sm font-medium text-[#203c37]">{kyc.permanentAddress}</p>
              </div>
            </div>

            {/* Photos Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#74817b]">
                Hình ảnh giấy tờ tùy thân
              </h3>

              {kyc.status === "APPROVED" && !kyc.frontIdUrl && !kyc.backIdUrl ? (
                <div className="p-4 rounded-lg bg-[#eaf2ed] border border-[#d2e4d7] text-xs text-[#15594f] flex items-center gap-2">
                  <BadgeCheck className="size-4 shrink-0" />
                  <span>
                    Hình ảnh CCCD đã được tự động xóa an toàn khỏi hệ thống lưu trữ theo chính sách bảo mật sau khi được phê duyệt.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front Image */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#203c37]">Mặt trước CCCD</p>
                    {kyc.frontIdUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(kyc.frontIdUrl)}
                        className="group relative w-full h-48 rounded-lg overflow-hidden border border-[#e2e7e1] bg-gray-50 flex items-center justify-center cursor-zoom-in"
                      >
                        <img
                          src={kyc.frontIdUrl}
                          alt="CCCD Mặt trước"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Bấm để xem ảnh phóng to
                        </div>
                      </button>
                    ) : (
                      <div className="w-full h-48 rounded-lg border border-dashed border-[#e2e7e1] flex items-center justify-center text-xs text-[#74817b]">
                        Không có ảnh mặt trước
                      </div>
                    )}
                  </div>

                  {/* Back Image */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#203c37]">Mặt sau CCCD</p>
                    {kyc.backIdUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(kyc.backIdUrl)}
                        className="group relative w-full h-48 rounded-lg overflow-hidden border border-[#e2e7e1] bg-gray-50 flex items-center justify-center cursor-zoom-in"
                      >
                        <img
                          src={kyc.backIdUrl}
                          alt="CCCD Mặt sau"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          Bấm để xem ảnh phóng to
                        </div>
                      </button>
                    ) : (
                      <div className="w-full h-48 rounded-lg border border-dashed border-[#e2e7e1] flex items-center justify-center text-xs text-[#74817b]">
                        Không có ảnh mặt sau
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Approval / Rejection Actions */}
            {kyc.status === "PENDING" && (
              <div className="pt-6 border-t border-[#e2e7e1] flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setShowRejectModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="size-4" />
                  Từ chối hồ sơ
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleApprove}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#15594f] text-white text-sm font-semibold hover:bg-[#124b42] transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <Check className="size-4" />
                  {actionLoading ? "Đang xử lý..." : "Phê duyệt hồ sơ"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#203c37]">Từ chối hồ sơ xác minh KYC</h3>
            <p className="text-xs text-[#74817b]">
              Vui lòng nhập lý do từ chối để thông báo cho người dùng biết cần bổ sung hoặc chụp lại giấy tờ nào.
            </p>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ví dụ: Ảnh chụp CCCD mặt trước bị mờ / chói sáng, vui lòng chụp lại rõ nét cả 4 góc..."
              className="w-full text-xs p-3 border border-[#e2e7e1] rounded-lg outline-none focus:border-[#15594f]"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg border border-[#e2e7e1] text-xs font-semibold text-[#74817b] hover:bg-gray-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReject}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? "Đang gửi..." : "Xác nhận từ chối"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Ảnh phóng to"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white text-sm font-semibold hover:underline"
            >
              Đóng (ESC)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminKycDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 max-w-4xl mx-auto space-y-4 animate-pulse">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      }
    >
      <AdminKycDetailContent />
    </React.Suspense>
  );
}
