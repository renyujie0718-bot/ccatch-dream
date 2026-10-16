import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/env";

/**
 * 服务端 Supabase 客户端（基于 cookie 的会话）。
 *
 * 即使当前所有用户数据读写都发生在客户端，保留服务端入口也是必要的：
 * 将来任何服务端数据操作都必须走这个客户端，从会话里取 user id，
 * 而不是信任前端传来的 user_id。
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!supabasePublicConfig.url || !supabasePublicConfig.anonKey) return null;
  const cookieStore = cookies();

  return createServerClient(supabasePublicConfig.url, supabasePublicConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 在 Server Component 中调用 set 会抛错，交给 middleware 刷新即可
        }
      },
    },
  });
}

/** 取当前登录用户 id；未登录返回 null。绝不接受前端传入的 id。 */
export async function getCurrentUserId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}
