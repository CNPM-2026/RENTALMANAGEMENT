"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | undefined>(
  undefined
);

function useTabs() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a <Tabs /> provider");
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  value,
  defaultValue = "",
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider
      value={{ value: activeValue, onValueChange: handleValueChange }}
    >
      <div className={cn("w-full space-y-4", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "pill";
}

export function TabsList({
  className,
  variant = "line",
  ...props
}: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        variant === "line" &&
          "flex border-b border-[#e2e7e1] gap-6 overflow-x-auto no-scrollbar",
        variant === "pill" &&
          "inline-flex p-1 bg-[#f7f6f2] rounded-[8px] border border-[#e2e7e1] gap-1",
        className
      )}
      {...props}
    />
  );
}

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  variant?: "line" | "pill";
}

export function TabsTrigger({
  value,
  variant = "line",
  className,
  children,
  ...props
}: TabsTriggerProps) {
  const { value: activeValue, onValueChange } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => onValueChange(value)}
      className={cn(
        "cursor-pointer select-none transition-all duration-150 font-medium",
        variant === "line" && [
          "pb-3 text-[14px] border-b-2 -mb-px whitespace-nowrap",
          isActive
            ? "border-[#15594f] text-[#15594f] font-semibold"
            : "border-transparent text-[#74817b] hover:text-[#203c37]",
        ],
        variant === "pill" && [
          "px-3.5 py-1.5 rounded-[6px] text-[13px] whitespace-nowrap",
          isActive
            ? "bg-white text-[#15594f] font-semibold shadow-sm"
            : "text-[#74817b] hover:text-[#203c37]",
        ],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps) {
  const { value: activeValue } = useTabs();
  if (activeValue !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("animate-in fade-in duration-150 outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
