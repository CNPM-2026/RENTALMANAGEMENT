"use client";

import * as React from "react";
import { Zap, Droplets, CalendarDays } from "lucide-react";
import { apiClient } from "@/lib/api";
import { MeterReading, Property, Room } from "@/types/models";
import { NumericInput } from "@/components/ui/numeric-input";
import { parseIntegerInput } from "@/lib/numeric";

type RowInput = {
  electricityStart: string;
  electricityEnd: string;
  waterStart: string;
  waterEnd: string;
};

type RowState = {
  isSaving?: boolean;
  saved?: boolean;
  error?: string;
};

const FIELD_CLASS =
  "w-24 px-2 py-1.5 text-[13px] border border-[#e2e7e1] rounded-[6px] bg-[#f7f6f2] outline-none focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]";

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return "chưa đặt";
  return `${formatNumber(value)} đ`;
}

/** Số nguyên không âm đã parse, hoặc `null` để nơi gọi báo lỗi (KHÔNG coi là 0). */
function toReading(value: string): number | null {
  return parseIntegerInput(value);
}

/**
 * Trang chốt chỉ số điện nước.
 *
 * Hai lỗi cũ được sửa ở đây:
 *  1. `electricityStart`/`waterStart` luôn gửi `0` ⇒ tiêu thụ bị tính lại từ 0
 *     mỗi tháng. Giờ đầu kỳ được điền sẵn từ chỉ số cuối kỳ trước của CHÍNH
 *     phòng đó (server cũng tự suy ra nếu client bỏ trống).
 *  2. `Number('')` ⇒ 0 khi ô nhập trống. Giờ ô nhập là chuỗi + `parseIntegerInput`.
 * Kèm theo: chọn kỳ (tháng/năm), hiện chỉ số kỳ trước và tiêu thụ dự kiến.
 */
