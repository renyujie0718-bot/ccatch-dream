import { describe, expect, it } from "vitest";
import { CARD_PROMPTS, OBSERVATION_PROMPTS, THINKING_PROMPTS, pickPrompt } from "./prompts";

describe("题库", () => {
  it("每一条都有正文与提示", () => {
    for (const list of [CARD_PROMPTS, OBSERVATION_PROMPTS, THINKING_PROMPTS]) {
      expect(list.length).toBeGreaterThan(0);
      for (const item of list) {
        expect(item.text.trim().length).toBeGreaterThan(0);
        expect(item.hint.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("id 不重复", () => {
    const ids = [...CARD_PROMPTS, ...OBSERVATION_PROMPTS, ...THINKING_PROMPTS].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("pickPrompt", () => {
  it("同一个 seed 得到同一条，保证抽卡结果稳定", () => {
    expect(pickPrompt(CARD_PROMPTS, 3)).toBe(pickPrompt(CARD_PROMPTS, 3));
  });

  it("越界的 seed 也能落在合法范围内", () => {
    expect(CARD_PROMPTS).toContain(pickPrompt(CARD_PROMPTS, -7));
    expect(CARD_PROMPTS).toContain(pickPrompt(CARD_PROMPTS, 1000.7));
  });
});
