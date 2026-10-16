import { NextResponse } from "next/server";
import { isAiConfigured, isSupabaseConfigured, serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 只暴露「是否已配置」与模型名，绝不返回任何密钥内容。
// 界面用它显示真实的配置状态，避免让用户对着一个不会成功的按钮反复点击。
export async function GET(): Promise<Response> {
  return NextResponse.json({
    ai: {
      configured: isAiConfigured(),
      model: isAiConfigured() ? serverEnv.deepseek.model : null,
      maxInputChars: serverEnv.ai.maxInputChars,
    },
    cloud: {
      configured: isSupabaseConfigured(),
    },
    catalog: {
      // 文学回声的检索范围如实告知
      source: "本地公版作品目录",
      liveSearch: false,
    },
  });
}
