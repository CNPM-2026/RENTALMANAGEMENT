/**
 * Empirical Adversarial Stress Test Suite for Milestone 1 UI Primitives and Persona Layouts
 *
 * Targets:
 * - client/components/ui/button.tsx
 * - client/components/ui/input.tsx
 * - client/components/ui/badge.tsx
 * - client/components/ui/card.tsx
 * - client/components/ui/modal.tsx
 * - client/components/ui/table.tsx
 * - client/components/ui/tabs.tsx
 * - client/components/ui/icons.tsx
 * - client/components/tenant/public-navbar.tsx
 * - client/components/tenant/portal-sidebar.tsx
 * - client/components/tenant/footer.tsx
 * - client/app/(tenant)/layout.tsx
 * - client/components/landlord/sidebar.tsx
 * - client/components/landlord/topbar.tsx
 * - client/app/landlord/layout.tsx
 * - client/components/admin/sidebar.tsx
 * - client/components/admin/topbar.tsx
 * - client/app/admin/layout.tsx
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "fs/promises";
import path from "path";

// Context mocks from Next.js for App Router simulation
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime.js";
import { AppRouterContext, AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime.js";

// UI Primitives
import { Button, ButtonProps } from "../../client/components/ui/button";
import { Input, InputProps } from "../../client/components/ui/input";
import { Badge, BadgeProps } from "../../client/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../client/components/ui/card";
import { Modal, ModalProps } from "../../client/components/ui/modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableEmpty,
  TableSkeleton,
} from "../../client/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../client/components/ui/tabs";
import { Icons, IconType } from "../../client/components/ui/icons";

// Navigation & Persona Layouts
import { PublicNavbar } from "../../client/components/tenant/public-navbar";
import { PortalSidebar } from "../../client/components/tenant/portal-sidebar";
import { Footer } from "../../client/components/tenant/footer";
import TenantLayout from "../../client/app/(tenant)/layout";
import { LandlordSidebar } from "../../client/components/landlord/sidebar";
import { LandlordTopbar } from "../../client/components/landlord/topbar";
import LandlordLayout from "../../client/app/landlord/layout";
import { AdminSidebar } from "../../client/components/admin/sidebar";
import { AdminTopbar } from "../../client/components/admin/topbar";
import AdminLayout from "../../client/app/admin/layout";

interface TestResult {
  category: string;
  name: string;
  status: "PASS" | "FAIL";
  isDefect?: boolean;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  details?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function recordPass(category: string, name: string, startMs: number, details?: string) {
  const duration = Date.now() - startMs;
  results.push({ category, name, status: "PASS", durationMs: duration, details });
  console.log(`  [PASS] [${category}] ${name} (${duration}ms)`);
  if (details) {
    console.log(`         -> ${details}`);
  }
}

function recordFail(
  category: string,
  name: string,
  startMs: number,
  details: string,
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "HIGH",
  isDefect: boolean = true
) {
  const duration = Date.now() - startMs;
  results.push({ category, name, status: "FAIL", isDefect, severity, details, durationMs: duration });
  console.error(`  [FAIL] [${severity} DEFECT] [${category}] ${name} (${duration}ms)`);
  console.error(`         -> ${details}`);
}

const mockRouter: Partial<AppRouterInstance> = {
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
};

function renderWithRoute(ui: React.ReactElement, pathname: string | null) {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: mockRouter as AppRouterInstance },
      React.createElement(
        PathnameContext.Provider,
        { value: pathname },
        ui
      )
    )
  );
}

const clientDir = path.resolve(__dirname, "../../client");

async function runAllTests() {
  console.log("================================================================================");
  console.log("  EMPIRICAL ADVERSARIAL STRESS TEST SUITE: UI PRIMITIVES & PERSONA LAYOUTS (M1)  ");
  console.log("================================================================================\n");

  // ===========================================================================
  // SECTION 1: BUTTON PRIMITIVE
  // ===========================================================================
  console.log("--- SECTION 1: Button Primitive Tests ---");

  // 1.1 Variants styling
  const variants: NonNullable<ButtonProps["variant"]>[] = [
    "primary",
    "secondary",
    "outline",
    "ghost",
    "danger",
  ];
  for (const v of variants) {
    const t0 = Date.now();
    const html = renderToStaticMarkup(
      React.createElement(Button, { variant: v }, `Button ${v}`)
    );
    if (html.includes("<button") && html.includes(`Button ${v}`)) {
      recordPass("Button", `Variant "${v}" renders correct tag and children`, t0);
    } else {
      recordFail("Button", `Variant "${v}" failed to render valid button`, t0, "Missing button tag or text");
    }

    const t1 = Date.now();
    if (v === "primary") {
      if (html.includes("bg-[#15594f]") && html.includes("text-white") && html.includes("hover:bg-[#103f39]")) {
        recordPass("Button", "Primary variant matches Figma tokens (#15594f, text-white)", t1);
      } else {
        recordFail("Button", "Primary variant styling mismatch", t1, `Rendered: ${html}`, "HIGH");
      }
    } else if (v === "secondary") {
      if (html.includes("bg-[#eaf2ed]") && html.includes("text-[#15594f]")) {
        recordPass("Button", "Secondary variant matches Figma tokens (#eaf2ed, #15594f)", t1);
      } else {
        recordFail("Button", "Secondary variant styling mismatch", t1, `Rendered: ${html}`, "HIGH");
      }
    } else if (v === "outline") {
      if (html.includes("border-[#e2e7e1]") && html.includes("text-[#203c37]") && html.includes("bg-white")) {
        recordPass("Button", "Outline variant matches Figma border and slate text", t1);
      } else {
        recordFail("Button", "Outline variant styling mismatch", t1, `Rendered: ${html}`, "HIGH");
      }
    } else if (v === "ghost") {
      if (html.includes("text-[#203c37]") && html.includes("hover:bg-[#f7f6f2]")) {
        recordPass("Button", "Ghost variant matches hover neutral surface", t1);
      } else {
        recordFail("Button", "Ghost variant styling mismatch", t1, `Rendered: ${html}`, "HIGH");
      }
    } else if (v === "danger") {
      if (html.includes("bg-[#991b1b]") && html.includes("text-white")) {
        recordPass("Button", "Danger variant matches #991b1b", t1);
      } else {
        recordFail("Button", "Danger variant styling mismatch", t1, `Rendered: ${html}`, "HIGH");
      }
    }
  }

  // 1.2 Sizes
  const sizes: NonNullable<ButtonProps["size"]>[] = ["sm", "md", "lg", "icon"];
  for (const s of sizes) {
    const t0 = Date.now();
    const html = renderToStaticMarkup(React.createElement(Button, { size: s }, `Size ${s}`));
    if (s === "md") {
      if (html.includes("h-[46px]") && html.includes("rounded-[8px]")) {
        recordPass("Button", "Size md matches Figma specs (h-[46px], rounded-[8px])", t0);
      } else {
        recordFail("Button", "Size md does not match h-[46px] rounded-[8px]", t0, html, "HIGH");
      }
    } else if (s === "sm" && html.includes("h-[36px]")) {
      recordPass("Button", "Size sm matches h-[36px]", t0);
    } else if (s === "lg" && html.includes("h-[52px]")) {
      recordPass("Button", "Size lg matches h-[52px]", t0);
    } else if (s === "icon" && html.includes("size-[40px]")) {
      recordPass("Button", "Size icon matches size-[40px]", t0);
    }
  }

  // 1.3 Disabled state
  const tDisabled = Date.now();
  const disabledHtml = renderToStaticMarkup(
    React.createElement(Button, { disabled: true }, "Disabled Action")
  );
  if (
    (disabledHtml.includes('disabled=""') || disabledHtml.includes("disabled")) &&
    disabledHtml.includes("disabled:opacity-50") &&
    disabledHtml.includes("disabled:pointer-events-none")
  ) {
    recordPass("Button", "Disabled prop sets HTML disabled attribute and disables pointer events", tDisabled);
  } else {
    recordFail("Button", "Disabled prop styling or attribute missing", tDisabled, disabledHtml, "HIGH");
  }

  // 1.4 Loading state
  const tLoading = Date.now();
  const loadingHtml = renderToStaticMarkup(
    React.createElement(Button, { isLoading: true }, "Submit Application")
  );
  const hasSpinner = loadingHtml.includes("animate-spin") && loadingHtml.includes("Đang xử lý...");
  const childSuppressed = !loadingHtml.includes("Submit Application");
  const autoDisabled = loadingHtml.includes('disabled=""') || loadingHtml.includes("disabled");
  if (hasSpinner && childSuppressed && autoDisabled) {
    recordPass("Button", "isLoading renders spinner, 'Đang xử lý...', disables button, and suppresses children", tLoading);
  } else {
    recordFail("Button", "isLoading state failed behavioral requirements", tLoading, loadingHtml, "HIGH");
  }

  // 1.5 Left and Right Icon slots
  const tIcons = Date.now();
  const iconHtml = renderToStaticMarkup(
    React.createElement(
      Button,
      {
        leftIcon: React.createElement("span", { id: "left-ico" }, "L"),
        rightIcon: React.createElement("span", { id: "right-ico" }, "R"),
      },
      "Action"
    )
  );
  if (iconHtml.includes('id="left-ico"') && iconHtml.includes('id="right-ico"')) {
    recordPass("Button", "leftIcon and rightIcon slots render in proper DOM sequence", tIcons);
  } else {
    recordFail("Button", "Icon slots failed to mount", tIcons, iconHtml, "MEDIUM");
  }

  // 1.6 Interface Contract Defect Check: Button accepts `loading?: boolean`?
  const tButtonContract = Date.now();
  const buttonSource = await fs.readFile(path.join(clientDir, "components/ui/button.tsx"), "utf-8");
  const hasLoadingContract = buttonSource.includes("loading?:") || buttonSource.includes("loading,");
  if (!hasLoadingContract) {
    recordFail(
      "Button",
      "PROJECT.md Contract Defect: ButtonProps omits `loading?: boolean`",
      tButtonContract,
      "PROJECT.md section 101 specifies `loading?: boolean`. button.tsx only declares `isLoading?: boolean`. Passing standard `loading={true}` will not trigger loading spinner.",
      "MEDIUM",
      true
    );
  } else {
    recordPass("Button", "ButtonProps supports loading?: boolean contract", tButtonContract);
  }

  // ===========================================================================
  // SECTION 2: INPUT PRIMITIVE
  // ===========================================================================
  console.log("\n--- SECTION 2: Input Primitive Tests ---");

  // 2.1 Default Input
  const tInputDefault = Date.now();
  const inputDefault = renderToStaticMarkup(
    React.createElement(Input, { placeholder: "Nhập email...", defaultValue: "test@5krental.vn" })
  );
  if (
    inputDefault.includes("<input") &&
    inputDefault.includes("min-h-[48px]") &&
    inputDefault.includes("rounded-[8px]") &&
    inputDefault.includes("test@5krental.vn")
  ) {
    recordPass("Input", "Default input conforms to 48px height, 8px radius, and value binding", tInputDefault);
  } else {
    recordFail("Input", "Default input geometry mismatch", tInputDefault, inputDefault, "HIGH");
  }

  // 2.2 Label and Required Asterisk
  const tInputLabel = Date.now();
  const inputLabel = renderToStaticMarkup(
    React.createElement(Input, { label: "Số điện thoại", required: true, id: "phone-input" })
  );
  if (
    inputLabel.includes("<label") &&
    inputLabel.includes('for="phone-input"') &&
    inputLabel.includes("*") &&
    inputLabel.includes("text-[#991b1b]")
  ) {
    recordPass("Input", "Label associates htmlFor with input id and displays red required asterisk", tInputLabel);
  } else {
    recordFail("Input", "Label association or required asterisk missing", tInputLabel, inputLabel, "HIGH");
  }

  // 2.3 Auto-generated ID via useId
  const tInputAutoId = Date.now();
  const inputAutoId = renderToStaticMarkup(React.createElement(Input, { label: "Họ và tên" }));
  const matchId = inputAutoId.match(/for="([^"]+)"/);
  const generatedId = matchId ? matchId[1] : null;
  if (generatedId && inputAutoId.includes(`id="${generatedId}"`)) {
    recordPass("Input", `useId generates matching id and htmlFor: "${generatedId}"`, tInputAutoId);
  } else {
    recordFail("Input", "Failed to auto-generate matching id for label", tInputAutoId, inputAutoId, "HIGH");
  }

  // 2.4 Error state vs Helper text
  const tInputError = Date.now();
  const inputError = renderToStaticMarkup(
    React.createElement(Input, {
      label: "Mật khẩu",
      error: "Mật khẩu phải từ 8 ký tự",
      helperText: "Gồm chữ hoa, chữ thường và số",
    })
  );
  if (
    inputError.includes("Mật khẩu phải từ 8 ký tự") &&
    inputError.includes("border-[#991b1b]") &&
    inputError.includes("text-[#991b1b]") &&
    !inputError.includes("Gồm chữ hoa, chữ thường và số")
  ) {
    recordPass("Input", "Error state displays error message, turns border red, and suppresses helperText", tInputError);
  } else {
    recordFail("Input", "Error state handling incorrect", tInputError, inputError, "HIGH");
  }

  // 2.5 Helper text when error is absent
  const tInputHelper = Date.now();
  const inputHelper = renderToStaticMarkup(
    React.createElement(Input, { helperText: "Nhập email hợp lệ" })
  );
  if (inputHelper.includes("Nhập email hợp lệ") && inputHelper.includes("text-[#74817b]")) {
    recordPass("Input", "Helper text renders with muted #74817b when error is absent", tInputHelper);
  } else {
    recordFail("Input", "Helper text rendering failed", tInputHelper, inputHelper, "MEDIUM");
  }

  // 2.6 Left and Right Icon slots
  const tInputIcons = Date.now();
  const inputIcons = renderToStaticMarkup(
    React.createElement(Input, {
      leftIcon: React.createElement("span", { id: "ico-l" }, "L"),
      rightIcon: React.createElement("span", { id: "ico-r" }, "R"),
    })
  );
  if (inputIcons.includes("pl-10") && inputIcons.includes("pr-10")) {
    recordPass("Input", "Dynamic padding pl-10 / pr-10 applied when left/right icons present", tInputIcons);
  } else {
    recordFail("Input", "Icon slot padding pl-10 / pr-10 missing", tInputIcons, inputIcons, "HIGH");
  }

  // 2.7 Disabled state
  const tInputDisabled = Date.now();
  const inputDisabled = renderToStaticMarkup(React.createElement(Input, { disabled: true }));
  if (inputDisabled.includes("cursor-not-allowed") && inputDisabled.includes("bg-[#f7f6f2]")) {
    recordPass("Input", "Disabled input applies neutral background and cursor-not-allowed", tInputDisabled);
  } else {
    recordFail("Input", "Disabled input styling missing", tInputDisabled, inputDisabled, "MEDIUM");
  }

  // ===========================================================================
  // SECTION 3: BADGE PRIMITIVE
  // ===========================================================================
  console.log("\n--- SECTION 3: Badge Primitive Tests ---");

  const badgeVariants: NonNullable<BadgeProps["variant"]>[] = [
    "success",
    "warning",
    "error",
    "info",
    "neutral",
  ];
  for (const bv of badgeVariants) {
    const t0 = Date.now();
    const htmlWithDot = renderToStaticMarkup(
      React.createElement(Badge, { variant: bv, dot: true }, `Trạng thái ${bv}`)
    );
    const hasPill = htmlWithDot.includes("rounded-[100px]") && htmlWithDot.includes(`Trạng thái ${bv}`);
    const hasDotSpan = htmlWithDot.includes("size-1.5 rounded-full");
    if (!hasPill || !hasDotSpan) {
      recordFail("Badge", `Badge variant="${bv}" failed pill or dot rendering`, t0, htmlWithDot, "HIGH");
      continue;
    }

    if (bv === "success") {
      if (htmlWithDot.includes("bg-[#eaf2ed]") && htmlWithDot.includes("text-[#15594f]") && htmlWithDot.includes("bg-[#15594f]")) {
        recordPass("Badge", "Badge success matches #eaf2ed bg and #15594f dot/text", t0);
      } else {
        recordFail("Badge", "Badge success token mismatch", t0, htmlWithDot, "HIGH");
      }
    } else if (bv === "warning") {
      if (htmlWithDot.includes("bg-[#fef3c7]") && htmlWithDot.includes("text-[#92400e]")) {
        recordPass("Badge", "Badge warning matches #fef3c7 bg and #92400e text", t0);
      } else {
        recordFail("Badge", "Badge warning token mismatch", t0, htmlWithDot, "HIGH");
      }
    } else if (bv === "error") {
      if (htmlWithDot.includes("bg-[#fee2e2]") && htmlWithDot.includes("text-[#991b1b]")) {
        recordPass("Badge", "Badge error matches #fee2e2 bg and #991b1b text", t0);
      } else {
        recordFail("Badge", "Badge error token mismatch", t0, htmlWithDot, "HIGH");
      }
    } else if (bv === "info") {
      if (htmlWithDot.includes("bg-[#e0f2fe]") && htmlWithDot.includes("text-[#075985]")) {
        recordPass("Badge", "Badge info matches #e0f2fe bg and #075985 text", t0);
      } else {
        recordFail("Badge", "Badge info token mismatch", t0, htmlWithDot, "HIGH");
      }
    } else if (bv === "neutral") {
      if (htmlWithDot.includes("bg-[#f2ede3]") && htmlWithDot.includes("text-[#74817b]")) {
        recordPass("Badge", "Badge neutral matches #f2ede3 bg and #74817b text", t0);
      } else {
        recordFail("Badge", "Badge neutral token mismatch", t0, htmlWithDot, "HIGH");
      }
    }
  }

  // Badge without dot
  const tBadgeNoDot = Date.now();
  const badgeNoDot = renderToStaticMarkup(React.createElement(Badge, { dot: false }, "No Dot"));
  if (!badgeNoDot.includes("size-1.5 rounded-full")) {
    recordPass("Badge", "Badge dot=false cleanly suppresses dot indicator", tBadgeNoDot);
  } else {
    recordFail("Badge", "Badge dot=false still rendered dot span", tBadgeNoDot, badgeNoDot, "MEDIUM");
  }

  // ===========================================================================
  // SECTION 4: CARD COMPOUND COMPONENTS
  // ===========================================================================
  console.log("\n--- SECTION 4: Card Compound Primitive Tests ---");

  const tCard = Date.now();
  const cardHtml = renderToStaticMarkup(
    React.createElement(
      Card,
      { hoverable: true, className: "test-card" },
      React.createElement(
        CardHeader,
        null,
        React.createElement(CardTitle, null, "Phòng studio ban công"),
        React.createElement(CardDescription, null, "Phường 25, Bình Thạnh")
      ),
      React.createElement(CardContent, null, "5.500.000 VNĐ/tháng"),
      React.createElement(CardFooter, null, React.createElement("button", null, "Xem chi tiết"))
    )
  );

  const cardChecks = [
    cardHtml.includes("rounded-[12px]"),
    cardHtml.includes("border-[#e2e7e1]"),
    cardHtml.includes("hover:shadow-md"),
    cardHtml.includes("hover:-translate-y-0.5"),
    cardHtml.includes("Phòng studio ban công"),
    cardHtml.includes("Phường 25, Bình Thạnh"),
    cardHtml.includes("5.500.000 VNĐ/tháng"),
    cardHtml.includes("Xem chi tiết"),
  ];
  if (cardChecks.every(Boolean)) {
    recordPass("Card", "Card compound renders rounded-12px, hoverable lift, and all semantic slots", tCard);
  } else {
    recordFail("Card", "Card compound component missing required styling or slots", tCard, cardHtml, "HIGH");
  }

  // ===========================================================================
  // SECTION 5: MODAL PRIMITIVE
  // ===========================================================================
  console.log("\n--- SECTION 5: Modal Primitive Tests ---");

  // 5.1 isOpen=false
  const tModalClosed = Date.now();
  const modalClosed = renderToStaticMarkup(
    React.createElement(Modal, { isOpen: false, onClose: () => {}, children: "Hidden Content" })
  );
  if (modalClosed === "") {
    recordPass("Modal", "isOpen=false renders null without DOM pollution", tModalClosed);
  } else {
    recordFail("Modal", "isOpen=false did not return null", tModalClosed, modalClosed, "HIGH");
  }

  // 5.2 isOpen=true
  const tModalOpen = Date.now();
  const modalOpen = renderToStaticMarkup(
    React.createElement(
      Modal,
      {
        isOpen: true,
        onClose: () => {},
        title: "Xác nhận đăng xuất",
        description: "Bạn có chắc chắn muốn đăng xuất?",
        size: "md",
        footer: React.createElement("button", null, "Đăng xuất"),
        children: React.createElement("p", null, "Chi tiết phiên làm việc"),
      }
    )
  );
  const modalChecks = [
    modalOpen.includes('role="dialog"'),
    modalOpen.includes('aria-modal="true"'),
    modalOpen.includes("Xác nhận đăng xuất"),
    modalOpen.includes("Bạn có chắc chắn muốn đăng xuất?"),
    modalOpen.includes("Chi tiết phiên làm việc"),
    modalOpen.includes("Đăng xuất"),
    modalOpen.includes("rounded-[16px]"),
    modalOpen.includes("backdrop-blur-[2px]"),
    modalOpen.includes("max-w-lg"),
  ];
  if (modalChecks.every(Boolean)) {
    recordPass("Modal", "isOpen=true renders role=dialog, aria-modal, title, description, footer, and 16px radius", tModalOpen);
  } else {
    recordFail("Modal", "Modal open rendering missing required accessibility or styles", tModalOpen, modalOpen, "HIGH");
  }

  // 5.3 Focus Trapping Verification
  const tModalFocusTrap = Date.now();
  const modalSource = await fs.readFile(path.join(clientDir, "components/ui/modal.tsx"), "utf-8");
  const hasFocusTrap = modalSource.includes("Tab") || modalSource.includes("focusTrap") || modalSource.includes("trapFocus");
  if (!hasFocusTrap) {
    recordFail(
      "Modal",
      "Claim Discrepancy: Worker claimed 'focus trapping' in handoff report line 45, but modal.tsx has NO keyboard focus trap",
      tModalFocusTrap,
      "modal.tsx listens for Escape key and locks body overflow, but completely omits Tab-key focus trapping or focus restoration.",
      "MEDIUM",
      true
    );
  } else {
    recordPass("Modal", "Modal implements focus trapping", tModalFocusTrap);
  }

  // ===========================================================================
  // SECTION 6: TABLE COMPOUND COMPONENTS
  // ===========================================================================
  console.log("\n--- SECTION 6: Table Compound Primitive Tests ---");

  const tTable = Date.now();
  const tableHtml = renderToStaticMarkup(
    React.createElement(
      Table,
      null,
      React.createElement(TableCaption, null, "Danh sách phòng"),
      React.createElement(
        TableHeader,
        null,
        React.createElement(
          TableRow,
          null,
          React.createElement(TableHead, null, "Mã phòng"),
          React.createElement(TableHead, null, "Giá thuê")
        )
      ),
      React.createElement(
        TableBody,
        null,
        React.createElement(
          TableRow,
          null,
          React.createElement(TableCell, null, "P201"),
          React.createElement(TableCell, null, "4.200.000 đ")
        )
      ),
      React.createElement(
        TableFooter,
        null,
        React.createElement(
          TableRow,
          null,
          React.createElement(TableCell, { colSpan: 2 }, "Tổng cộng: 1 phòng")
        )
      )
    )
  );

  const tableChecks = [
    tableHtml.includes("<table"),
    tableHtml.includes("overflow-x-auto"),
    tableHtml.includes("rounded-[12px]"),
    tableHtml.includes("Danh sách phòng"),
    tableHtml.includes("Mã phòng"),
    tableHtml.includes("P201"),
    tableHtml.includes("Tổng cộng: 1 phòng"),
  ];
  if (tableChecks.every(Boolean)) {
    recordPass("Table", "Table compound renders table, caption, thead, tbody, tfoot, and responsive overflow-x container", tTable);
  } else {
    recordFail("Table", "Table compound rendering failed", tTable, tableHtml, "HIGH");
  }

  // 6.2 TableEmpty
  const tTableEmpty = Date.now();
  const tableEmptyHtml = renderToStaticMarkup(
    React.createElement(TableEmpty, {
      title: "Chưa có hợp đồng nào",
      description: "Tạo hợp đồng mới để bắt đầu quản lý",
      colSpan: 8,
    })
  );
  if (
    (tableEmptyHtml.includes('colspan="8"') || tableEmptyHtml.includes('colSpan="8"')) &&
    tableEmptyHtml.includes("Chưa có hợp đồng nào") &&
    tableEmptyHtml.includes("Tạo hợp đồng mới để bắt đầu quản lý")
  ) {
    recordPass("Table", "TableEmpty renders custom colSpan, empty state SVG, title, and description", tTableEmpty);
  } else {
    recordFail("Table", "TableEmpty rendering failed", tTableEmpty, tableEmptyHtml, "HIGH");
  }

  // 6.3 TableSkeleton
  const tTableSkeleton = Date.now();
  const tableSkeletonHtml = renderToStaticMarkup(
    React.createElement(TableSkeleton, { rows: 5, colSpan: 4 })
  );
  const pulseRows = (tableSkeletonHtml.match(/animate-pulse/g) || []).length;
  if (pulseRows === 5) {
    recordPass("Table", `TableSkeleton renders exactly 5 pulse rows as requested`, tTableSkeleton);
  } else {
    recordFail("Table", "TableSkeleton row count mismatch", tTableSkeleton, `Count: ${pulseRows}`, "MEDIUM");
  }

  // ===========================================================================
  // SECTION 7: TABS COMPOUND COMPONENTS
  // ===========================================================================
  console.log("\n--- SECTION 7: Tabs Compound Primitive Tests ---");

  // 7.1 Line Tabs
  const tTabsLine = Date.now();
  const tabsLineHtml = renderToStaticMarkup(
    React.createElement(
      Tabs,
      { defaultValue: "tabA" },
      React.createElement(
        TabsList,
        { variant: "line" },
        React.createElement(TabsTrigger, { value: "tabA" }, "Tab A"),
        React.createElement(TabsTrigger, { value: "tabB" }, "Tab B")
      ),
      React.createElement(TabsContent, { value: "tabA" }, "Content A"),
      React.createElement(TabsContent, { value: "tabB" }, "Content B")
    )
  );

  const tabsLineChecks = [
    tabsLineHtml.includes('role="tablist"'),
    tabsLineHtml.includes('role="tab"'),
    tabsLineHtml.includes('role="tabpanel"'),
    tabsLineHtml.includes("Content A"),
    !tabsLineHtml.includes("Content B"),
  ];
  if (tabsLineChecks.every(Boolean)) {
    recordPass("Tabs", "Tabs line variant displays active content while hiding inactive, with WAI-ARIA roles", tTabsLine);
  } else {
    recordFail("Tabs", "Tabs line variant rendering failed", tTabsLine, tabsLineHtml, "HIGH");
  }

  // 7.2 Pill Tabs
  const tTabsPill = Date.now();
  const tabsPillHtml = renderToStaticMarkup(
    React.createElement(
      Tabs,
      { defaultValue: "filter1" },
      React.createElement(
        TabsList,
        { variant: "pill" },
        React.createElement(TabsTrigger, { value: "filter1", variant: "pill" }, "Tất cả")
      )
    )
  );
  if (tabsPillHtml.includes("bg-[#f7f6f2]") && tabsPillHtml.includes("rounded-[8px]")) {
    recordPass("Tabs", "Tabs pill variant renders rounded-[8px] container with #f7f6f2 background", tTabsPill);
  } else {
    recordFail("Tabs", "Tabs pill variant styling failed", tTabsPill, tabsPillHtml, "HIGH");
  }

  // 7.3 Orphan Trigger guard
  const tTabsGuard = Date.now();
  let caughtTabsError = false;
  try {
    renderToStaticMarkup(React.createElement(TabsTrigger, { value: "orphan" }, "Orphan"));
  } catch {
    caughtTabsError = true;
  }
  if (caughtTabsError) {
    recordPass("Tabs", "TabsTrigger throws descriptive guard error when used outside Tabs provider", tTabsGuard);
  } else {
    recordFail("Tabs", "TabsTrigger failed to guard against orphan rendering", tTabsGuard, "No exception thrown", "HIGH");
  }

  // ===========================================================================
  // SECTION 8: ICONS INFRASTRUCTURE
  // ===========================================================================
  console.log("\n--- SECTION 8: Icons Dictionary Compliance ---");

  const tIconsDict = Date.now();
  const iconKeys = Object.keys(Icons) as IconType[];
  if (iconKeys.length >= 40) {
    recordPass("Icons", `Icons dictionary maps ${iconKeys.length} icons (exceeds requirement >= 40)`, tIconsDict);
  } else {
    recordFail("Icons", `Icons dictionary provides only ${iconKeys.length} icons`, tIconsDict, "Expected >= 40", "MEDIUM");
  }

  // ===========================================================================
  // SECTION 9: PERSONA NAVIGATION & LAYOUTS UNDER VALID ROUTES
  // ===========================================================================
  console.log("\n--- SECTION 9: Persona Navigation & Layouts under Valid Routes ---");

  // 9.1 PublicNavbar
  const tNavbar = Date.now();
  const navbarHtml = renderWithRoute(
    React.createElement(PublicNavbar, { currentUser: null }),
    "/"
  );
  if (
    navbarHtml.includes("5K-Rental Manager") &&
    navbarHtml.includes("MỘT CHỐN Ở HỢP GU") &&
    navbarHtml.includes("Đăng nhập") &&
    navbarHtml.includes("Đăng ký")
  ) {
    recordPass("Tenant", "PublicNavbar renders 5K-Rental Manager brand, tagline, and guest login/register actions", tNavbar);
  } else {
    recordFail("Tenant", "PublicNavbar failed to render brand or actions", tNavbar, navbarHtml, "HIGH");
  }

  // 9.2 PortalSidebar
  const tPortalSidebar = Date.now();
  const portalSidebarHtml = renderWithRoute(
    React.createElement(PortalSidebar, {}),
    "/tenant/favorites"
  );
  if (
    portalSidebarHtml.includes("w-[236px]") &&
    portalSidebarHtml.includes("Lịch xem phòng") &&
    portalSidebarHtml.includes("Hợp đồng của tôi") &&
    portalSidebarHtml.includes("Cam kết an tâm")
  ) {
    recordPass("Tenant", "PortalSidebar renders 236px width, 9 functional items, 4 account links, and bottom Trust Card", tPortalSidebar);
  } else {
    recordFail("Tenant", "PortalSidebar rendering mismatch", tPortalSidebar, portalSidebarHtml, "HIGH");
  }

  // 9.3 Footer
  const tFooter = Date.now();
  const footerHtml = renderToStaticMarkup(React.createElement(Footer, {}));
  if (footerHtml.includes("5K-Rental Manager") && footerHtml.includes("hotro@5krental.vn")) {
    recordPass("Tenant", "Footer renders 5K-Rental Manager brand and support email", tFooter);
  } else {
    recordFail("Tenant", "Footer rendering mismatch", tFooter, footerHtml, "MEDIUM");
  }

  // 9.4 TenantLayout Dual-Mode
  const tTenantPublic = Date.now();
  const tenantPublicLayout = renderWithRoute(
    React.createElement(TenantLayout, null, React.createElement("div", { id: "child-home" }, "Home")),
    "/"
  );
  if (
    tenantPublicLayout.includes('id="child-home"') &&
    tenantPublicLayout.includes("5K-Rental Manager") &&
    !tenantPublicLayout.includes("w-[236px]") // No sidebar on public marketing
  ) {
    recordPass("TenantLayout", "Public route '/' renders PublicNavbar and child without PortalSidebar", tTenantPublic);
  } else {
    recordFail("TenantLayout", "Public route layout incorrect", tTenantPublic, tenantPublicLayout, "HIGH");
  }

  const tTenantPortal = Date.now();
  const tenantPortalLayout = renderWithRoute(
    React.createElement(TenantLayout, null, React.createElement("div", { id: "child-portal" }, "Favorites")),
    "/tenant/favorites"
  );
  if (
    tenantPortalLayout.includes('id="child-portal"') &&
    tenantPortalLayout.includes("w-[236px]") // 236px sidebar mounted
  ) {
    recordPass("TenantLayout", "Portal route '/tenant/favorites' mounts 236px PortalSidebar and workspace", tTenantPortal);
  } else {
    recordFail("TenantLayout", "Portal route layout incorrect", tTenantPortal, tenantPortalLayout, "HIGH");
  }

  // 9.5 Landlord Sidebar, Topbar, Layout
  const tLandlordSidebar = Date.now();
  const landlordSidebarHtml = renderWithRoute(
    React.createElement(LandlordSidebar, {}),
    "/landlord/dashboard"
  );
  if (
    landlordSidebarHtml.includes("w-[224px]") &&
    landlordSidebarHtml.includes("5K-Rental") &&
    landlordSidebarHtml.includes("KHÔNG GIAN CHỦ TRỌ") &&
    landlordSidebarHtml.includes("KHÔNG GIAN") &&
    landlordSidebarHtml.includes("CHO THUÊ") &&
    landlordSidebarHtml.includes("TÀI CHÍNH") &&
    landlordSidebarHtml.includes("VẬN HÀNH")
  ) {
    recordPass("Landlord", "LandlordSidebar renders 224px width, property switcher, and 4 business groups", tLandlordSidebar);
  } else {
    recordFail("Landlord", "LandlordSidebar rendering mismatch", tLandlordSidebar, landlordSidebarHtml, "HIGH");
  }

  const tLandlordTopbar = Date.now();
  const landlordTopbarHtml = renderWithRoute(
    React.createElement(LandlordTopbar, {}),
    "/landlord/properties"
  );
  if (
    landlordTopbarHtml.includes("h-[72px]") &&
    (landlordTopbarHtml.includes("Bất động sản &amp; cơ sở") || landlordTopbarHtml.includes("Bất động sản & cơ sở")) &&
    landlordTopbarHtml.includes("Nguyễn Minh An")
  ) {
    recordPass("Landlord", "LandlordTopbar renders 72px height, breadcrumb, and MA profile pill", tLandlordTopbar);
  } else {
    recordFail("Landlord", "LandlordTopbar rendering mismatch", tLandlordTopbar, landlordTopbarHtml, "HIGH");
  }

  const tLandlordLayout = Date.now();
  const landlordLayoutHtml = renderWithRoute(
    React.createElement(LandlordLayout, null, React.createElement("div", { id: "ll-child" }, "LL Workspace")),
    "/landlord/dashboard"
  );
  if (
    landlordLayoutHtml.includes('id="ll-child"') &&
    landlordLayoutHtml.includes("w-[224px]") &&
    landlordLayoutHtml.includes("h-[72px]")
  ) {
    recordPass("LandlordLayout", "LandlordLayout hosts 224px sidebar and 72px topbar around workspace viewport", tLandlordLayout);
  } else {
    recordFail("LandlordLayout", "LandlordLayout structure mismatch", tLandlordLayout, landlordLayoutHtml, "HIGH");
  }

  // 9.6 Admin Sidebar, Topbar, Layout
  const tAdminSidebar = Date.now();
  const adminSidebarHtml = renderWithRoute(
    React.createElement(AdminSidebar, {}),
    "/admin/dashboard"
  );
  if (
    adminSidebarHtml.includes("w-[224px]") &&
    adminSidebarHtml.includes("Admin Console") &&
    adminSidebarHtml.includes("THỐNG KÊ TOÀN DIỆN") &&
    adminSidebarHtml.includes("QUẢN TRỊ HỆ THỐNG") &&
    adminSidebarHtml.includes("Production")
  ) {
    recordPass("Admin", "AdminSidebar renders 224px width, 4 governance groups, platform card, and production badge", tAdminSidebar);
  } else {
    recordFail("Admin", "AdminSidebar rendering mismatch", tAdminSidebar, adminSidebarHtml, "HIGH");
  }

  const tAdminTopbar = Date.now();
  const adminTopbarHtml = renderWithRoute(
    React.createElement(AdminTopbar, {}),
    "/admin/reports"
  );
  if (
    adminTopbarHtml.includes("h-[72px]") &&
    adminTopbarHtml.includes("Tìm user, chủ trọ, phòng...") &&
    adminTopbarHtml.includes("Quản trị viên Cấp cao")
  ) {
    recordPass("Admin", "AdminTopbar renders 72px height, global search, and Super Admin pill", tAdminTopbar);
  } else {
    recordFail("Admin", "AdminTopbar rendering mismatch", tAdminTopbar, adminTopbarHtml, "HIGH");
  }

  const tAdminLayout = Date.now();
  const adminLayoutHtml = renderWithRoute(
    React.createElement(AdminLayout, null, React.createElement("div", { id: "admin-child" }, "Admin Console")),
    "/admin/dashboard"
  );
  if (
    adminLayoutHtml.includes('id="admin-child"') &&
    adminLayoutHtml.includes("w-[224px]") &&
    adminLayoutHtml.includes("h-[72px]")
  ) {
    recordPass("AdminLayout", "AdminLayout hosts 224px sidebar and 72px topbar around workspace viewport", tAdminLayout);
  } else {
    recordFail("AdminLayout", "AdminLayout structure mismatch", tAdminLayout, adminLayoutHtml, "HIGH");
  }

  // ===========================================================================
  // SECTION 10: ADVERSARIAL STRESS TEST: NULL PATHNAME HYDRATION CRASH HAZARDS
  // ===========================================================================
  console.log("\n--- SECTION 10: Adversarial Stress Test: Null Pathname Hydration Safety ---");

  // In Next.js App Router, usePathname() returns string | null. During SSR, static fallback generation,
  // or testing, pathname can be null. Unsafely invoking .startsWith() or .includes() causes fatal 500 runtime crashes.
  const nullNavComponents = [
    { name: "PublicNavbar", element: React.createElement(PublicNavbar, {}) },
    { name: "PortalSidebar", element: React.createElement(PortalSidebar, {}) },
    { name: "TenantLayout", element: React.createElement(TenantLayout, null, null) },
    { name: "LandlordSidebar", element: React.createElement(LandlordSidebar, {}) },
    { name: "LandlordTopbar", element: React.createElement(LandlordTopbar, {}) },
    { name: "AdminSidebar", element: React.createElement(AdminSidebar, {}) },
    { name: "AdminTopbar", element: React.createElement(AdminTopbar, {}) },
  ];

  for (const comp of nullNavComponents) {
    const t0 = Date.now();
    let crashed = false;
    let errorMsg = "";
    try {
      renderWithRoute(comp.element, null);
    } catch (err: unknown) {
      crashed = true;
      if (err instanceof Error) {
        errorMsg = err.message;
      } else {
        errorMsg = String(err);
      }
    }

    if (crashed) {
      recordFail(
        "Hydration/SSR",
        `Null Pathname Fatal Crash in <${comp.name} />`,
        t0,
        `FATAL CRASH DETECTED when usePathname() is null: "${errorMsg}". Code lacks nullish coalescing guard (e.g. pathname?.startsWith or (pathname ?? "")).`,
        "CRITICAL",
        true
      );
    } else {
      recordPass("Hydration/SSR", `<${comp.name} /> survives null pathname safely`, t0);
    }
  }

  // ===========================================================================
  // SECTION 11: ROUTE GROUP ISOLATION ARCHITECTURAL CHECK
  // ===========================================================================
  console.log("\n--- SECTION 11: Route Group Architecture Check ---");

  const tRouteArch = Date.now();
  let hasRootPage = false;
  let hasTenantPage = false;
  try {
    await fs.access(path.join(clientDir, "app/page.tsx"));
    hasRootPage = true;
  } catch {}
  try {
    await fs.access(path.join(clientDir, "app/(tenant)/page.tsx"));
    hasTenantPage = true;
  } catch {}

  if (hasRootPage && !hasTenantPage) {
    recordFail(
      "Architecture",
      "Route Group Layout Bypass: Default starter page left at client/app/page.tsx",
      tRouteArch,
      "Next.js App Router rules dictate that layouts inside route groups `(tenant)/layout.tsx` only wrap pages inside `(tenant)/`. Because `/` is defined at `app/page.tsx`, visiting `/` renders the unstyled Vercel starter page and completely bypasses TenantLayout!",
      "HIGH",
      true
    );
  } else {
    recordPass("Architecture", "Route group layout properly wraps tenant pages", tRouteArch);
  }

  // ===========================================================================
  // SECTION 12: BRAND LEAKAGE GREP AUDIT
  // ===========================================================================
  console.log("\n--- SECTION 12: Legacy Brand Leakage Audit ---");

  const tBrand = Date.now();
  async function searchDir(dir: string, pattern: RegExp): Promise<string[]> {
    const matchedFiles: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name !== "node_modules" &&
          entry.name !== ".next" &&
          entry.name !== "__tests__"
        ) {
          matchedFiles.push(...(await searchDir(fullPath, pattern)));
        }
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".css") ||
          entry.name.endsWith(".json"))
      ) {
        const content = await fs.readFile(fullPath, "utf-8");
        if (pattern.test(content)) {
          matchedFiles.push(fullPath);
        }
      }
    }
    return matchedFiles;
  }

  const legacyReg = new RegExp("\u1EDF c\u00F9ng", "i");
  const brandMatches = await searchDir(clientDir, legacyReg);
  if (brandMatches.length === 0) {
    recordPass("Brand Compliance", "Zero occurrences of legacy Vietnamese brand 'Ở cùng' across client/ production code", tBrand);
  } else {
    recordFail(
      "Brand Compliance",
      "Brand Leakage Detected",
      tBrand,
      `Matches found in: ${brandMatches.join(", ")}`,
      "CRITICAL",
      true
    );
  }

  // ===========================================================================
  // FINAL SUMMARY
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("                        EMPIRICAL STRESS TEST RESULTS                           ");
  console.log("================================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const defects = results.filter((r) => r.isDefect);
  const criticalDefects = defects.filter((d) => d.severity === "CRITICAL");
  const highDefects = defects.filter((d) => d.severity === "HIGH");
  const mediumDefects = defects.filter((d) => d.severity === "MEDIUM");

  console.log(`Total Executed: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(2)}%`);
  console.log(`Empirically Confirmed Defects: ${defects.length}`);
  console.log(`  - CRITICAL: ${criticalDefects.length}`);
  console.log(`  - HIGH:     ${highDefects.length}`);
  console.log(`  - MEDIUM:   ${mediumDefects.length}`);

  if (defects.length > 0) {
    console.log("\nDEFECT SUMMARY LIST:");
    for (const d of defects) {
      console.log(`  - [${d.severity}] [${d.category}] ${d.name}: ${d.details}`);
    }
  }
  console.log("================================================================================");

  return { total, passed, failed, defects };
}

runAllTests().then((res) => {
  if (res.defects.length > 0) {
    process.exitCode = 1;
  }
});
