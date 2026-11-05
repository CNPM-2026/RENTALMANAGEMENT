import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium text-[#203c37]"
          >
            {label}
            {props.required && <span className="text-[#991b1b] ml-1">*</span>}
          </label>
        )}

        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#74817b]">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            disabled={disabled}
            className={cn(
              "w-full min-h-[48px] px-[14px] py-[12px] bg-white border border-[#e2e7e1] rounded-[8px]",
              "text-[14px] text-[#203c37] placeholder:text-[#74817b]",
              "outline-none transition-colors duration-150",
              "focus:border-[#15594f] focus:ring-1 focus:ring-[#15594f]",
              Boolean(leftIcon) && "pl-10",
              Boolean(rightIcon) && "pr-10",
              Boolean(error) &&
                "border-[#991b1b] text-[#991b1b] focus:border-[#991b1b] focus:ring-[#991b1b]",
              Boolean(disabled) && "bg-[#f7f6f2] text-[#74817b] cursor-not-allowed",
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#74817b]">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-[12px] text-[#991b1b] font-medium flex items-center gap-1">
            <svg
              className="size-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            {error}
          </p>
        )}

        {!error && helperText && (
          <p className="text-[12px] text-[#74817b]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
