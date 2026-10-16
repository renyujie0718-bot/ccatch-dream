import type { MetadataRoute } from "next";

// 让手机可以把捕梦「添加到主屏幕」，像 App 一样打开（全屏、无地址栏）。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "捕梦 · Catch Dream",
    short_name: "捕梦",
    description:
      "以个人灵感收集、文学作品发现与 AI 写作陪伴为核心的个人写作空间。",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f3ee",
    theme_color: "#f6f3ee",
    lang: "zh-CN",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
