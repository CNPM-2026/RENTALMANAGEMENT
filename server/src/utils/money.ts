/**
 * Số học TIỀN TỆ an toàn (Batch 7).
 *
 * Vì sao không dùng `number`: `0.1 + 0.2 !== 0.3` và VNĐ có thêm phần lẻ ở
 * nhiều bảng giá (điện 3.500,5 đ/kWh khi chủ trọ cấu hình riêng). Mọi phép tính
 * ở đây chạy trên số nguyên "minor units" (1 đồng = 100 minor) dạng `bigint`,
 * nên không có sai số làm tròn nhị phân và không tràn số với hoá đơn lớn.
 *
 * Quy ước:
 * - Hàm parse trả `null` khi đầu vào KHÔNG hợp lệ. KHÔNG BAO GIỜ trả 0 cho
 *   chuỗi rỗng/`NaN` — "không nhập" và "bằng 0" là hai chuyện khác nhau.
 * - Chỉ chấp nhận tối đa 2 chữ số thập phân (khớp `Decimal(12, 2)`); nhiều hơn
 *   là lỗi dữ liệu, không phải để tự cắt.
 * - Dấu `,` được nhận như dấu thập phân **chỉ khi** nó không thể là dấu phân
 *   cách hàng nghìn (tức là theo sau có 1–2 chữ số). `"1,000"` bị coi là không
 *   hợp lệ thay vì đoán thành 1 hoặc 1000.
 */

const MINOR_PER_UNIT = 100n;

/** Trần tiền của hệ thống (10^11 đồng) — khớp `Decimal(12, 2)`. */
export const MAX_MONEY_MINOR = 10_000_000_000_000n;

const DECIMAL_PATTERN = /^([+-])?(\d+)(?:([.,])(\d{1,2}))?$/;

export type MoneyInput = string | number | null | undefined;

/**
 * Chuyển đầu vào (số hoặc chuỗi) thành minor units.
 * Trả `null` nếu rỗng/không parse được/vượt trần.
 */
export const toMinorUnits = (value: MoneyInput): bigint | null => {
  if (value === null || value === undefined) return null;

  let raw: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    raw = value.toString();
  } else if (typeof value === 'string') {
    raw = value.trim();
  } else {
    return null;
  }
  if (raw === '') return null;

  const match = DECIMAL_PATTERN.exec(raw.replace(/\s/g, ''));
  if (!match) return null;

  const [, sign, whole, , fraction = ''] = match;
  const normalized = BigInt(whole) * MINOR_PER_UNIT + BigInt(fraction.padEnd(2, '0'));
  const minor = sign === '-' ? -normalized : normalized;
  return minor > MAX_MONEY_MINOR || minor < -MAX_MONEY_MINOR ? null : minor;
};

/** `bigint` minor units -> chuỗi thập phân 2 chữ số (dùng cho Prisma Decimal). */
export const minorToDecimalString = (minor: bigint): string => {
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const whole = absolute / MINOR_PER_UNIT;
  const fraction = absolute % MINOR_PER_UNIT;
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`;
};

/** `bigint` minor units -> số (chỉ dùng để hiển thị/so sánh, không để tính tiếp). */
export const minorToNumber = (minor: bigint): number => Number(minorToDecimalString(minor));

/** Nhân đơn giá với một số lượng NGUYÊN (kWh, m³, tháng) — làm tròn half-up. */
export const multiplyByIntegerQuantity = (unitPriceMinor: bigint, quantity: number): bigint | null => {
  if (!Number.isInteger(quantity) || quantity < 0) return null;
  return unitPriceMinor * BigInt(quantity);
};

/**
 * Nhân với số lượng THẬP PHÂN (ví dụ diện tích, số tháng lẻ) — làm tròn half-up
 * về minor kế tiếp để không mất tiền của chủ trọ.
 */
export const multiplyByDecimalQuantity = (unitPriceMinor: bigint, quantity: MoneyInput): bigint | null => {
  const quantityMinor = toMinorUnits(quantity);
  if (quantityMinor === null || quantityMinor < 0n) return null;
  const product = unitPriceMinor * quantityMinor;
  return (product + MINOR_PER_UNIT / 2n) / MINOR_PER_UNIT;
};

/** Cộng các khoản tiền; trả `null` nếu có khoản không hợp lệ. */
export const sumMoney = (values: MoneyInput[]): bigint | null => {
  let total = 0n;
  for (const value of values) {
    const minor = toMinorUnits(value);
    if (minor === null) return null;
    total += minor;
  }
  return total;
};

/** Định dạng VNĐ để hiển thị (dấu chấm phân cách hàng nghìn, không có phần lẻ 00). */
export const formatVnd = (minor: bigint): string => {
  const amount = minorToNumber(minor);
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;
};
