import type { AiFeedback } from "@/lib/ai/contract";
import { AiNotConfiguredError, AiUpstreamError, callDeepSeekJson } from "@/lib/ai/deepseek";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/ai/prompts";
import {
  feedbackRequestSchema,
  modelFeedbackSchema,
  sanitizeModelFeedback,
} from "@/lib/ai/schemas";
import { apiError, apiOk, describeValidationIssues, logRequest } from "@/lib/api/respond";
import { isAiConfigured, serverEnv } from "@/lib/env";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";
import { createId } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/ai/feedback";

export async function POST(request: Request): Promise<Response> {
  const requestId = createId();
  const startedAt = Date.now();

  const finish = (response: Response, code?: string) => {
    logRequest({
      requestId,
      route: ROUTE,
      status: response.status,
      durationMs: Date.now() - startedAt,
      code,
    });
    return response;
  };

  if (!isAiConfigured()) {
    return finish(
      apiError(
        "AI_NOT_CONFIGURED",
        "AI 写作伙伴还没有配置。请在有权限的环境里设置 DEEPSEEK_API_KEY 后重新部署，其他功能不受影响。",
        { detail: "缺少 DEEPSEEK_API_KEY" },
      ),
      "AI_NOT_CONFIGURED",
    );
  }

  const limit = checkRateLimit(
    `feedback:${clientKeyFrom(request)}`,
    serverEnv.ai.rateLimitMax,
    serverEnv.ai.rateLimitWindowSeconds,
  );
  if (!limit.allowed) {
    return finish(
      apiError("RATE_LIMITED", `请求有点密集，请等 ${limit.retryAfterSeconds} 秒后再试。`, {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }),
      "RATE_LIMITED",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return finish(apiError("INVALID_INPUT", "请求内容不是合法的 JSON。"), "INVALID_INPUT");
  }

  const parsed = feedbackRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = describeValidationIssues(parsed.error.issues);
    const tooLong = parsed.error.issues.some((issue) => issue.message.includes("最多分析"));
    return finish(
      apiError(tooLong ? "INPUT_TOO_LONG" : "INVALID_INPUT", message, {
        detail: `上限 ${serverEnv.ai.maxInputChars} 字符`,
      }),
      tooLong ? "INPUT_TOO_LONG" : "INVALID_INPUT",
    );
  }

  const { mode, text, title, polishLevel, feedbackLength } = parsed.data;

  try {
    const raw = await callDeepSeekJson({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt({ mode, text, title, polishLevel, feedbackLength }),
      maxTokens: mode === "polish" ? 2600 : 1500,
      temperature: mode === "polish" ? 0.3 : 0.6,
    });

    const modelOutput = modelFeedbackSchema.safeParse(raw);
    if (!modelOutput.success) {
      return finish(
        apiError("BAD_MODEL_OUTPUT", "这次返回的内容没能读懂，请再试一次。"),
        "BAD_MODEL_OUTPUT",
      );
    }

    const clean = sanitizeModelFeedback(modelOutput.data, text, mode);

    const body: AiFeedback = {
      mode,
      headline: clean.headline,
      notes: clean.notes,
      suggestions: clean.suggestions,
      nextStep: clean.nextStep,
      model: serverEnv.deepseek.model,
      droppedNotes: clean.droppedNotes,
      ...(clean.polish
        ? {
            polish: {
              // 原文由服务端回填，不从模型输出里取，避免模型「顺手改写原文」
              original: text,
              revised: clean.polish.revised,
              changes: clean.polish.changes,
            },
          }
        : {}),
    };

    return finish(apiOk(body));
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return finish(apiError("AI_NOT_CONFIGURED", error.message), "AI_NOT_CONFIGURED");
    }
    if (error instanceof AiUpstreamError) {
      const code =
        error.code === "UPSTREAM_TIMEOUT"
          ? "UPSTREAM_TIMEOUT"
          : error.code === "BAD_MODEL_OUTPUT"
            ? "BAD_MODEL_OUTPUT"
            : "UPSTREAM_ERROR";
      return finish(apiError(code, error.message, { status: error.status }), code);
    }
    // 兜底分支不回显任何用户内容或密钥
    return finish(
      apiError("INTERNAL_ERROR", "服务端出了点问题，请稍后再试。"),
      "INTERNAL_ERROR",
    );
  }
}
