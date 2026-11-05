import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isBusy = loading || isLoading;

    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer";

    const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
      primary:
        "bg-[#15594f] text-white hover:bg-[#103f39] focus-visible:ring-[#15594f] shadow-sm active:scale-[0.99]",
      secondary:
        "bg-[#eaf2ed] text-[#15594f] hover:bg-[#d6e6db] focus-visible:ring-[#15594f] active:scale-[0.99]",
      outline:
        "border border-[#e2e7e1] bg-white !text-[#203c37] hover:bg-[#f7f6f2] hover:border-[#cbd5cc] focus-visible:ring-[#15594f] active:scale-[0.99]",
      ghost:
        "text-[#203c37] hover:bg-[#f7f6f2] hover:text-[#15594f] focus-visible:ring-[#15594f]",
      danger:
        "bg-[#991b1b] text-white hover:bg-[#7f1d1d] focus-visible:ring-[#991b1b] shadow-sm active:scale-[0.99]",
    };

    const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-[36px] px-3.5 text-[13px] rounded-[6px] gap-1.5",
      md: "h-[46px] px-5 text-[14px] rounded-[8px] gap-2", // Matches Figma h-[46px] rounded-[8px]
      lg: "h-[52px] px-6 text-[15px] rounded-[8px] gap-2.5",
      icon: "size-[40px] p-0 rounded-[8px] justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isBusy}
        aria-busy={isBusy ? true : undefined}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isBusy ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin size-4 text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Đang xử lý...</span>
          </span>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
