import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ChatProvider } from "@/context/chat-context";
import { FloatingChatBox } from "@/components/chat/floating-chat-box";
import { SessionGuard } from "@/components/auth/session-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "Helvetica Neue",
    "Arial",
    "sans-serif",
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: [
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Monaco",
    "Consolas",
    "Liberation Mono",
    "Courier New",
    "monospace",
  ],
});

export const metadata: Metadata = {
  title: {
    default: "5K-Rental Manager",
    template: "%s | 5K-Rental Manager",
  },
  description: "Nền tảng quản lý thuê trọ thông minh 5K-Rental Manager",
  keywords: [
    "thuê phòng trọ",
    "quản lý phòng trọ",
    "5K-Rental Manager",
    "ở ghép",
    "tìm phòng trọ",
    "chủ trọ",
  ],
  authors: [{ name: "Đội ngũ 5K-Rental Manager" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface-bg text-text-primary font-sans antialiased">
        <SessionGuard />
        <ChatProvider>
          {children}
          <FloatingChatBox />
        </ChatProvider>
      </body>
    </html>
  );
}
