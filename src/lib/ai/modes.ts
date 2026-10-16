/** 五种 AI 写作伙伴模式。客户端只能传这个白名单里的值，不能自定义 prompt。 */
export const AI_MODES = ["feedback", "polish", "structure", "voice", "next"] as const;

export type AiMode = (typeof AI_MODES)[number];

export const MODE_LABELS: Record<AiMode, string> = {
  feedback: "写作诊断",
  polish: "轻度润色",
  structure: "结构分析",
  voice: "个人声音",
  next: "继续写作",
};

/** 按钮上的短说明，帮助用户预期会得到什么。 */
export const MODE_HINTS: Record<AiMode, string> = {
  feedback: "指出具体有潜力的句子，以及可以再往前走的地方。",
  polish: "只做小改，保留你的语气，并逐条说明改了什么。",
  structure: "看开头、节奏、视角、信息释放、转折和结尾。",
  voice: "只根据这段文字，说说你的句式节奏和反复出现的意象。",
  next: "给你三个可以往下写的方向，不代写正文。",
};

export function isAiMode(value: unknown): value is AiMode {
  return typeof value === "string" && (AI_MODES as readonly string[]).includes(value);
}

export const POLISH_LEVELS = ["light", "medium"] as const;
export type PolishLevel = (typeof POLISH_LEVELS)[number];

export const FEEDBACK_LENGTHS = ["short", "standard", "long"] as const;
export type FeedbackLength = (typeof FEEDBACK_LENGTHS)[number];
