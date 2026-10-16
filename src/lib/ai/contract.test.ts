import { describe, expect, it } from "vitest";
import { normalizeForQuoteMatch, quoteExistsInText } from "./contract";

const SOURCE =
  "搬家那天，我把一盆薄荷留在窗台上。\n后来每次想起那个房子，我只记得薄荷的味道。";

describe("quoteExistsInText", () => {
  it("逐字引用可以命中", () => {
    expect(quoteExistsInText(SOURCE, "我把一盆薄荷留在窗台上")).toBe(true);
  });

  it("忽略换行与空格差异", () => {
    expect(quoteExistsInText(SOURCE, "一盆薄荷  留在窗台上")).toBe(true);
  });

  it("忽略中英文引号差异", () => {
    expect(quoteExistsInText("他说“我记得薄荷的味道”", "他说“我记得薄荷的味道”")).toBe(true);
  });

  it("模型改写过的句子会被判定为不成立", () => {
    expect(quoteExistsInText(SOURCE, "我把一盆薄荷忘在了窗台上")).toBe(false);
  });

  it("凭空捏造的句子会被判定为不成立", () => {
    expect(quoteExistsInText(SOURCE, "那盆薄荷最后枯死了")).toBe(false);
  });

  it("过短的引用不成立，避免单个字造成的噪音", () => {
    expect(quoteExistsInText(SOURCE, "的")).toBe(false);
  });
});

describe("normalizeForQuoteMatch", () => {
  it("去掉空白与引号并统一大小写", () => {
    expect(normalizeForQuoteMatch(" A B “c” ")).toBe("abc");
  });
});
