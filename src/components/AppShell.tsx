"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/data/store-provider";

/**
 * 全站外壳：桌面左侧固定导航 + 右侧内容区；窄屏变为顶部横向可滚动导航。
 * 结构与《视觉参考_捕梦_2.0_即开即用版.html》保持一致。
 */

const NAV_ITEMS = [
  { href: "/", label: "首页", glyph: "⌂" },
  { href: "/echo", label: "文学回声", glyph: "✦" },
  { href: "/inspirations", label: "灵感库", glyph: "◈" },
  { href: "/cards", label: "灵感抽卡", glyph: "◇" },
  { href: "/observe", label: "观察训练", glyph: "◌" },
  { href: "/think", label: "思维训练", glyph: "☽" },
  { href: "/write", label: "自由写", glyph: "✎" },
  { href: "/works", label: "我的作品", glyph: "▤" },
  { href: "/ai", label: "AI 写作伙伴", glyph: "✧" },
  { href: "/growth", label: "成长记录", glyph: "◒" },
  { href: "/settings", label: "设置", glyph: "◎" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode, ready, user, cloudAvailable } = useStore();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen">
      <aside className="sticky top-0 z-30 w-full border-b border-line bg-[#fbf9f5] px-4 py-[15px] md:fixed md:inset-y-0 md:left-0 md:w-sidebar md:border-b-0 md:border-r md:px-5 md:py-[30px]">
        <Link href="/" className="cd-logo inline-block">
          捕梦
        </Link>
        <div className="mt-[7px] hidden text-[12px] text-muted md:mb-8 md:block">
          捡起脑海里一闪而过的东西
        </div>

        <nav
          aria-label="主导航"
          className="cd-noscrollbar mt-[10px] flex gap-1 overflow-x-auto md:mt-0 md:block md:overflow-visible"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`my-[3px] mr-1 block whitespace-nowrap rounded-[12px] px-[13px] py-[9px] text-[13.5px] transition-colors md:w-full md:px-[14px] md:py-[11px] ${
                  active
                    ? "bg-violet2 text-violet"
                    : "text-[#5d5650] hover:bg-violet2 hover:text-violet"
                }`}
              >
                <span aria-hidden="true" className="mr-2 text-[13px] opacity-80">
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:absolute md:bottom-[30px] md:left-[22px] md:right-[22px] md:block">
          <Link
            href="/settings"
            className="mb-4 block rounded-soft border border-line bg-paper px-3 py-2 text-[12px] leading-relaxed text-[#6b625b] transition-colors hover:border-[#ddd3c7]"
          >
            {!ready ? (
              <span className="text-muted">正在确认登录状态…</span>
            ) : mode === "cloud" ? (
              <>
                <span className="text-violet">云端模式</span>
                <br />
                <span className="break-all">{user?.email ?? "已登录"}</span>
              </>
            ) : (
              <>
                <span className="text-warm">访客模式</span>
                <br />
                <span>
                  {cloudAvailable
                    ? "数据只存在这台浏览器里，登录后可保存到云端。"
                    : "数据存在这台浏览器里，清理浏览器数据会丢失。"}
                </span>
              </>
            )}
          </Link>
          <p className="px-1 font-serif text-[13px] leading-[1.9] text-[#93877c]">
            “有些东西不是为了说清楚，
            <br />
            只是怕它消失。”
          </p>
        </div>
      </aside>

      <main className="md:ml-sidebar">
        <div className="mx-auto w-full max-w-shell px-4 py-6 md:px-[50px] md:py-[38px] md:pb-[70px]">
          {children}
        </div>
      </main>
    </div>
  );
}
