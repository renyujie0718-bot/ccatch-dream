import { describe, expect, it } from "vitest";
import { MAX_TAGS, normalizeTags } from "./types";

describe("normalizeTags", () => {
  it("去掉空标签与井号，并去重", () => {
    expect(normalizeTags([" #城市 ", "城市", "", "  "])).toEqual(["城市"]);
  });

  it("大小写不同视为同一个标签", () => {
    expect(normalizeTags(["Winter", "winter"])).toEqual(["Winter"]);
  });

  it("限制标签数量", () => {
    const many = Array.from({ length: MAX_TAGS + 5 }, (_, index) => `tag-${index}`);
    expect(normalizeTags(many)).toHaveLength(MAX_TAGS);
  });

  it("非数组输入返回空数组", () => {
    expect(normalizeTags(undefined)).toEqual([]);
    expect(normalizeTags("城市")).toEqual([]);
  });
});
