import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

/**
 * DeepSeek 客户端（OpenAI 兼容接口）。
 *
 * 注意：
 *   - API Key 只在这里的服务端实例中使用；
 *   - 模型名从 DEEPSEEK_MODEL 读取，不硬编码具体模型；
 *   - DeepSeek 的对话接口不具备网页检索能力，因此本文件不承诺任何「联网」行为。
 */

export class AiNotConfiguredError extends Error {
  constructor() {
    super("尚未配置 DEEPSEEK_API_KEY，AI 功能当前不可用。");
    this.name = "AiNotConfiguredError";
  }
}

export class AiUpstreamError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 502, code = "UPSTREAM_ERROR") {
    super(message);
    this.name = "AiUpstreamError";
    this.status = status;
    this.code = code;
  }
}

export class AiTimeoutError extends AiUpstreamError {
  constructor(timeoutMs: number) {
    super(`AI 服务在 ${Math.round(timeoutMs / 1000)} 秒内没有返回，请稍后再试。`, 504, "UPSTREAM_TIMEOUT");
    this.name = "AiTimeoutError";
  }
}

let cachedClient: OpenAI | null = null;
let cachedKey = "";

function getClient(): OpenAI {
  const { apiKey, baseUrl } = serverEnv.deepseek;
  if (!apiKey) throw new AiNotConfiguredError();
  // Key 变更时（例如本地热更新）重新创建实例
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenAI({ apiKey, baseURL: baseUrl, maxRetries: 1 });
    cachedKey = apiKey;
  }
  return cachedClient;
}

/** 从模型返回的文本里稳妥地取出 JSON 对象。 */
export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) throw new AiUpstreamError("AI 返回了空内容，请稍后再试。", 502, "BAD_MODEL_OUTPUT");

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        /* 继续抛出统一错误 */
      }
    }
    throw new AiUpstreamError("AI 返回的内容不是合法 JSON，请重试。", 502, "BAD_MODEL_OUTPUT");
  }
}

export interface CallJsonOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 调用 DeepSeek 并返回解析后的 JSON。
 *
 * 当模型不支持 `response_format: json_object`（例如部分推理模型）时，
 * 自动降级为纯文本模式再解析一次，而不是直接报错。
 */
export async function callDeepSeekJson(options: CallJsonOptions): Promise<unknown> {
  const client = getClient();
  const { model, timeoutMs } = serverEnv.deepseek;

  const messages = [
    { role: "system" as const, content: options.system },
    { role: "user" as const, content: options.user },
  ];

  const request = async (jsonMode: boolean) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const completion = await client.chat.completions.create(
        {
          model,
          messages,
          temperature: options.temperature ?? 0.6,
          max_tokens: options.maxTokens ?? 1600,
          ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
        },
        { signal: controller.signal },
      );
      return completion.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
  };

  let content: string;
  try {
    try {
      content = await request(true);
    } catch (error) {
      if (isJsonModeUnsupported(error)) {
        content = await request(false);
      } else {
        throw error;
      }
    }
  } catch (error) {
    throw toUpstreamError(error, timeoutMs);
  }

  return extractJsonObject(content);
}

function isJsonModeUnsupported(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { status?: number; message?: string };
  if (candidate.status !== 400) return false;
  return /response_format|json_object|json mode/i.test(candidate.message ?? "");
}

function toUpstreamError(error: unknown, timeoutMs: number): AiUpstreamError {
  if (error instanceof AiUpstreamError) return error;

  const candidate = error as { name?: string; status?: number; message?: string; code?: string };

  if (candidate?.name === "AbortError" || candidate?.name === "APIUserAbortError") {
    return new AiTimeoutError(timeoutMs);
  }
  if (candidate?.status === 401 || candidate?.status === 403) {
    return new AiUpstreamError(
      "AI 服务拒绝了这次请求，请检查服务端的 DEEPSEEK_API_KEY 是否有效。",
      502,
      "UPSTREAM_ERROR",
    );
  }
  if (candidate?.status === 429) {
    return new AiUpstreamError("AI 服务当前请求过于频繁，请稍后再试。", 429, "UPSTREAM_ERROR");
  }
  if (typeof candidate?.status === "number" && candidate.status >= 500) {
    return new AiUpstreamError("AI 服务暂时不可用，请稍后再试。", 502, "UPSTREAM_ERROR");
  }
  return new AiUpstreamError("连接 AI 服务失败，请检查网络后重试。", 502, "UPSTREAM_ERROR");
}
