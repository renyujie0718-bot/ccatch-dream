import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { EXPANSION_WEIGHT, TERM_EXPANSIONS, expandQuery } from "./expansion";
import { buildIndex, searchCatalog } from "./search";

const catalogTerms = new Set(
  CATALOG.flatMap((entry) => entry.keywords.map((keyword) => keyword.term)),
);

describe("意象扩展词表", () => {
  it("每一个扩展目标都必须是目录里真实存在的检索词", () => {
    const broken: string[] = [];
    for (const [from, targets] of Object.entries(TERM_EXPANSIONS)) {
      for (const target of targets) {
        if (!catalogTerms.has(target)) broken.push(`${from} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("映射不能是自我循环，也不能空转", () => {
    for (const [from, targets] of Object.entries(TERM_EXPANSIONS)) {
      expect(targets.length).toBeGreaterThan(0);
      expect(targets).not.toContain(from);
    }
  });

  it("扩展权重低于原文直接命中", () => {
    expect(EXPANSION_WEIGHT).toBeGreaterThan(0);
    expect(EXPANSION_WEIGHT).toBeLessThan(1);
  });
});

describe("expandQuery", () => {
  it("识别出短意象并给出关联词", () => {
    const applied = expandQuery("太阳雨");
    expect(applied).toHaveLength(1);
    expect(applied[0]?.from).toBe("太阳雨");
    expect(applied[0]?.targets).toContain("雨");
    expect(applied[0]?.targets).toContain("阳光");
  });

  it("长词优先：命中「太阳雨」时不再单独重复计算它带来的关联词", () => {
    const applied = expandQuery("太阳雨落在窗台上");
    expect(applied).toHaveLength(1);
    expect(applied[0]?.from).toBe("太阳雨");
  });

  it("没有可扩展的词时返回空数组", () => {
    expect(expandQuery("我打开了服务器的日志文件")).toEqual([]);
    expect(expandQuery("   ")).toEqual([]);
  });
});

describe("扩展对检索结果的影响", () => {
  const index = buildIndex();

  it("「太阳雨」不再只靠一个单字命中", () => {
    const results = searchCatalog("太阳雨", { limit: 5 }, index);
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("扩展命中的词会被标注出来，并写清是从哪个词联想到的", () => {
    const results = searchCatalog("太阳雨", { limit: 5 }, index);
    const related = results.flatMap((item) =>
      item.matchedFacets.flatMap((facet) => facet.related ?? []),
    );
    expect(related.length).toBeGreaterThan(0);
    expect(related.every((item) => item.via === "太阳雨")).toBe(true);
  });

  it("用户原文里没有出现过的词不会被当成直接命中", () => {
    const results = searchCatalog("太阳雨", { limit: 5 }, index);
    const direct = results.flatMap((item) =>
      item.matchedFacets.flatMap((facet) => facet.terms),
    );
    // 「雨」确实出现在「太阳雨」里，可以作为直接命中；但「阳光」不行
    expect(direct).not.toContain("阳光");
  });

  it("同一个词不会既算直接命中又算联想，导致重复计分", () => {
    const results = searchCatalog("太阳雨", { limit: 5 }, index);
    for (const item of results) {
      for (const facet of item.matchedFacets) {
        const relatedTerms = (facet.related ?? []).map((entry) => entry.term);
        for (const term of relatedTerms) {
          expect(facet.terms).not.toContain(term);
        }
      }
    }
  });

  it("原文里有具体线索时，具体线索仍然排在扩展之前", () => {
    const results = searchCatalog("雪落在荒原上，风从窗缝里进来", { limit: 5 }, index);
    expect(results[0]?.entry.id).toBe("wuthering-heights");
  });
});
