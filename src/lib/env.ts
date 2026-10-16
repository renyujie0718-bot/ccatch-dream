/**
 * 环境变量读取。
 *
 * 规则（对应 PRD 第 8 节）：
 *   - AI 密钥只在服务端读取，永远不加 NEXT_PUBLIC_ 前缀；
 *   - NEXT_PUBLIC_* 必须写成字面量，Next.js 才能在构建时静态内联；
 *   - 缺失配置不是崩溃，而是「该能力明确关闭」。
 */

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** 仅服务端可用。不要把这个对象传给客户端组件。 */
export const serverEnv = {
  deepseek: {
    get apiKey() {
      return process.env.DEEPSEEK_API_KEY?.trim() ?? "";
    },
    get model() {
      return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
    },
    get baseUrl() {
      return process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";
    },
    get timeoutMs() {
      return toPositiveInt(process.env.DEEPSEEK_TIMEOUT_MS, 45_000);
    },
  },
  ai: {
    get maxInputChars() {
      return toPositiveInt(process.env.AI_MAX_INPUT_CHARS, 6_000);
    },
    get rateLimitMax() {
      return toPositiveInt(process.env.AI_RATE_LIMIT_MAX, 12);
    },
    get rateLimitWindowSeconds() {
      return toPositiveInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS, 60);
    },
  },
} as const;

/** AI 是否可用：没有 Key 时前端会显示准确的配置提示，而不是假装成功。 */
export function isAiConfigured(): boolean {
  return serverEnv.deepseek.apiKey.length > 0;
}

/** Supabase 公开配置（这两个值本来就会进入客户端 bundle，属于正常设计）。 */
export const supabasePublicConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

/** 是否配置了云端账号体系。未配置时整站退化为访客本地模式。 */
export function isSupabaseConfigured(): boolean {
  return (
    supabasePublicConfig.url.trim().length > 0 &&
    supabasePublicConfig.anonKey.trim().length > 0
  );
}
