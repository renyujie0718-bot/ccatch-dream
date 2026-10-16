"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { GuestStore } from "./guest-store";
import { SupabaseStore } from "./supabase-store";
import type { DreamStore } from "./types";

/**
 * 数据源上下文。
 *
 * 两种模式共用同一套 DreamStore 接口：
 *   - 未登录（或未配置 Supabase）：GuestStore，数据只在这台浏览器里；
 *   - 已登录：SupabaseStore，数据在云端，由 RLS 隔离。
 * 页面不需要知道自己跑在哪种模式下。
 */

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "warn";
}

interface StoreContextValue {
  ready: boolean;
  mode: "guest" | "cloud";
  cloudAvailable: boolean;
  user: { id: string; email: string | null } | null;
  store: DreamStore;
  signInWithEmail: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  importGuestDataIntoCloud: () => Promise<{ inspirations: number; writings: number }>;
  seed: string;
  setSeed: (value: string) => void;
  takeSeed: () => string;
  toast: (text: string, tone?: ToastMessage["tone"]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const guestStore = useMemo(() => new GuestStore(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [seed, setSeed] = useState("");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setReady(true);
      return () => {
        active = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setReady(true);
      })
      .catch(() => {
        if (active) setReady(true);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const toast = useCallback((text: string, tone: ToastMessage["tone"] = "info") => {
    const id = (toastSeq.current += 1);
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const store = useMemo<DreamStore>(() => {
    if (supabase && session?.user) return new SupabaseStore(supabase, session.user.id);
    return guestStore;
  }, [supabase, session, guestStore]);

  const signInWithEmail = useCallback(
    async (email: string) => {
      if (!supabase) {
        return {
          ok: false,
          message: "这个站点还没有配置云端账号。你的数据保存在本机浏览器里，功能不受影响。",
        };
      }
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return { ok: false, message: "这个邮箱地址看起来不太对。" };
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        return { ok: false, message: "发送登录邮件失败了，请稍后再试。" };
      }
      return { ok: true, message: `登录链接已经发到 ${trimmed}，点开邮件里的链接即可进入。` };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  /**
   * 把访客期间存在本机的灵感与作品复制到云端。
   * 只新增，不删除本地数据，失败也不会影响本地内容。
   */
  const importGuestDataIntoCloud = useCallback(async () => {
    if (!supabase || !session?.user) {
      return { inspirations: 0, writings: 0 };
    }
    const cloud = new SupabaseStore(supabase, session.user.id);
    let inspirations = 0;
    let writings = 0;

    for (const item of await guestStore.listInspirations()) {
      await cloud.createInspiration({ title: item.title, content: item.content, tags: item.tags });
      inspirations += 1;
    }
    for (const item of await guestStore.listWritings()) {
      await cloud.createWriting({ title: item.title, content: item.content, tags: item.tags });
      writings += 1;
    }
    return { inspirations, writings };
  }, [supabase, session, guestStore]);

  const takeSeed = useCallback(() => {
    let value = "";
    setSeed((current) => {
      value = current;
      return "";
    });
    return value;
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      ready,
      mode: store.kind,
      cloudAvailable: Boolean(supabase),
      user: session?.user ? { id: session.user.id, email: session.user.email ?? null } : null,
      store,
      signInWithEmail,
      signOut,
      importGuestDataIntoCloud,
      seed,
      setSeed,
      takeSeed,
      toast,
    }),
    [ready, store, supabase, session, signInWithEmail, signOut, importGuestDataIntoCloud, seed, takeSeed, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto max-w-[320px] rounded-[12px] px-4 py-3 text-[13px] leading-relaxed shadow-paper ${
              item.tone === "warn" ? "bg-[#4a3b32] text-[#fdf8f2]" : "bg-[#2f2b28] text-white"
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore 必须在 StoreProvider 内使用。");
  return context;
}
