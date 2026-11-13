"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { parseDecimalInput, parseIntegerInput } from "@/lib/numeric";
import { apiClient } from "@/lib/api";
import { Amenity, Room } from "@/types/models";

export type RoomFormMode = "create" | "edit";

interface RoomFormModalProps {
  isOpen: boolean;
  mode: RoomFormMode;
  propertyId: string;
  /** Phòng đang sửa (chỉ dùng khi mode = "edit"). */
  room?: Room | null;
  amenities: Amenity[];
  /** Số người đã xác minh hiện tại — cảnh báo trước khi giảm sức chứa. */
  verifiedOccupants?: number | null;
  onClose: () => void;
  onSaved: (room: Room, mode: RoomFormMode) => void;
}

interface RoomFormState {
  roomNumber: string;
  priceMonthly: string;
  area: string;
  maxOccupants: string;
  electricityRate: string;
  waterRate: string;
  internetFee: string;
  serviceFee: string;
  parkingFee: string;
  amenityIds: string[];
}

const EMPTY_FORM: RoomFormState = {
  roomNumber: "",
  priceMonthly: "",
  area: "",
  maxOccupants: "1",
  electricityRate: "",
  waterRate: "",
  internetFee: "",
  serviceFee: "",
  parkingFee: "",
  amenityIds: [],
};

const MAX_PRICE = 100_000_000;
const FIELD_CLASS =
  "w-full min-h-[44px] px-[14px] py-[10px] bg-white border border-[#e2e7e1] rounded-[8px] text-[14px] text-[#203c37] placeholder:text-[#74817b] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]";

/** Số/chuỗi nullable của API -> chuỗi cho ô nhập; null phải thành "" (không phải "0"). */
function toInputValue(value?: number | string | null): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildFormState(room?: Room | null): RoomFormState {
  if (!room) return { ...EMPTY_FORM };
  return {
    roomNumber: room.roomNumber,
    priceMonthly: toInputValue(room.priceMonthly),
    area: toInputValue(room.area),
    maxOccupants: toInputValue(room.maxOccupants),
    electricityRate: toInputValue(room.electricityRate),
    waterRate: toInputValue(room.waterRate),
    internetFee: toInputValue(room.internetFee),
    serviceFee: toInputValue(room.serviceFee),
    parkingFee: toInputValue(room.parkingFee),
    amenityIds: (room.roomAmenities ?? []).map((item) => item.amenityId),
  };
}

/**
 * Form tạo/sửa phòng dùng chung.
 *
 * Vì sao dùng `NumericInput` thay `<input type="number">`: trình duyệt trả
 * `value === ""` khi đang gõ dở, và `Number("") === 0` biến "không nhập giá
 * điện" thành 0 đ/kWh (hoá đơn ra 0 đồng). Ở đây state là CHUỖI, parse trả
 * `null`, và `null` được xử lý tường minh: bỏ qua khi tạo, "xoá cấu hình" khi sửa.
 */
