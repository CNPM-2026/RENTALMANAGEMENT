"use client";

import * as React from "react";
import { apiClient } from "@/lib/api";
import { Post } from "@/types/models";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Trash2, Plus, Phone, Mail, AlertTriangle } from "lucide-react";

interface BlacklistEntry {
  id: string;
  type: "PHONE" | "EMAIL";
  value: string;
  reason: string;
  createdAt: string;
  createdBy: {
    fullName: string;
    email: string;
  };
}

export default function AdminFraudPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [blacklist, setBlacklist] = React.useState<BlacklistEntry[]>([]);
  const [activeTab, setActiveTab] = React.useState<"SUSPICIOUS" | "BLACKLIST">("BLACKLIST");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // Blacklist modal form state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [addType, setAddType] = React.useState<"PHONE" | "EMAIL">("PHONE");
  const [addValue, setAddValue] = React.useState("");
  const [addReason, setAddReason] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const loadData = React.useCallback(() => {
    apiClient.admin
      .getPendingPosts()
      .then(setPosts)
      .catch(() => setError("Không tải được danh sách tin cần kiểm duyệt."));

    apiClient.admin
      .getBlacklist()
      .then((data: any) => setBlacklist(data ?? []))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const suspend = async (id: string) => {
    setProcessingId(id);
    try {
      await apiClient.admin.moderatePost(id, { status: "REJECTED" });
      setPosts((items) => items.filter((post) => post.id !== id));
      setSuccess("Đã khóa bài đăng vi phạm.");
    } catch {
      setError("Không thể cập nhật trạng thái tin đăng.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleAddToBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addValue.trim() || !addReason.trim()) {
      setError("Vui lòng điền đầy đủ giá trị và lý do.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.admin.addToBlacklist({
        type: addType,
        value: addValue.trim(),
        reason: addReason.trim(),
      });
      setSuccess(`Đã thêm ${addValue} vào Blacklist và tự động khóa tài khoản vi phạm (nếu có).`);
      setIsAddModalOpen(false);
      setAddValue("");
      setAddReason("");
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Không thể thêm vào danh sách đen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFromBlacklist = async (id: string, val: string) => {
    if (!confirm(`Bạn có chắc chắn muốn gỡ bỏ "${val}" khỏi Blacklist?`)) return;

    try {
      await apiClient.admin.removeFromBlacklist(id);
      setBlacklist((prev) => prev.filter((item) => item.id !== id));
      setSuccess(`Đã xóa ${val} khỏi danh sách đen.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Không thể xóa khỏi blacklist.");
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[8px] text-[13px] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">&times;</button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[8px] text-[13px] flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="font-bold ml-2">&times;</button>
        </div>
      )}

      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Điều tra Tin giả & Danh sách đen (Blacklist)</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">
          Quản lý số điện thoại & email lừa đảo, phát hiện gian lận và tự động đình chỉ các tài khoản vi phạm.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          onClick={() => setActiveTab("SUSPICIOUS")}
          className={`rounded-[12px] border p-5 shadow-xs cursor-pointer transition-all ${
            activeTab === "SUSPICIOUS" ? "border-[#15594f] bg-[#eaf2ed]/40 ring-1 ring-[#15594f]" : "border-[#e2e7e1] bg-white hover:bg-[#faf9f5]"
          }`}
        >
          <p className="text-[13px] text-[#74817b]">Tin nghi vấn lừa đảo</p>
          <p className="text-[26px] font-bold text-[#a4422c] mt-1">{posts.length}</p>
          <p className="text-[11px] text-[#74817b] mt-1">Tin đang chờ kiểm tra</p>
        </div>

        <div
          onClick={() => setActiveTab("BLACKLIST")}
          className={`rounded-[12px] border p-5 shadow-xs cursor-pointer transition-all ${
            activeTab === "BLACKLIST" ? "border-[#15594f] bg-[#eaf2ed]/40 ring-1 ring-[#15594f]" : "border-[#e2e7e1] bg-white hover:bg-[#faf9f5]"
          }`}
        >
          <p className="text-[13px] text-[#74817b]">Số điện thoại & Email vào sổ đen</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">{blacklist.length}</p>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Hệ thống Blacklist đang kích hoạt</p>
        </div>

        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Độ tin cậy toàn sàn</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">98.5%</p>
          <p className="text-[11px] text-[#74817b] mt-1">Dựa trên kiểm soát KYC & Blacklist</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#e2e7e1] pb-2">
        <button
          onClick={() => setActiveTab("BLACKLIST")}
          className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors ${
            activeTab === "BLACKLIST" ? "bg-[#15594f] text-white" : "text-[#74817b] hover:bg-[#f2ede3]"
          }`}
        >
          Quản lý Blacklist ({blacklist.length})
        </button>
        <button
          onClick={() => setActiveTab("SUSPICIOUS")}
          className={`px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-colors ${
            activeTab === "SUSPICIOUS" ? "bg-[#15594f] text-white" : "text-[#74817b] hover:bg-[#f2ede3]"
          }`}
        >
          Tin nghi vấn chờ duyệt ({posts.length})
        </button>
      </div>

      {/* Tab: Blacklist */}
      {activeTab === "BLACKLIST" && (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-[#203c37]">Danh sách đen (Blacklist Số điện thoại & Email)</h3>
              <p className="text-[12px] text-[#74817b]">
                Khi một số điện thoại hoặc email bị thêm vào danh sách này, tài khoản tương ứng sẽ bị khóa ngay lập tức và không thể đăng ký hay đăng nhập lại.
              </p>
            </div>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-[#15594f] hover:bg-[#103f39] text-white font-medium text-[13px]"
              leftIcon={<Plus className="size-4" />}
            >
              Thêm vào Blacklist
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e7e1] text-[12px] font-bold text-[#74817b] uppercase">
                  <th className="py-3 px-4">Loại</th>
                  <th className="py-3 px-4">Số ĐT / Email</th>
                  <th className="py-3 px-4">Lý do khóa / Đưa vào blacklist</th>
                  <th className="py-3 px-4">Người thực hiện</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2ede3] text-[13px]">
                {blacklist.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#74817b]">
                      Chưa có số điện thoại hay email nào trong danh sách đen.
                    </td>
                  </tr>
                ) : (
                  blacklist.map((item) => (
                    <tr key={item.id} className="hover:bg-[#faf9f5] transition-colors">
                      <td className="py-3.5 px-4 font-semibold">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          item.type === "PHONE" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-800"
                        }`}>
                          {item.type === "PHONE" ? <Phone className="size-3" /> : <Mail className="size-3" />}
                          {item.type === "PHONE" ? "Số điện thoại" : "Email"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#203c37]">{item.value}</td>
                      <td className="py-3.5 px-4 text-[#55635d] max-w-xs">{item.reason}</td>
                      <td className="py-3.5 px-4 text-[#74817b]">{item.createdBy?.fullName || item.createdBy?.email}</td>
                      <td className="py-3.5 px-4 text-[#74817b] text-[12px]">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveFromBlacklist(item.id, item.value)}
                          className="p-1.5 rounded-[6px] text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                          title="Gỡ khỏi danh sách đen"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Suspicious Posts */}
      {activeTab === "SUSPICIOUS" && (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
          <h3 className="text-[16px] font-semibold text-[#203c37] mb-3">Danh sách tin đăng chờ kiểm tra vi phạm</h3>
          <div className="divide-y divide-[#eef3ef]">
            {posts.length === 0 ? (
              <p className="py-4 text-sm text-[#74817b]">Không có tin đang chờ kiểm tra.</p>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[14px] text-[#203c37]">{post.title}</p>
                    <p className="text-[12px] text-[#74817b]">Người đăng: {post.author?.fullName || "Chưa cập nhật"} • Giá: {post.price?.toLocaleString()} đ</p>
                  </div>
                  <button
                    onClick={() => suspend(post.id)}
                    disabled={processingId === post.id}
                    className="px-3 py-1.5 rounded-[6px] bg-[#a4422c] hover:bg-[#833220] text-white text-[12px] font-medium"
                  >
                    {processingId === post.id ? "Đang xử lý..." : "Khóa tin"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add to Blacklist Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-[16px] max-w-md w-full p-6 shadow-xl border border-[#e2e7e1] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-bold text-[#203c37] flex items-center gap-2">
                <ShieldAlert className="size-5 text-[#a4422c]" />
                Thêm vào Blacklist
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#74817b] hover:text-[#203c37] text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddToBlacklist} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                  Loại thông tin định danh <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="blacklistType"
                      checked={addType === "PHONE"}
                      onChange={() => setAddType("PHONE")}
                      className="accent-[#15594f]"
                    />
                    Số điện thoại
                  </label>
                  <label className="flex items-center gap-2 text-[13px] font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="blacklistType"
                      checked={addType === "EMAIL"}
                      onChange={() => setAddType("EMAIL")}
                      className="accent-[#15594f]"
                    />
                    Email
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                  {addType === "PHONE" ? "Số điện thoại cần chặn" : "Địa chỉ Email cần chặn"} <span className="text-red-500">*</span>
                </label>
                <input
                  type={addType === "PHONE" ? "tel" : "email"}
                  required
                  placeholder={addType === "PHONE" ? "0912345678" : "scammer@example.com"}
                  value={addValue}
                  onChange={(e) => setAddValue(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[#203c37] mb-1">
                  Lý do đưa vào sổ đen & khóa tài khoản <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ghi rõ hành vi vi phạm (ví dụ: lừa đảo tiền cọc, spam tin giả, vi phạm nghiêm trọng...)"
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  className="w-full p-2.5 text-[13px] rounded-[8px] border border-[#e2e7e1] focus:outline-none focus:border-[#15594f] resize-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[11px] text-amber-800">
                <strong className="block mb-0.5">Lưu ý quan trọng:</strong>
                Tài khoản gắn với thông tin này sẽ lập tức bị đình chỉ, mọi bài đăng bị ẩn, các hợp đồng liên quan chuyển sang xử lý tạm đình chỉ và không thể đăng nhập lại.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#a4422c] hover:bg-[#833220] text-white font-bold"
                >
                  {isSubmitting ? "Đang xử lý..." : "Xác nhận đưa vào Blacklist"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
