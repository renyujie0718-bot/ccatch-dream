import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { quoteExistsInText } from "./contract";
import { AI_MODES, FEEDBACK_LENGTHS, POLISH_LEVELS } from "./modes";

/**
 * 服务端输入校验（仅被 route handler 引用）。
 *
 * 客户端永远无法传入 system prompt、模型名或任意 JSON 结构，
 * 只能传这些白名单字段。
 */

const HARD_MAX_CHARS = 40_000;

export const feedbackRequestSchema = z.object({
  mode: z.enum(AI_MODES),
  text: z
    .string()
    .min(1, "请先放入一些文字。")
    .max(HARD_MAX_CHARS, "文本太长了，请分段处理。")
    .refine(
      (value) => value.trim().length > 0,
      "请先放入一些文字。",
    )
    .refine(
      (value) => Array.from(value).length <= serverEnv.ai.maxInputChars,
      `一次最多分析 ${serverEnv.ai.maxInputChars} 个字符，请先精简或分段。`,
    ),
  title: z.string().max(200).optional(),
  polishLevel: z.enum(POLISH_LEVELS).optional(),
  feedbackLength: z.enum(FEEDBACK_LENGTHS).optional(),
});

export type FeedbackRequest = z.infer<typeof feedbackRequestSchema>;

export const echoRequestSchema = z.object({
  text: z
    .string()
    .min(1, "请先写下一点灵感。")
    .max(HARD_MAX_CHARS, "灵感太长了，请分段处理。")
    .refine((value) => value.trim().length > 0, "请先写下一点灵感。")
    .refine(
      (value) => Array.from(value).length <= serverEnv.ai.maxInputChars,
      `一次最多分析 ${serverEnv.ai.maxInputChars} 个字符。`,
    ),
});

export type EchoRequest = z.infer<typeof echoRequestSchema>;

/** 模型返回的原始结构。字段宽松一些，避免因模型多写一个字就整体失败。 */
export const modelFeedbackSchema = z.object({
  headline: z.string().default(""),
  notes: z
    .array(
      z.object({
        quote: z.string(),
        comment: z.string(),
      }),
    )
    .default([]),
  suggestions: z.array(z.string()).default([]),
  nextStep: z.string().default(""),
  polish: z
    .object({
      revised: z.string(),
      changes: z
        .array(
          z.object({
            original: z.string(),
            revised: z.string(),
            reason: z.string(),
          }),
        )
        .default([]),
    })
    .optional(),
});

export type ModelFeedback = z.infer<typeof modelFeedbackSchema>;

export const modelEchoSchema = z.object({
  analysis: z
    .object({
      themes: z.array(z.string()).default([]),
      emotions: z.array(z.string()).default([]),
      imagery: z.array(z.string()).default([]),
    })
    .default({ themes: [], emotions: [], imagery: [] }),
  results: z
    .array(
      z.object({
        id: z.string(),
        similarities: z.array(z.string()).default([]),
        differences: z.array(z.string()).default([]),
        readingPath: z.string().default(""),
      }),
    )
    .default([]),
});

export type ModelEcho = z.infer<typeof modelEchoSchema>;

/**
 * 把校验后的模型输出收敛成可展示的反馈：
 * 引用必须真的出现在原文里，否则整条丢弃并计数。
 */
export function sanitizeModelFeedback(
  raw: ModelFeedback,
  sourceText: string,
  mode: (typeof AI_MODES)[number],
): {
  headline: string;
  notes: { quote: string; comment: string }[];
  suggestions: string[];
  nextStep: string;
  polish?: { revised: string; changes: { original: string; revised: string; reason: string }[] };
  droppedNotes: number;
} {
  const seen = new Set<string>();
  const notes: { quote: string; comment: string }[] = [];
  let dropped = 0;

  for (const note of raw.notes) {
    const quote = note.quote.trim();
    const comment = note.comment.trim();
    if (!quote || !comment) continue;
    if (!quoteExistsInText(sourceText, quote)) {
      dropped += 1;
      continue;
    }
    const key = quote.replace(/\s+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    notes.push({ quote, comment });
    if (notes.length >= 5) break;
  }

  const suggestions = raw.suggestions
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 4);

  let polish: ReturnType<typeof sanitizeModelFeedback>["polish"];
  if (mode === "polish" && raw.polish && raw.polish.revised.trim()) {
    const changes = raw.polish.changes
      .map((change) => ({
        original: change.original.trim(),
        revised: change.revised.trim(),
        reason: change.reason.trim(),
      }))
      .filter(
        (change) =>
          change.original.length > 0 &&
          change.reason.length > 0 &&
          quoteExistsInText(sourceText, change.original),
      )
      .slice(0, 6);

    polish = { revised: raw.polish.revised.trim(), changes };
  }

  return {
    headline: raw.headline.trim(),
    notes,
    suggestions,
    nextStep: raw.nextStep.trim(),
    polish,
    droppedNotes: dropped,
  };
}