export function RoomFormModal({
  isOpen,
  mode,
  propertyId,
  room,
  amenities,
  verifiedOccupants,
  onClose,
  onSaved,
}: RoomFormModalProps) {
  const [form, setForm] = React.useState<RoomFormState>(() => buildFormState(room));
  const [error, setError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const update = <K extends keyof RoomFormState>(key: K, value: RoomFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setError("");

    const roomNumber = form.roomNumber.trim();
    if (!roomNumber) {
      setError("Vui lòng nhập số phòng.");
      return;
    }
    if (roomNumber.length > 30) {
      setError("Số phòng tối đa 30 ký tự.");
      return;
    }

    const priceMonthly = parseDecimalInput(form.priceMonthly);
    if (priceMonthly === null) {
      setError("Giá thuê không hợp lệ — chỉ nhập số không âm (ví dụ 3.500.000).");
      return;
    }
    if (priceMonthly >= MAX_PRICE) {
      setError("Giá thuê phải nhỏ hơn 100.000.000.");
      return;
    }

    const area = parseDecimalInput(form.area);
    if (area === null || area <= 0) {
      setError("Diện tích phải là số lớn hơn 0.");
      return;
    }

    const maxOccupants = parseIntegerInput(form.maxOccupants);
    if (maxOccupants === null || maxOccupants < 1 || maxOccupants > 50) {
      setError("Số người tối đa phải là số nguyên từ 1 đến 50.");
      return;
    }
    if (
      typeof verifiedOccupants === "number" &&
      verifiedOccupants > 0 &&
      maxOccupants < verifiedOccupants
    ) {
      setError(
        `Không thể giảm sức chứa xuống ${maxOccupants}: hiện có ${verifiedOccupants} người đã được xác minh.`,
      );
      return;
    }

    const optionalFields = [
      ["electricityRate", "Đơn giá điện"],
      ["waterRate", "Đơn giá nước"],
      ["internetFee", "Phí internet"],
      ["serviceFee", "Phí dịch vụ"],
      ["parkingFee", "Phí gửi xe"],
    ] as const;
    const parsedOptional: Record<string, number | null> = {};
    for (const [key, label] of optionalFields) {
      const raw = form[key];
      if (raw.trim() === "") {
        parsedOptional[key] = null;
        continue;
      }
      const value = parseDecimalInput(raw);
      if (value === null) {
        setError(`${label} không hợp lệ — chỉ nhập số không âm.`);
        return;
      }
      parsedOptional[key] = value;
    }

    setIsSaving(true);
    try {
      const saved =
        mode === "create"
          ? await apiClient.rooms.create({
              propertyId,
              roomNumber,
              priceMonthly,
              area,
              maxOccupants,
              amenityIds: form.amenityIds,
              ...(parsedOptional.electricityRate !== null
                ? { electricityRate: parsedOptional.electricityRate }
                : {}),
              ...(parsedOptional.waterRate !== null ? { waterRate: parsedOptional.waterRate } : {}),
              ...(parsedOptional.internetFee !== null ? { internetFee: parsedOptional.internetFee } : {}),
              ...(parsedOptional.serviceFee !== null ? { serviceFee: parsedOptional.serviceFee } : {}),
              ...(parsedOptional.parkingFee !== null ? { parkingFee: parsedOptional.parkingFee } : {}),
            })
          : await apiClient.rooms.update(room!.id, {
              roomNumber,
              priceMonthly,
              area,
              maxOccupants,
              // `null` = xoá cấu hình phí (khác hẳn 0 đ).
              electricityRate: parsedOptional.electricityRate,
              waterRate: parsedOptional.waterRate,
              internetFee: parsedOptional.internetFee,
              serviceFee: parsedOptional.serviceFee,
              parkingFee: parsedOptional.parkingFee,
              amenityIds: form.amenityIds,
            });
      onSaved(saved, mode);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : mode === "create"
            ? "Không thể tạo phòng."
            : "Không thể cập nhật phòng.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const amountField = (
    key: "electricityRate" | "waterRate" | "internetFee" | "serviceFee" | "parkingFee",
    label: string,
    placeholder: string,
  ) => (
    <label className="space-y-1.5 block">
      <span className="block text-[13px] font-medium text-[#203c37]">{label}</span>
      <NumericInput
        value={form[key]}
        onChange={(value) => update(key, value)}
        placeholder={placeholder}
        invalid={form[key].trim() !== "" && parseDecimalInput(form[key]) === null}
        className={FIELD_CLASS}
      />
    </label>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={mode === "create" ? "Thêm phòng mới" : `Sửa phòng ${room?.roomNumber ?? ""}`}
      description={
        mode === "create"
          ? "Điền giá thuê, đơn giá điện/nước và sức chứa — hoá đơn sẽ dùng đúng các giá trị này."
          : "Đơn giá mới chỉ áp dụng cho hoá đơn tạo SAU khi lưu; hoá đơn đã phát hành giữ nguyên số liệu."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Số phòng"
          required
          value={form.roomNumber}
          onChange={(event) => update("roomNumber", event.target.value)}
          placeholder="Ví dụ: 101"
          maxLength={30}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">
              Giá thuê / tháng <span className="text-[#991b1b]">*</span>
            </span>
            <NumericInput
              value={form.priceMonthly}
              onChange={(value) => update("priceMonthly", value)}
              placeholder="3.500.000"
              invalid={form.priceMonthly.trim() !== "" && parseDecimalInput(form.priceMonthly) === null}
              className={FIELD_CLASS}
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">
              Diện tích (m²) <span className="text-[#991b1b]">*</span>
            </span>
            <NumericInput
              value={form.area}
              onChange={(value) => update("area", value)}
              placeholder="25"
              className={FIELD_CLASS}
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="block text-[13px] font-medium text-[#203c37]">
              Số người tối đa <span className="text-[#991b1b]">*</span>
            </span>
            <NumericInput
              value={form.maxOccupants}
              onChange={(value) => update("maxOccupants", value)}
              maxDecimals={0}
              placeholder="4"
              className={FIELD_CLASS}
            />
            {typeof verifiedOccupants === "number" && verifiedOccupants > 0 && (
              <span className="block text-[12px] text-[#a4422c]">
                Hiện có {verifiedOccupants} người đã xác minh — không thể đặt thấp hơn.
              </span>
            )}
          </label>

          {amountField("electricityRate", "Đơn giá điện (đ/kWh)", "3500")}
          {amountField("waterRate", "Đơn giá nước (đ/m³)", "15000")}
          {amountField("internetFee", "Phí internet / WiFi / tháng", "100000")}
          {amountField("serviceFee", "Phí dịch vụ / tháng", "50000")}
          {amountField("parkingFee", "Phí gửi xe / tháng", "50000")}
        </div>


        {amenities.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-[13px] font-medium text-[#203c37]">Tiện ích phòng</legend>
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((amenity) => (
                <label
                  key={amenity.id}
                  className="flex items-center gap-2 text-[13px] text-[#203c37]"
                >
                  <input
                    type="checkbox"
                    checked={form.amenityIds.includes(amenity.id)}
                    onChange={(event) =>
                      update(
                        "amenityIds",
                        event.target.checked
                          ? [...form.amenityIds, amenity.id]
                          : form.amenityIds.filter((id) => id !== amenity.id),
                      )
                    }
                  />
                  {amenity.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-[8px] border border-[#e2e7e1] text-[13px] font-medium text-[#203c37] hover:bg-[#f7f6f2] disabled:opacity-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2.5 rounded-[8px] bg-[#15594f] text-white text-[13px] font-semibold hover:bg-[#124b42] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? "Đang lưu..." : mode === "create" ? "Thêm phòng" : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

