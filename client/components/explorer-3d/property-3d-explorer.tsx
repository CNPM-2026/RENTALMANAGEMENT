"use client";

import * as React from "react";
import Link from "next/link";
import {
  X,
  Compass,
  Building,
  Home,
  Sun,
  MapPin,
  CalendarDays,
  FileCheck,
  CheckCircle2,
  Eye,
  ChevronRight,
  Sparkles,
  PhoneCall,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Property3DScene } from "./property-3d-scene";
import { DEFAULT_BUILDING_DATA } from "./mock-building-data";
import { ExplorerMode, ExplorerUnit, HotspotPoint, UnitMeasurement } from "./types";
import { formatCurrency } from "@/lib/utils";

interface Property3DExplorerProps {
  initialFloor?: number;
  onClose?: () => void;
}

export function Property3DExplorer({ initialFloor = 4, onClose }: Property3DExplorerProps) {
  const [mode, setMode] = React.useState<ExplorerMode>("HOMES");
  const [selectedFloor, setSelectedFloor] = React.useState<number>(initialFloor);
  const [measurement, setMeasurement] = React.useState<UnitMeasurement>("M2");
  const [selectedUnit, setSelectedUnit] = React.useState<ExplorerUnit | null>(() => {
    return DEFAULT_BUILDING_DATA.units.find((u) => u.unitNumber === "406") ?? null;
  });
  const [hoveredUnitId, setHoveredUnitId] = React.useState<string | null>(null);
  const [selectedHotspot, setSelectedHotspot] = React.useState<HotspotPoint | null>(null);
  const [screenPositions, setScreenPositions] = React.useState<
    { id: string; x: number; y: number; visible: boolean }[]
  >([]);
  const [activeImageIndex, setActiveImageIndex] = React.useState(0);
  const [is360ModalOpen, setIs360ModalOpen] = React.useState(false);
  const [contactModalOpen, setContactModalOpen] = React.useState(false);

  const building = DEFAULT_BUILDING_DATA;

  // Filter units for the selected floor
  const currentFloorUnits = React.useMemo(() => {
    return building.units.filter((u) => u.floor === selectedFloor);
  }, [building.units, selectedFloor]);


  const handleSelectUnit = (unit: ExplorerUnit | null) => {
    setSelectedUnit(unit);
    setActiveImageIndex(0);
    setSelectedHotspot(null);
  };

  const handleSelectHotspot = (hotspot: HotspotPoint) => {
    setSelectedHotspot(hotspot);
    setSelectedUnit(null);
  };

  return (
    <div className="relative w-full h-screen bg-[#0f171a] overflow-hidden text-white font-sans select-none">
      {/* =======================================================================
          1. TOP NAVIGATION & CONTROLS BAR (Matches Video Header)
      ======================================================================== */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 py-4 flex items-center justify-between pointer-events-none">
        {/* Left: Building Brand Title */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
            <Building className="size-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-wider uppercase text-white drop-shadow-md">
                {building.name.split(" - ")[0]}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                3D LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="size-3 text-emerald-400" />
              {building.address}
            </p>
          </div>
        </div>

        {/* Center: Mode Switcher Pills (HOMES | ROOFTOP | STREET) */}
        <div className="pointer-events-auto flex items-center bg-[#182329]/90 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-2xl">
          <button
            onClick={() => {
              setMode("HOMES");
              setSelectedHotspot(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              mode === "HOMES"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Home className="size-3.5" />
            HOMES (TẦNG)
          </button>

          <button
            onClick={() => {
              setMode("ROOFTOP");
              setSelectedUnit(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              mode === "ROOFTOP"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sun className="size-3.5" />
            ROOFTOP (SÂN THƯỢNG)
          </button>

          <button
            onClick={() => {
              setMode("STREET");
              setSelectedUnit(null);
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              mode === "STREET"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Building className="size-3.5" />
            STREET (MẶT PHỐ)
          </button>
        </div>

        {/* Right Controls: M2/FT2 Toggle & Contact / Exit */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Unit Toggle */}
          <div className="flex items-center bg-[#182329]/90 backdrop-blur-md border border-white/10 rounded-full p-1">
            <button
              onClick={() => setMeasurement("M2")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                measurement === "M2" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              M²
            </button>
            <button
              onClick={() => setMeasurement("FT2")}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                measurement === "FT2" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              FT²
            </button>
          </div>

          {/* Contact Button */}
          <button
            onClick={() => setContactModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold backdrop-blur-md transition-colors cursor-pointer"
          >
            <PhoneCall className="size-3.5 text-emerald-400" />
            LIÊN HỆ
          </button>

          {/* Back/Close */}
          {onClose ? (
            <button
              onClick={onClose}
              className="size-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng 3D Explorer"
            >
              <X className="size-4 text-white" />
            </button>
          ) : (
            <Link
              href="/rooms"
              className="size-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
              title="Quay lại danh sách phòng"
            >
              <X className="size-4 text-white" />
            </Link>
          )}
        </div>
      </header>

      {/* =======================================================================
          2. FLOATING RIGHT STRIP: FLOOR SELECTOR (L1 -> L5)
      ======================================================================== */}
      {mode === "HOMES" && (
        <aside className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2 p-2 rounded-2xl bg-[#182329]/90 backdrop-blur-md border border-white/10 shadow-2xl">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 py-1">
            TẦNG
          </span>
          {[5, 4, 3, 2, 1].map((f) => {
            const isActive = selectedFloor === f;
            return (
              <button
                key={f}
                onClick={() => {
                  setSelectedFloor(f);
                  setSelectedUnit(null);
                }}
                className={`size-11 rounded-xl text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-950/60 scale-105 border border-emerald-400"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                L{f}
              </button>
            );
          })}
        </aside>
      )}

      {/* =======================================================================
          3. COMPASS WIDGET & CONTROLS (Top Left & Bottom Right)
      ======================================================================== */}
      <div className="absolute top-24 left-6 z-20 pointer-events-none">
        <div className="size-14 rounded-full bg-[#182329]/80 backdrop-blur-md border border-white/10 flex flex-col items-center justify-center shadow-lg">
          <Compass className="size-6 text-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold text-slate-300 tracking-wider">BẮC</span>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-full bg-[#182329]/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 flex items-center gap-2 shadow-lg">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          Kéo chuột để xoay 3D • Cuộn để phóng to/thu nhỏ
        </div>
      </div>

      {/* =======================================================================
          4. 3D WEBGL THREE.JS CANVAS
      ======================================================================== */}
      <Property3DScene
        mode={mode}
        selectedFloor={selectedFloor}
        units={building.units}
        rooftopHotspots={building.rooftopHotspots}
        streetHotspots={building.streetHotspots}
        selectedUnitId={selectedUnit?.id ?? null}
        hoveredUnitId={hoveredUnitId}
        onSelectUnit={handleSelectUnit}
        onHoverUnit={setHoveredUnitId}
        onSelectHotspot={handleSelectHotspot}
        onUpdateScreenPositions={setScreenPositions}
      />

      {/* =======================================================================
          5. 2D INTERACTIVE PIN OVERLAYS (PROJECTED FROM 3D COORDINATES)
      ======================================================================== */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {screenPositions.map((item) => {
          if (!item.visible) return null;

          // A. Unit Pin (HOMES mode)
          if (mode === "HOMES") {
            const unit = currentFloorUnits.find((u) => u.id === item.id);
            if (!unit) return null;

            const isSelected = selectedUnit?.id === unit.id;
            const isHovered = hoveredUnitId === unit.id;

            return (
              <div
                key={unit.id}
                style={{
                  transform: `translate3d(${item.x}px, ${item.y}px, 0) translate(-50%, -100%)`,
                }}
                className="absolute pointer-events-auto transition-transform duration-75"
              >
                {/* Pin Badge */}
                <button
                  type="button"
                  onClick={() => handleSelectUnit(unit)}
                  onMouseEnter={() => setHoveredUnitId(unit.id)}
                  onMouseLeave={() => setHoveredUnitId(null)}
                  className={`group relative flex items-center justify-center rounded-full font-extrabold shadow-2xl transition-all cursor-pointer ${
                    isSelected
                      ? "size-10 bg-emerald-500 text-white scale-110 ring-4 ring-emerald-400/50"
                      : isHovered
                      ? "size-9 bg-sky-500 text-white scale-105 ring-2 ring-sky-300"
                      : "size-8 bg-[#182329]/90 hover:bg-emerald-600 text-white border border-white/20"
                  }`}
                >
                  <span className="text-[11px] tracking-tight">{unit.unitNumber}</span>

                  {/* Pulsing ring */}
                  {unit.status === "AVAILABLE" && (
                    <span className="absolute -inset-1 rounded-full border border-emerald-400/50 animate-ping pointer-events-none" />
                  )}
                </button>

                {/* Hover Preview Card Tooltip */}
                {isHovered && !isSelected && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-3 rounded-xl bg-[#182329]/95 backdrop-blur-lg border border-white/15 shadow-2xl text-left pointer-events-none z-40 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
                        Phòng {unit.unitNumber}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          unit.status === "AVAILABLE"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {unit.status === "AVAILABLE" ? "CÒN TRỐNG" : "ĐÃ THUÊ"}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-white truncate">{unit.title}</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {measurement === "M2" ? `${unit.areaM2} m²` : `${unit.areaFt2} ft²`} • {unit.facing}
                    </p>
                    <p className="text-xs font-extrabold text-emerald-400 mt-1.5">
                      {formatCurrency(unit.priceMonthly)}/tháng
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                      <span>Bấm để xem chi tiết</span>
                      <ChevronRight className="size-3" />
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // B. Hotspot Pin (ROOFTOP & STREET mode)
          const hotspot =
            mode === "ROOFTOP"
              ? building.rooftopHotspots.find((h) => h.id === item.id)
              : building.streetHotspots.find((h) => h.id === item.id);

          if (!hotspot) return null;
          const isHotspotActive = selectedHotspot?.id === hotspot.id;

          return (
            <div
              key={hotspot.id}
              style={{
                transform: `translate3d(${item.x}px, ${item.y}px, 0) translate(-50%, -50%)`,
              }}
              className="absolute pointer-events-auto"
            >
              <button
                type="button"
                onClick={() => handleSelectHotspot(hotspot)}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-xl transition-all cursor-pointer ${
                  isHotspotActive
                    ? "bg-emerald-500 text-white border-emerald-300 scale-105"
                    : "bg-[#182329]/90 hover:bg-white/20 text-white border-white/20"
                }`}
              >
                <Sparkles className="size-3.5 text-emerald-400" />
                <span className="text-[11px] font-bold whitespace-nowrap">{hotspot.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* =======================================================================
          6. BOTTOM SUMMARY BAR (Matches Video Footer)
      ======================================================================== */}
      {selectedUnit && mode === "HOMES" && (
        <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-4xl p-3.5 rounded-2xl bg-[#182329]/95 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-6 duration-200">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedUnit(null)}
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              &larr; ĐÓNG
            </button>
            <div className="h-6 w-px bg-white/15" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white">
                  Phòng {selectedUnit.unitNumber} • {selectedUnit.title}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                  {selectedUnit.status === "AVAILABLE" ? "CÒN TRỐNG" : "ĐÃ THUÊ"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {measurement === "M2" ? `${selectedUnit.areaM2} m²` : `${selectedUnit.areaFt2} ft²`} • Tầng{" "}
                {selectedUnit.floor} • {selectedUnit.facing} • Giá:{" "}
                <strong className="text-emerald-400">{formatCurrency(selectedUnit.priceMonthly)}/tháng</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIs360ModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="size-3.5 text-sky-400" />
              THAM QUAN 360°
            </button>

            <Link href={`/rooms/${selectedUnit.id}/book-viewing`}>
              <button className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition-all cursor-pointer">
                <CalendarDays className="size-3.5" />
                ĐẶT LỊCH XEM
              </button>
            </Link>
          </div>
        </footer>
      )}

      {/* Bottom info banner for ROOFTOP & STREET hotspots */}
      {selectedHotspot && (mode === "ROOFTOP" || mode === "STREET") && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xl p-4 rounded-2xl bg-[#182329]/95 backdrop-blur-xl border border-white/15 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <h4 className="text-sm font-bold text-white">{selectedHotspot.label}</h4>
            </div>
            <button
              onClick={() => setSelectedHotspot(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-emerald-300 font-semibold mb-1">{selectedHotspot.sublabel}</p>
          <p className="text-xs text-slate-300 leading-relaxed">{selectedHotspot.description}</p>
        </div>
      )}

      {/* =======================================================================
          7. LEFT SLIDE-OUT UNIT DETAIL DRAWER (Matches Video Modal)
      ======================================================================== */}
      {selectedUnit && mode === "HOMES" && (
        <aside className="absolute top-20 left-6 bottom-24 z-30 w-96 rounded-3xl bg-[#141e23]/95 backdrop-blur-2xl border border-white/15 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-left duration-300">
          {/* Drawer Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
                HOME {selectedUnit.unitNumber} · LEVEL {selectedUnit.floor}
              </p>
              <h3 className="text-base font-bold text-white truncate mt-0.5">{selectedUnit.title}</h3>
            </div>
            <button
              onClick={() => setSelectedUnit(null)}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {/* Main Image & Carousel */}
            <div className="space-y-2">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/10 group">
                <img
                  src={selectedUnit.images[activeImageIndex] || selectedUnit.images[0]}
                  alt={selectedUnit.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
                  {activeImageIndex + 1}/{selectedUnit.images.length}
                </div>
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-4 gap-2">
                {selectedUnit.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-video rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      activeImageIndex === idx ? "border-emerald-400 scale-95" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Key Specs Grid (Matches Video Layout) */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">DIỆN TÍCH</span>
                <p className="text-sm font-extrabold text-white mt-0.5">
                  {measurement === "M2" ? `${selectedUnit.areaM2} m²` : `${selectedUnit.areaFt2} ft²`}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">HƯỚNG NHÌN</span>
                <p className="text-sm font-extrabold text-white mt-0.5 truncate">{selectedUnit.facing}</p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase text-slate-400">TẦNG</span>
                <p className="text-sm font-extrabold text-white mt-0.5">Tầng {selectedUnit.floor}</p>
              </div>
              <div className="pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase text-slate-400">LOẠI GIƯỜNG</span>
                <p className="text-sm font-extrabold text-white mt-0.5 truncate">{selectedUnit.bedType}</p>
              </div>
            </div>

            {/* Price Box */}
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-400">GIÁ THUÊ NIÊM YẾT</span>
                <p className="text-lg font-black text-white">{formatCurrency(selectedUnit.priceMonthly)}/tháng</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400">Tiền cọc</span>
                <p className="text-xs font-bold text-slate-300">{formatCurrency(selectedUnit.depositAmount)}</p>
              </div>
            </div>

            {/* Amenities Checklist */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                TIỆN NGHI CAO CẤP
              </h4>
              <div className="grid grid-cols-1 gap-1.5">
                {selectedUnit.amenities.map((amenity, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-300 text-xs">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                MÔ TẢ KHÔNG GIAN
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedUnit.description}</p>
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-white/10 space-y-2 bg-[#0f171a]/80">
            <Link href={`/rooms/${selectedUnit.id}/book-viewing`} className="block">
              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-extrabold text-xs text-white shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer">
                <CalendarDays className="size-4" />
                ĐẶT LỊCH XEM PHÒNG TRỰC TIẾP
              </button>
            </Link>

            <Link href={`/rooms/${selectedUnit.id}/apply`} className="block">
              <button className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 font-bold text-xs text-white flex items-center justify-center gap-2 transition-colors cursor-pointer">
                <FileCheck className="size-4 text-emerald-400" />
                GỬI YÊU CẦU THUÊ PHÒNG (KYC)
              </button>
            </Link>
          </div>
        </aside>
      )}

      {/* =======================================================================
          8. 360° PANORAMIC WALK-THROUGH MODAL ("WALK INSIDE")
      ======================================================================== */}
      {is360ModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl rounded-3xl overflow-hidden bg-[#182329] border border-white/20 shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="size-5 text-emerald-400" />
                <h3 className="font-extrabold text-white text-base">
                  THAM QUAN 360° · PHÒNG {selectedUnit.unitNumber}
                </h3>
              </div>
              <button
                onClick={() => setIs360ModalOpen(false)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
              <img
                src={selectedUnit.images[0]}
                alt="360 view"
                className="w-full h-full object-cover scale-110 filter brightness-95"
              />
              <div className="absolute inset-0 bg-radial from-transparent to-black/60 pointer-events-none" />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white flex items-center gap-2">
                <RotateCcw className="size-3.5 text-emerald-400 animate-spin" />
                Chế độ tham quan ảo 360° tương tác toàn cảnh
              </div>
            </div>

            <div className="p-4 flex items-center justify-between text-xs">
              <p className="text-slate-300">
                Bạn đang xem hình ảnh không gian thực tế căn hộ {selectedUnit.unitNumber} tại tầng {selectedUnit.floor}.
              </p>
              <Link href={`/rooms/${selectedUnit.id}/book-viewing`}>
                <button className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 font-bold text-white cursor-pointer">
                  Hẹn xem phòng thực tế
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          9. CONTACT LEASING MODAL
      ======================================================================== */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#182329] border border-white/20 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">LIÊN HỆ BỘ PHẬN CHO THUÊ</h3>
              <button
                onClick={() => setContactModalOpen(false)}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase">HOTLINE HỖ TRỢ</span>
                <p className="text-base font-bold text-white">090 123 4567 • 091 234 5678</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase">GIỜ LÀM VIỆC</span>
                <p className="font-semibold text-white">Thứ Hai – Chủ Nhật: 08:00 – 21:00</p>
                <p className="text-[11px] text-slate-400">Xem phòng cả ngày nghỉ và buổi tối.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-400 shrink-0" />
                <p className="text-[11px] text-emerald-200">
                  Thuê trực tiếp từ ban quản lý tòa nhà, không qua trung gian, miễn 100% phí môi giới.
                </p>
              </div>
            </div>

            <button
              onClick={() => setContactModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
