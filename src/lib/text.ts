/**
 * 文本工具：字数统计、摘要、安全截断。
 *
 * 中文按「字符」统计，不按词；英文按单词统计。UI 上必须明确标注这是字符数，
 * 避免用户误以为和 Word 的字数完全一致。
 */

/** 去掉空白后的字符数，用于中文写作的字数提示。 */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, "").length;
}

/**
 * 混合计数：中日韩字符逐个计数，连续的拉丁字母/数字算作一个词。
 * 这样「今天写了 3 hours」不会因为空格被算成 4 个字。
 */
export function countMixedWords(text: string): number {
  const cjk = text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g);
  const latin = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return (cjk?.length ?? 0) + (latin?.length ?? 0);
}

/** 生成列表页用的摘要，不破坏代理对（emoji）边界。 */
export function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${Array.from(clean).slice(0, max).join("")}…`;
}

/** 按字符上限截断，避免超出模型输入限制。 */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return chars.slice(0, max).join("");
}

/** 从正文中抽取一个可读的标题候选。 */
export function deriveTitle(text: string, fallback = "未命名"): string {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return fallback;
  return Array.from(firstLine).slice(0, 24).join("");
}

/** 本地日期时间，用于列表展示。 */
export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 是否是同一天（用于「今天」统计）。 */
export function isSameDay(a: string | number | Date, b: string | number | Date): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** 生成稳定唯一 id：优先用 crypto.randomUUID，降级到时间戳 + 随机串。 */
export function createId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
