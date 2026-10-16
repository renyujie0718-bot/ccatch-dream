import { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/ai/contract";

type ErrorCode = ApiErrorBody["error"]["code"];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  AI_NOT_CONFIGURED: 503,
  INVALID_INPUT: 400,
  INPUT_TOO_LONG: 400,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 504,
  BAD_MODEL_OUTPUT: 502,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: ErrorCode,
  message: string,
  options: { detail?: string; status?: number; headers?: Record<string, string> } = {},
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(options.detail ? { detail: options.detail } : {}) } },
    { status: options.status ?? STATUS_BY_CODE[code], headers: options.headers },
  );
}

export function apiOk<T>(data: T): NextResponse<T> {
  return NextResponse.json(data);
}

/**
 * 只记录 request id、状态码和耗时。
 * 绝不把用户全文、模型回复或 API Key 写进日志（PRD 第 8 节）。
 */
export function logRequest(entry: {
  requestId: string;
  route: string;
  status: number;
  durationMs: number;
  code?: string;
}): void {
  const payload = {
    requestId: entry.requestId,
    route: entry.route,
    status: entry.status,
    durationMs: entry.durationMs,
    ...(entry.code ? { code: entry.code } : {}),
  };
  console.log(`[api] ${JSON.stringify(payload)}`);
}

/** 把 zod 的校验问题转成一句用户看得懂的话。 */
export function describeValidationIssues(
  issues: { path: (string | number)[]; message: string }[],
): string {
  const first = issues[0];
  if (!first) return "输入格式不正确。";
  const field = first.path.filter((segment) => typeof segment === "string").join(".");
  return field ? `${field}：${first.message}` : first.message;
}
