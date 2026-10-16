import type { Writing } from "@/lib/data/types";
import { countMixedWords } from "@/lib/text";

/** 把作品导出为 Markdown，保留标题、标签与时间。 */
export function writingToMarkdown(writing: Writing): string {
  const tags = writing.tags.length ? writing.tags.map((tag) => `#${tag}`).join(" ") : "";
  return [
    `# ${writing.title}`,
    "",
    tags,
    "",
    writing.content,
    "",
    "---",
    `创建于 ${new Date(writing.createdAt).toLocaleString("zh-CN")}`,
    `最后修改 ${new Date(writing.updatedAt).toLocaleString("zh-CN")}`,
    `字数（中文字符 + 英文单词）约 ${countMixedWords(writing.content)}`,
    "",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

/** 触发浏览器下载。文件名做了安全处理，避免出现路径分隔符。 */
export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8"): void {
  const safeName = filename.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
