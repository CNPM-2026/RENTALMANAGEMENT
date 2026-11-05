import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({
  className,
  variant = "neutral",
  size = "md",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    success: "bg-[#eaf2ed] text-[#15594f] border border-[#d2e4d7]",
    warning: "bg-[#fef3c7] text-[#92400e] border border-[#fde68a]",
    error: "bg-[#fee2e2] text-[#991b1b] border border-[#fecaca]",
    info: "bg-[#e0f2fe] text-[#075985] border border-[#bae6fd]",
    neutral: "bg-[#f2ede3] text-[#74817b] border border-[#e2e7e1]",
  };

  const dotStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
    success: "bg-[#15594f]",
    warning: "bg-[#92400e]",
    error: "bg-[#991b1b]",
    info: "bg-[#075985]",
    neutral: "bg-[#74817b]",
  };

  const sizeStyles: Record<NonNullable<BadgeProps["size"]>, string> = {
    sm: "px-2 py-0.5 text-[11px] font-medium leading-none",
    md: "px-[10px] py-[4px] text-[12px] font-semibold leading-tight",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[100px] shrink-0 select-none tracking-normal",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("size-1.5 rounded-full shrink-0", dotStyles[variant])}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
}
