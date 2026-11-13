"use client";

import * as React from "react";
import { sanitizeDecimalInput } from "@/lib/numeric";

type NumericInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Số chữ số thập phân cho phép (0 = chỉ số nguyên). */
  maxDecimals?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Hiển thị viền đỏ khi giá trị hiện tại không hợp lệ. */
  invalid?: boolean;
  onBlur?: () => void;
};

/**
 * Ô nhập số có kiểm soát (Batch 7).
 *
 * Vì sao không dùng `<input type="number">`:
 * - trình duyệt cho phép các trạng thái trung gian kỳ lạ (`e`, `-`, `.`), và
 *   `value` trả về chuỗi rỗng khi người dùng đang gõ dở -> dễ thành 0;
 * - `step` mặc định = 1 khiến số thập phân bị coi là invalid (không submit được);
 * - cuộn chuột trên ô number làm thay đổi giá trị ngoài ý muốn.
 *
 * Ở đây state là CHUỖI, ký tự bị lọc ngay khi gõ, và việc parse nằm ở
 * `@/lib/numeric` (trả `null` thay vì 0).
 */
export function NumericInput({
  value,
  onChange,
  maxDecimals = 2,
  placeholder,
  className,
  disabled,
  id,
  ariaLabel,
  invalid,
  onBlur,
}: NumericInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode={maxDecimals === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      onBlur={onBlur}
      onChange={(event) => onChange(sanitizeDecimalInput(event.target.value, maxDecimals))}
      className={className}
    />
  );
}
