import type { AiMode } from "./modes";

/**
 * 客户端与服务端共享的接口契约（纯类型 + 纯函数，不引用 process.env / zod，
 * 因此可以安全地被客户端组件 import）。
 */

export interface AiNote {
  /** 逐字取自用户原文的片段。 */
  quote: string;
  comment: string;
}

export interface AiPolishChange {
  original: string;
  revised: string;
  reason: string;
}

export interface AiFeedback {
  mode: AiMode;
  headline: string;
  notes: AiNote[];
  suggestions: string[];
  nextStep: string;
  polish?: {
    /** 服务端回填的原文，保证界面显示的「原文」一定等于用户输入。 */
    original: string;
    revised: string;
    changes: AiPolishChange[];
  };
  model: string;
  /** 被服务端丢弃的引用条数，用于提示用户模型输出不完全可靠。 */
  droppedNotes?: number;
}

/** 统一的错误响应体，前端据此显示可理解的提示。 */
export interface ApiErrorBody {
  error: {
    code:
      | "AI_NOT_CONFIGURED"
      | "INVALID_INPUT"
      | "INPUT_TOO_LONG"
      | "RATE_LIMITED"
      | "UPSTREAM_ERROR"
      | "UPSTREAM_TIMEOUT"
      | "BAD_MODEL_OUTPUT"
      | "INTERNAL_ERROR";
    message: string;
    /** 附带的结构化信息，例如最大允许长度。 */
    detail?: string;
  };
}

/** 把任意字符序列归一化，用于「引用是否真的出现在原文里」的比对。 */
export function normalizeForQuoteMatch(input: string): string {
  return input
    .replace(/[\s\u00a0\u3000]+/g, "")
    .replace(/[“”"'「」『』]/g, "")
    .toLowerCase();
}

/**
 * 判断引用是否真出自原文。
 *
 * 这是防伪造的关键一步：模型偶尔会「顺手改写」用户句子，
 * 一旦引用与原文不符，我们宁可丢掉这条意见，也不把改写过的句子当成作者的原文展示。
 */
export function quoteExistsInText(text: string, quote: string): boolean {
  const needle = normalizeForQuoteMatch(quote);
  if (needle.length < 2) return false;
  return normalizeForQuoteMatch(text).includes(needle);
}