export default function LandlordUtilitiesPage() {
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = React.useState<string>("");
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  // 0 = "chưa biết": KHÔNG đọc `new Date()` trong lúc render, vì Next.js
  // prerender Client Component và sẽ chốt cứng thời điểm build.
  const [month, setMonth] = React.useState(0);
  const [year, setYear] = React.useState(0);
  const [previous, setPrevious] = React.useState<Record<string, MeterReading | null>>({});
  const [readings, setReadings] = React.useState<Record<string, RowInput>>({});
  const [rowStates, setRowStates] = React.useState<Record<string, RowState>>({});
  const [loadError, setLoadError] = React.useState("");

  React.useEffect(() => {
    const today = new Date();
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
  }, []);

  React.useEffect(() => {
    apiClient.properties
      .getMyProperties()
      .then((props) => {
        setProperties(props ?? []);
        if (props && props.length > 0) setSelectedPropertyId(props[0].id);
      })
      .catch(() => setLoadError("Không tải được danh sách cơ sở."))
      .finally(() => setIsLoading(false));
  }, []);

  React.useEffect(() => {
    if (!selectedPropertyId) return;
    let isCancelled = false;
    apiClient.rooms
      .getByProperty(selectedPropertyId)
      .then((data) => {
        if (!isCancelled) setRooms(data ?? []);
      })
      .catch(() => {
        if (!isCancelled) setRooms([]);
      });
    return () => {
      isCancelled = true;
    };
  }, [selectedPropertyId]);

  // Nạp chỉ số gần nhất của từng phòng để điền sẵn đầu kỳ và hiện "kỳ trước".
  React.useEffect(() => {
    if (rooms.length === 0) {
      setPrevious({});
      setReadings({});
      return;
    }
    // Chưa biết kỳ hiện tại (đang chờ effect đọc ngày) thì chưa tải.
    if (month === 0 || year === 0) return;
    let isCancelled = false;
    Promise.all(
      rooms.map(async (room) => {
        try {
          const latest = await apiClient.meterReadings.getLatest(room.id);
          return [room.id, latest ?? null] as const;
        } catch {
          return [room.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (isCancelled) return;
      const map: Record<string, MeterReading | null> = {};
      const inputs: Record<string, RowInput> = {};
      for (const [roomId, latest] of entries) {
        map[roomId] = latest;
        inputs[roomId] = {
          electricityStart: latest ? String(latest.electricityEnd) : "0",
          electricityEnd: "",
          waterStart: latest ? String(latest.waterEnd) : "0",
          waterEnd: "",
        };
      }
      setPrevious(map);
      setReadings(inputs);
      setRowStates({});
    });
    return () => {
      isCancelled = true;
    };
  }, [rooms, month, year]);

  const updateField = (roomId: string, key: keyof RowInput, value: string) => {
    setReadings((current) => {
      const existing = current[roomId] ?? {
        electricityStart: "0",
        electricityEnd: "",
        waterStart: "0",
        waterEnd: "",
      };
      return { ...current, [roomId]: { ...existing, [key]: value } };
    });
    setRowStates((current) => ({ ...current, [roomId]: { ...current[roomId], error: undefined, saved: false } }));
  };

  const handleSave = async (room: Room) => {
    const input = readings[room.id];
    if (!input || rowStates[room.id]?.isSaving) return;

    const setError = (message: string) =>
      setRowStates((current) => ({ ...current, [room.id]: { error: message } }));

    const electricityStart = toReading(input.electricityStart);
    const electricityEnd = toReading(input.electricityEnd);
    const waterStart = toReading(input.waterStart);
    const waterEnd = toReading(input.waterEnd);

    if (electricityStart === null || waterStart === null) {
      setError("Chỉ số đầu kỳ phải là số nguyên không âm.");
      return;
    }
    if (electricityEnd === null || waterEnd === null) {
      setError("Nhập đủ chỉ số điện và nước cuối kỳ (số nguyên không âm).");
      return;
    }
    if (electricityEnd < electricityStart) {
      setError("Chỉ số điện cuối kỳ không được nhỏ hơn đầu kỳ.");
      return;
    }
    if (waterEnd < waterStart) {
      setError("Chỉ số nước cuối kỳ không được nhỏ hơn đầu kỳ.");
      return;
    }

    setRowStates((current) => ({ ...current, [room.id]: { isSaving: true } }));
    try {
      const saved = await apiClient.meterReadings.create({
        roomId: room.id,
        month,
        year,
        electricityStart,
        electricityEnd,
        waterStart,
        waterEnd,
      });
      setPrevious((current) => ({ ...current, [room.id]: saved }));
      setRowStates((current) => ({ ...current, [room.id]: { saved: true } }));
      setReadings((current) => ({
        ...current,
        [room.id]: {
          electricityStart: String(saved.electricityEnd),
          electricityEnd: "",
          waterStart: String(saved.waterEnd),
          waterEnd: "",
        },
      }));
    } catch (error) {
      setRowStates((current) => ({
        ...current,
        [room.id]: { error: error instanceof Error ? error.message : "Không lưu được chỉ số." },
      }));
    }
  };

  const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1);
  const yearOptions = year > 0 ? [year - 1, year, year + 1] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[12px] text-[#74817b]">Tài chính</p>
          <h1 className="text-[26px] font-semibold text-[#203c37] mt-0.5">Điện nước &amp; Dịch vụ</h1>
          <p className="text-[14px] text-[#74817b] mt-0.5">
            Chốt chỉ số công tơ theo kỳ. Đầu kỳ được điền sẵn từ chỉ số cuối kỳ trước của cùng phòng.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e2e7e1] shadow-xs">
        <select
          value={selectedPropertyId}
          onChange={(e) => setSelectedPropertyId(e.target.value)}
          className="w-full sm:w-[240px] text-[13px] font-medium text-[#203c37] bg-[#f7f6f2] px-3 py-2 rounded-[7px] border border-[#e2e7e1] outline-none cursor-pointer"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-[13px] text-[#74817b]">
          <CalendarDays className="size-4" />
          <select
            aria-label="Tháng"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-[#f7f6f2] px-2 py-2 rounded-[7px] border border-[#e2e7e1] text-[#203c37] outline-none cursor-pointer"
          >
            {monthOptions.map((option) => (
              <option key={option} value={option}>
                Tháng {option}
              </option>
            ))}
          </select>
          <select
            aria-label="Năm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-[#f7f6f2] px-2 py-2 rounded-[7px] border border-[#e2e7e1] text-[#203c37] outline-none cursor-pointer"
          >
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-[13px] font-medium text-[#991b1b]">
          {loadError}
        </p>
      )}



      {isLoading || month === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 rounded-[10px] bg-white border border-[#e2e7e1] animate-pulse" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-[12px] border border-[#e2e7e1] bg-white p-12 text-center shadow-xs">
          <Zap className="size-12 text-[#9bb5a8] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold text-[#203c37]">Chưa có phòng nào để ghi chỉ số</h3>
        </div>
      ) : (
        <div id="utility-table" className="rounded-[12px] border border-[#e2e7e1] bg-white overflow-x-auto shadow-xs">
          <table className="w-full text-left border-collapse text-[13px] min-w-[980px]">
            <thead>
              <tr className="border-b border-[#e2e7e1] bg-[#f7f6f2] text-[#74817b] text-[12px] font-semibold">
                <th className="py-3 px-4">Số phòng</th>
                <th className="py-3 px-4">Kỳ trước</th>
                <th className="py-3 px-4">Điện đầu kỳ</th>
                <th className="py-3 px-4">Điện cuối kỳ</th>
                <th className="py-3 px-4">Nước đầu kỳ</th>
                <th className="py-3 px-4">Nước cuối kỳ</th>
                <th className="py-3 px-4">Tiêu thụ</th>
                <th className="py-3 px-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3ef] text-[#203c37]">
              {rooms.map((room) => {
                const input = readings[room.id];
                const latest = previous[room.id];
                const state = rowStates[room.id] ?? {};
                const savedThisPeriod = Boolean(latest && latest.month === month && latest.year === year);
                const electricityEnd = input ? toReading(input.electricityEnd) : null;
                const waterEnd = input ? toReading(input.waterEnd) : null;
                const electricityStart = input ? toReading(input.electricityStart) : null;
                const waterStart = input ? toReading(input.waterStart) : null;
                const electricityUsage =
                  electricityEnd !== null && electricityStart !== null && electricityEnd >= electricityStart
                    ? electricityEnd - electricityStart
                    : null;
                const waterUsage =
                  waterEnd !== null && waterStart !== null && waterEnd >= waterStart
                    ? waterEnd - waterStart
                    : null;

                return (
                  <tr key={room.id} className="hover:bg-[#f7f6f2]/60 transition-colors align-top">
                    <td className="py-3.5 px-4">
                      <p className="font-bold">Phòng {room.roomNumber}</p>
                      <p className="text-[11px] text-[#74817b]">
                        {room.status === "RENTED" ? "Đang ở" : "Trống"}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-[12px] text-[#74817b]">
                      {latest ? (
                        <>
                          <p className="font-medium text-[#203c37]">
                            {latest.month}/{latest.year}
                          </p>
                          <p className="inline-flex items-center gap-1">
                            <Zap className="size-3" /> {formatNumber(latest.electricityEnd)} kWh
                          </p>
                          <p className="inline-flex items-center gap-1">
                            <Droplets className="size-3" /> {formatNumber(latest.waterEnd)} m³
                          </p>
                        </>
                      ) : (
                        <span>Chưa có chỉ số</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <NumericInput
                        value={input?.electricityStart ?? ""}
                        onChange={(value) => updateField(room.id, "electricityStart", value)}
                        maxDecimals={0}
                        ariaLabel={`Chỉ số điện đầu kỳ phòng ${room.roomNumber}`}
                        className={FIELD_CLASS}
                        placeholder="0"
                      />
                      <p className="text-[11px] text-[#74817b] mt-1">
                        Đơn giá: {formatCurrency(room.electricityRate)}/kWh
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <NumericInput
                        value={input?.electricityEnd ?? ""}
                        onChange={(value) => updateField(room.id, "electricityEnd", value)}
                        maxDecimals={0}
                        invalid={input?.electricityEnd !== "" && electricityEnd === null}
                        ariaLabel={`Chỉ số điện cuối kỳ phòng ${room.roomNumber}`}
                        className={FIELD_CLASS}
                        placeholder="Số điện mới"
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <NumericInput
                        value={input?.waterStart ?? ""}
                        onChange={(value) => updateField(room.id, "waterStart", value)}
                        maxDecimals={0}
                        ariaLabel={`Chỉ số nước đầu kỳ phòng ${room.roomNumber}`}
                        className={FIELD_CLASS}
                        placeholder="0"
                      />
                      <p className="text-[11px] text-[#74817b] mt-1">
                        Đơn giá: {formatCurrency(room.waterRate)}/m³
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <NumericInput
                        value={input?.waterEnd ?? ""}
                        onChange={(value) => updateField(room.id, "waterEnd", value)}
                        maxDecimals={0}
                        invalid={input?.waterEnd !== "" && waterEnd === null}
                        ariaLabel={`Chỉ số nước cuối kỳ phòng ${room.roomNumber}`}
                        className={FIELD_CLASS}
                        placeholder="Số nước mới"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-[12px]">
                      <p>Điện: {electricityUsage === null ? "—" : `${formatNumber(electricityUsage)} kWh`}</p>
                      <p>Nước: {waterUsage === null ? "—" : `${formatNumber(waterUsage)} m³`}</p>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {savedThisPeriod ? (
                        <span className="inline-block px-3 py-1 rounded-[6px] bg-[#eaf2ed] text-[#15594f] text-[12px] font-semibold">
                          Đã chốt kỳ này
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleSave(room)}
                          disabled={state.isSaving}
                          className="px-3 py-1.5 rounded-[6px] bg-[#15594f] text-white text-[12px] font-medium hover:bg-[#124b42] disabled:opacity-50 cursor-pointer"
                        >
                          {state.isSaving ? "Đang lưu..." : "Lưu"}
                        </button>
                      )}
                      {state.saved && !savedThisPeriod && (
                        <p className="text-[11px] text-[#15594f] mt-1">
                          Đã lưu kỳ {month}/{year}
                        </p>
                      )}
                      {state.error && (
                        <p role="alert" className="text-[11px] text-[#991b1b] mt-1 max-w-[220px] ml-auto">
                          {state.error}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
