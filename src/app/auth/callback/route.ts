import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * 邮件登录回调：用一次性 code 换取会话 cookie。
 * 未配置 Supabase 时直接回到设置页并给出说明，不制造假的登录成功。
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/settings";
  const safeNext = next.startsWith("/") ? next : "/settings";

  if (!code) {
    return NextResponse.redirect(new URL("/login?state=missing-code", url.origin));
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login?state=not-configured", url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?state=failed", url.origin));
  }

  return NextResponse.redirect(new URL(safeNext, url.origin));
}
