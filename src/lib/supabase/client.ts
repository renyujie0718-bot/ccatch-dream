"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "@/lib/env";

/**
 * 浏览器端 Supabase 客户端。
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY 是设计上公开的值，真正的隔离由数据库 RLS 保证。
 * 未配置时返回 null，应用自动退化为访客本地模式。
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabasePublicConfig.url || !supabasePublicConfig.anonKey) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(
      supabasePublicConfig.url,
      supabasePublicConfig.anonKey,
    );
  }
  return browserClient;
}
