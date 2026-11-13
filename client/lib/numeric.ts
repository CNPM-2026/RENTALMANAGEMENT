/**
 * Nhập số / tiền ở client (Batch 7).
 *
 * `type="number"` + `Number(e.target.value)` có hai lỗi thực tế:
 *  - `Number('') === 0`: xoá trắng ô nhập rồi gửi form sẽ âm thầm gửi 0;
 *  - `Number('1.234,5')` / `Number('12,5')` là `NaN`, và `step=1` mặc định chặn
 *    số thập phân trên một số trình duyệt.
 *
 * Các hàm dưới đây giữ NGUYÊN chuỗi người dùng nhập (state là string), chỉ trả
 * `number` khi chuỗi thực sự hợp lệ, và trả `null` cho "rỗng/không hợp lệ" —
 * nơi gọi phải tự quyết định báo lỗi, không được coi `null` là 0.
 */

/** Chuỗi được phép tồn tại trong ô nhập (cho phép dở dang khi đang gõ). */
export const DECIMAL_INPUT_PATTERN = /^\d*(?:[.,]\d{0,2})?$/;

/** Lọc ký tự khi gõ: chỉ số và tối đa một dấu thập phân (`.` hoặc `,`). */
export function sanitizeDecimalInput(raw: string, maxDecimals = 2): string {
  const normalized = raw.replace(/[^\d.,]/g, '').replace(',', '.');
  const [whole, ...rest] = normalized.split('.');
  if (rest.length === 0) return whole;
  const fraction = rest.join('').slice(0, maxDecimals);
  return `${whole}.${fraction}`;
}

/** Số nguyên không âm (chỉ số điện/nước). `null` = rỗng hoặc không hợp lệ. */
export function parseIntegerInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Số thập phân (tiền). Chấp nhận `1.234,5` kiểu Việt Nam và `1234.5` kiểu Anh.
 * Trả `null` thay vì 0 khi rỗng/không hợp lệ.
 */
export function parseDecimalInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  let normalized = trimmed;
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');
  if (hasComma && hasDot) {
    // `1.234,56` (dấu chấm là phân cách nghìn) hoặc `1,234.56` (ngược lại).
    normalized = trimmed.lastIndexOf(',') > trimmed.lastIndexOf('.')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed.replace(/,/g, '');
  } else if (hasComma) {
    normalized = trimmed.replace(',', '.');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Hiển thị số tiền đọc được; `null`/`undefined` -> chuỗi rỗng (không phải 0 đ). */
export function formatMoneyInput(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '';
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return '';
  return `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ`;
}
