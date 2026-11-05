"use client";

import * as React from "react";
import { Filter, Plus, Trash2 } from "lucide-react";

export default function AdminContentFilterPage() {
  const [bannedKeywords, setBannedKeywords] = React.useState([
    "cờ bạc", "vay nóng", "tiền hoa hồng ngoài", "chuyển khoản gấp không cần xem", "lừa đảo"
  ]);
  const [newKeyword, setNewKeyword] = React.useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setBannedKeywords((prev) => [...prev, newKeyword.trim()]);
    setNewKeyword("");
  };

  const handleRemove = (word: string) => {
    setBannedKeywords((prev) => prev.filter((w) => w !== word));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[12px] text-[#74817b]">Kiểm duyệt & Tranh chấp</p>
        <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Quản lý Nội dung Cấm</h1>
        <p className="text-[14px] text-[#74817b] mt-0.5">Danh sách các từ khóa, số điện thoại nhạy cảm bị chặn tự động trong tin đăng và tin nhắn.</p>
      </div>

      <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-6 shadow-xs space-y-5">
        <form onSubmit={handleAdd} className="flex gap-3 max-w-md">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Thêm từ khóa cấm mới..."
            className="flex-1 text-[13px] px-3.5 py-2 rounded-[8px] border border-[#e2e7e1] outline-none focus:border-[#15594f]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] cursor-pointer"
          >
            Thêm
          </button>
        </form>

        <div>
          <p className="text-[13px] font-semibold text-[#203c37] mb-3">Từ khóa đang được lọc tự động:</p>
          <div className="flex flex-wrap gap-2">
            {bannedKeywords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fbeae6] text-[#a4422c] text-[12px] font-semibold"
              >
                <span>{word}</span>
                <button onClick={() => handleRemove(word)} className="hover:opacity-75 cursor-pointer">
                  <Trash2 className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
