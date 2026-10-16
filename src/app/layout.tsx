import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/AppShell";
import { StoreProvider } from "@/lib/data/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "捕梦 · Catch a Dream",
  description:
    "捕梦是一个以个人灵感收集、文学作品发现与 AI 写作陪伴为核心的个人写作空间。",
  applicationName: "捕梦",
  // 手机「添加到主屏幕」后以独立应用方式打开
  appleWebApp: {
    capable: true,
    title: "捕梦",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f3ee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
