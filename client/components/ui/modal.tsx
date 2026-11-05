"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for focus restoration upon modal close
    if (typeof document !== "undefined") {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      // Keyboard focus trap: Tab and Shift+Tab focus loop
      if (event.key === "Tab") {
        const container = modalRef.current;
        if (!container) return;

        const focusableElements = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift + Tab: reverse cycle from first to last
          if (
            document.activeElement === firstElement ||
            !container.contains(document.activeElement)
          ) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: cycle from last to first
          if (
            document.activeElement === lastElement ||
            !container.contains(document.activeElement)
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    // Set initial focus to the first focusable element inside the modal
    const focusTimer = setTimeout(() => {
      const container = modalRef.current;
      if (container) {
        const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          container.focus();
        }
      }
    }, 50);

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function"
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity animate-in fade-in duration-200"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-white rounded-[16px] border border-[#e2e7e1] shadow-2xl",
          "flex flex-col max-h-[90vh] overflow-hidden z-10",
          "animate-in zoom-in-95 fade-in duration-150 outline-none",
          sizeStyles[size]
        )}
      >
        {(title || description) && (
          <div className="px-6 py-5 border-b border-[#e2e7e1] flex items-start justify-between gap-4">
            <div className="space-y-1">
              {title && (
                <h3 className="text-[18px] font-semibold text-[#203c37] tracking-tight">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-[13px] text-[#74817b] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="text-[#74817b] hover:text-[#203c37] p-1.5 rounded-[8px] hover:bg-[#f7f6f2] transition-colors cursor-pointer shrink-0"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto text-[14px] text-[#203c37] leading-relaxed flex-1">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-[#e2e7e1] bg-[#f7f6f2]/50 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
