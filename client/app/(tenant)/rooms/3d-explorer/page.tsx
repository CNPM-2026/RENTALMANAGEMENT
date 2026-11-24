"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const Property3DExplorer = dynamic(
  () =>
    import("@/components/explorer-3d/property-3d-explorer").then(
      (mod) => mod.Property3DExplorer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-[#0f171a] flex flex-col items-center justify-center text-white space-y-4">
        <div className="size-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-400 animate-spin" />
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold tracking-wider uppercase text-emerald-400">
            Đang khởi tạo không gian 3D...
          </h2>
          <p className="text-xs text-slate-400">Tải mô hình kiến trúc &amp; dữ liệu phòng Kestrel Wharf</p>
        </div>
      </div>
    ),
  }
);

export default function Rooms3DExplorerPage() {
  return (
    <main className="w-full h-screen overflow-hidden bg-[#0f171a]">
      <React.Suspense fallback={null}>
        <Property3DExplorer />
      </React.Suspense>
    </main>
  );
}
