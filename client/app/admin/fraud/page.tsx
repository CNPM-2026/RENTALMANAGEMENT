"use client";

import * as React from "react";
import { ShieldAlert, Search, Filter, AlertOctagon } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Post } from "@/types/models";

export default function AdminFraudPage() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  React.useEffect(() => {
    apiClient.admin.getPendingPosts().then(setPosts).catch(() => setError("Không tải được danh sách tin cần kiểm duyệt."));
  }, []);
  const suspend = async (id: string) => {
    setProcessingId(id);
    try {
      await apiClient.admin.moderatePost(id, { status: "REJECTED" });
      setPosts((items) => items.filter((post) => post.id !== id));
    } catch {
      setError("Không thể cập nhật trạng thái tin đăng.");
    } finally {
      setProcessingId(null);
    }
  };
  return (
    <div className="space-y-6">
      {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Điều tra Tin giả & Lừa đảo</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Hệ thống AI quét tự động phát hiện số điện thoại lừa đảo, trùng lặp hình ảnh hoặc giá bất thường.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Tin nghi vấn lừa đảo</p>
          <p className="text-[26px] font-bold text-[#a4422c] mt-1">{posts.length}</p>
          <p className="text-[11px] text-[#74817b] mt-1">Tin đang chờ kiểm tra</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Số điện thoại vào sổ đen</p>
          <p className="text-[26px] font-bold text-[#203c37] mt-1">—</p>
          <p className="text-[11px] text-[#74817b] mt-1">Chưa có module blacklist</p>
        </div>
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-5 shadow-xs">
          <p className="text-[13px] text-[#74817b]">Độ tin cậy toàn sàn</p>
          <p className="text-[26px] font-bold text-[#15594f] mt-1">—</p>
          <p className="text-[11px] text-[#74817b] mt-1">Cần dữ liệu đánh giá rủi ro</p>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs">
        <h3 className="text-[16px] font-semibold text-[#203c37] mb-3">Danh sách cảnh báo tự động</h3>
        <div className="divide-y divide-[#eef3ef]">
          {posts.length === 0 ? <p className="py-4 text-sm text-[#74817b]">Không có tin đang chờ kiểm tra.</p> : posts.map((post) => <div key={post.id} className="py-3.5 flex items-center justify-between gap-4"><div><p className="font-semibold text-[14px] text-[#203c37]">{post.title}</p><p className="text-[12px] text-[#74817b]">Tin đăng đang chờ admin kiểm duyệt.</p></div><button onClick={() => suspend(post.id)} disabled={processingId === post.id} className="px-3 py-1.5 rounded-[6px] bg-[#a4422c] text-white text-[12px] font-medium">{processingId === post.id ? "Đang xử lý..." : "Khóa tin"}</button></div>)}
        </div>
      </div>
    </div>
  );
}
