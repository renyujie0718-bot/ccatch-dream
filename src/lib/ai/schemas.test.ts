import { describe, expect, it } from "vitest";
import { modelFeedbackSchema, sanitizeModelFeedback } from "./schemas";

const SOURCE =
  "搬家那天，我把一盆薄荷留在窗台上。后来每次想起那个房子，我只记得薄荷的味道。";

function parse(input: unknown) {
  return modelFeedbackSchema.parse(input);
}

describe("sanitizeModelFeedback", () => {
  it("保留引用真实存在的意见", () => {
    const raw = parse({
      headline: "薄荷比房子更清楚",
      notes: [{ quote: "我只记得薄荷的味道", comment: "这句把记忆收到了一个气味上。" }],
      suggestions: ["再写一次那个窗台"],
      nextStep: "写下你搬进去那天窗台上有什么。",
    });

    const clean = sanitizeModelFeedback(raw, SOURCE, "feedback");
    expect(clean.notes).toHaveLength(1);
    expect(clean.droppedNotes).toBe(0);
    expect(clean.suggestions).toHaveLength(1);
  });

  it("丢弃引用与原文不符的意见并计数", () => {
    const raw = parse({
      notes: [
        { quote: "我把那盆薄荷带走了", comment: "这句很具体。" },
        { quote: "我只记得薄荷的味道", comment: "这句收得干净。" },
      ],
    });

    const clean = sanitizeModelFeedback(raw, SOURCE, "feedback");
    expect(clean.notes).toHaveLength(1);
    expect(clean.droppedNotes).toBe(1);
  });

  it("同一句被引用两次时只保留一次", () => {
    const raw = parse({
      notes: [
        { quote: "我只记得薄荷的味道", comment: "第一次" },
        { quote: "我只记得薄荷的味道 ", comment: "第二次" },
      ],
    });

    expect(sanitizeModelFeedback(raw, SOURCE, "feedback").notes).toHaveLength(1);
  });

  it("润色模式下只保留原句能在原文中找到的改动说明", () => {
    const raw = parse({
      polish: {
        revised: "搬家那天，我把一盆薄荷留在了窗台上。",
        changes: [
          {
            original: "我把一盆薄荷留在窗台上",
            revised: "我把一盆薄荷留在了窗台上",
            reason: "加一个字更顺",
          },
          { original: "薄荷最后枯死了", revised: "薄荷枯萎了", reason: "更简洁" },
        ],
      },
    });

    const clean = sanitizeModelFeedback(raw, SOURCE, "polish");
    expect(clean.polish?.changes).toHaveLength(1);
    expect(clean.polish?.revised).toContain("留在了");
  });

  it("非润色模式不会带上 polish 字段", () => {
    const raw = parse({
      polish: { revised: "改写后的文本", changes: [] },
    });

    expect(sanitizeModelFeedback(raw, SOURCE, "structure").polish).toBeUndefined();
  });

  it("建议数量被限制在 4 条以内", () => {
    const raw = parse({ suggestions: ["一", "二", "三", "四", "五", "六"] });
    expect(sanitizeModelFeedback(raw, SOURCE, "feedback").suggestions).toHaveLength(4);
  });

  it("引用条数被限制在 5 条以内", () => {
    const raw = parse({
      notes: Array.from({ length: 8 }, (_, index) => ({
        quote: `我只记得薄荷的味道${"".padEnd(index, " ")}`,
        comment: `第 ${index} 条`,
      })),
    });

    expect(sanitizeModelFeedback(raw, SOURCE, "feedback").notes.length).toBeLessThanOrEqual(5);
  });
});
