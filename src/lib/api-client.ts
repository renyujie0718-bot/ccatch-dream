import type { AiFeedback, ApiErrorBody } from "@/lib/ai/contract";
import type { AiMode, FeedbackLength, PolishLevel } from "@/lib/ai/modes";
import type { EchoResponse } from "@/lib/echo/types";

/**
 * 客户端调用自己的 API 路由。
 *
 * 所有错误都会被翻译成可展示的中文提示；界面据此给出「重试 / 去配置」等动作，
 * 而不是假装成功。
 */

export class ApiClientError extends Error {
  readonly code: ApiErrorBody["error"]["code"] | "NETWORK_ERROR";
  readonly detail?: string;

  constructor(
    code: ApiClientError["code"],
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.detail = detail;
  }

  /** 缺少服务端配置 —— 界面应提示用户去设置环境变量，而不是让他反复重试。 */
  get needsConfiguration(): boolean {
    return this.code === "AI_NOT_CONFIGURED";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "网络连接失败了，检查一下网络再试。");
  }

  if (!response.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      parsed = null;
    }
    if (parsed?.error) {
      throw new ApiClientError(parsed.error.code, parsed.error.message, parsed.error.detail);
    }
    throw new ApiClientError(
      "INTERNAL_ERROR",
      `请求失败了（${response.status}），请稍后再试。`,
    );
  }

  return (await response.json()) as T;
}

export interface FeedbackRequestInput {
  mode: AiMode;
  text: string;
  title?: string;
  polishLevel?: PolishLevel;
  feedbackLength?: FeedbackLength;
}

export function requestAiFeedback(input: FeedbackRequestInput): Promise<AiFeedback> {
  return postJson<AiFeedback>("/api/ai/feedback", input);
}

export function requestLiteraryEchoes(text: string): Promise<EchoResponse> {
  return postJson<EchoResponse>("/api/literary-echoes", { text });
}
