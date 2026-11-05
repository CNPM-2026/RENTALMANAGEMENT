import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto border border-[#e2e7e1] rounded-[12px] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03)]">
    <table
      ref={ref}
      className={cn("w-full text-left text-[13px] text-[#203c37]", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("bg-[#f7f6f2] border-b border-[#e2e7e1]", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("divide-y divide-[#e2e7e1] bg-white", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-[#e2e7e1] bg-[#f7f6f2]/60 font-medium text-[#74817b]",
      className
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "transition-colors hover:bg-[#f7f6f2]/70 data-[state=selected]:bg-[#eaf2ed]",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle font-semibold text-[#74817b] text-[12px] uppercase tracking-wider select-none",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle text-[13px] leading-snug", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-[13px] text-[#74817b]", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

export function TableEmpty({
  title = "Không có dữ liệu",
  description = "Chưa có bản ghi nào phù hợp với bộ lọc hiện tại.",
  colSpan = 10,
}: {
  title?: string;
  description?: string;
  colSpan?: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="size-12 rounded-full bg-[#f7f6f2] flex items-center justify-center text-[#74817b]">
            <svg
              className="size-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="2" />
              <line x1="8" y1="21" x2="16" y2="21" strokeWidth="2" />
              <line x1="12" y1="17" x2="12" y2="21" strokeWidth="2" />
            </svg>
          </div>
          <p className="text-[14px] font-semibold text-[#203c37]">{title}</p>
          <p className="text-[12px] text-[#74817b] max-w-sm">{description}</p>
        </div>
      </td>
    </tr>
  );
}

export function TableSkeleton({
  rows = 5,
  colSpan = 5,
}: {
  rows?: number;
  colSpan?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-[#e2e7e1]">
          {Array.from({ length: colSpan }).map((_, j) => (
            <td key={j} className="p-4">
              <div className="h-4 bg-[#e2e7e1]/70 rounded w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
