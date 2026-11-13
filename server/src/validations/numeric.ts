import { z } from 'zod';
import { MoneyInput, minorToNumber, toMinorUnits } from '../utils/money';

/**
 * Số học đầu vào CHẶT (Batch 7).
 *
 * `z.coerce.number()` không phù hợp cho dữ liệu người dùng vì `Number('') === 0`
 * và `Number('   ') === 0`: ô nhập bị xoá trắng sẽ âm thầm thành "0 đồng" /
 * "0 kWh" thay vì báo lỗi. Ở đây:
 *   - `''`/khoảng trắng  -> coi như KHÔNG NHẬP (required sẽ báo lỗi, optional bỏ qua);
 *   - `'abc'`, `'1.2.3'` -> giữ nguyên để `z.number()` từ chối (invalid_type);
 *   - `'1,5'`            -> 1.5 (dấu phẩy thập phân);
 *   - `NaN`/`Infinity`   -> từ chối.
 */

const NUMERIC_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;

const toFiniteNumber = (value: unknown): unknown => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (!NUMERIC_PATTERN.test(trimmed)) return value;
  return Number(trimmed.replace(',', '.'));
};

const toMoneyNumber = (value: unknown): unknown => {
  if (typeof value === 'string' && value.trim() === '') return undefined;
  if (value === null) return undefined;
  const minor = toMinorUnits(value as MoneyInput);
  return minor === null ? value : minorToNumber(minor);
};

export const strictNumber = (message = 'Giá trị phải là số') =>
  z.preprocess(toFiniteNumber, z.number({ message }).finite(message));

export const strictInteger = (message = 'Giá trị phải là số nguyên') =>
  z.preprocess(toFiniteNumber, z.number({ message }).int(message));

/**
 * Tiền: tối đa 2 chữ số thập phân, không âm, có trần. Giá trị trả về là `number`
 * đã chuẩn hoá theo minor units để không mang sai số nhị phân vào DB.
 */
export const strictMoney = ({
  message = 'Số tiền không hợp lệ',
  max = 1_000_000_000,
}: { message?: string; max?: number } = {}) =>
  z.preprocess(
    toMoneyNumber,
    z
      .number({ message })
      .finite(message)
      .min(0, 'Số tiền không được âm')
      .max(max, 'Số tiền vượt quá giới hạn cho phép'),
  );
