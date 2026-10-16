import { describe, expect, it } from "vitest";
import {
  countCharacters,
  countMixedWords,
  createId,
  deriveTitle,
  excerpt,
  isSameDay,
  truncate,
} from "./text";

describe("countCharacters", () => {
  it("按去掉空白后的字符数统计，中文一个字算一个", () => {
    expect(countCharacters("今天 写了 三个字")).toBe(7);
  });

  it("换行和全角空格不计入", () => {
    expect(countCharacters("第一行\n第二行\u3000")).toBe(6);
  });

  it("空字符串是 0", () => {
    expect(countCharacters("   ")).toBe(0);
  });
});

describe("countMixedWords", () => {
  it("中文按字、英文按词统计", () => {
    expect(countMixedWords("今天 wrote three words")).toBe(2 + 3);
  });

  it("带连字符或撇号的英文算一个词", () => {
    expect(countMixedWords("don't well-known 42")).toBe(3);
  });
});

describe("excerpt", () => {
  it("短文本原样返回", () => {
    expect(excerpt("短短的", 10)).toBe("短短的");
  });

  it("超长文本截断并加省略号，且不切开代理对", () => {
    const result = excerpt("🙂".repeat(10), 3);
    expect(result).toBe("🙂🙂🙂…");
    expect(Array.from(result).length).toBe(4);
  });
});

describe("truncate", () => {
  it("按字符上限截断", () => {
    expect(truncate("abcdef", 3)).toBe("abc");
    expect(truncate("abc", 10)).toBe("abc");
  });
});

describe("deriveTitle", () => {
  it("取第一行非空内容并限制长度", () => {
    expect(deriveTitle("\n  夏天的雨  \n第二行")).toBe("夏天的雨");
    expect(Array.from(deriveTitle("一".repeat(50))).length).toBe(24);
  });

  it("没有内容时用兜底标题", () => {
    expect(deriveTitle("   \n  ", "未命名")).toBe("未命名");
  });
});

describe("isSameDay", () => {
  it("同一天的上午和深夜算同一天", () => {
    expect(isSameDay("2026-10-16T00:10:00", "2026-10-16T23:50:00")).toBe(true);
    expect(isSameDay("2026-10-16T23:50:00", "2026-10-17T00:10:00")).toBe(false);
  });
});

describe("createId", () => {
  it("生成的 id 互不相同", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createId()));
    expect(ids.size).toBe(50);
  });
});
