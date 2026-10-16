import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { buildIndex, deriveAnalysis, fallbackCandidates, searchCatalog } from "./search";

const index = buildIndex();

describe("searchCatalog", () => {
  it("从具体意象出发能找到相邻的作品", () => {
    const results = searchCatalog("搬家那天，我把一盆薄荷留在窗台上，后来只记得那间房子", {
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.map((item) => item.entry.id)).toContain("to-the-lighthouse");
  });

  it("同一条线索会同时命中多个分析维度", () => {
    const results = searchCatalog("雪落在那条街上，酒馆的灯还亮着，我想起老家", { limit: 3 });
    const facets = new Set(results.flatMap((item) => item.matchedFacets.map((m) => m.facet)));

    expect(facets.size).toBeGreaterThan(1);
    expect(facets.has("imagery") || facets.has("scene")).toBe(true);
  });

  it("越少见的词权重越高", () => {
    const results = searchCatalog("蒹葭苍苍", { limit: 3 });
    expect(results[0]?.entry.id).toBe("shi-jing");
  });

  it("记录命中词在用户文本里的实际写法", () => {
    const results = searchCatalog("窗台上放着一盆薄荷", { limit: 3 });
    const terms = results.flatMap((item) => item.matchedFacets.flatMap((m) => m.terms));
    expect(terms).toContain("窗");
  });

  it("与目录毫无关系的文本返回空结果，而不是硬凑", () => {
    const results = searchCatalog("我打开了服务器的日志文件，发现磁盘占用过高。", { limit: 5 });
    expect(results).toEqual([]);
  });

  it("空文本返回空结果", () => {
    expect(searchCatalog("   ", { limit: 5 })).toEqual([]);
  });

  it("同一维度的命中词数量有上限，避免堆词刷分", () => {
    const results = searchCatalog("窗 花 门 雪 河 海 星 月 路 树", { limit: 5 });
    for (const item of results) {
      for (const facet of item.matchedFacets) {
        expect(facet.terms.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("结果按相关度从高到低排列", () => {
    const results = searchCatalog("我坐在湖边的小屋前，雪落在树林里", { limit: 5 });
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });
});

describe("fallbackCandidates", () => {
  it("优先覆盖不同体裁，供模型自行判断", () => {
    const candidates = fallbackCandidates(6, index);
    const forms = new Set(candidates.map((item) => item.entry.form));
    expect(candidates).toHaveLength(6);
    expect(forms.size).toBeGreaterThan(3);
  });
});

describe("deriveAnalysis", () => {
  it("在没有模型时如实反映关键词命中的维度", () => {
    const matches = searchCatalog("海上的风和灯塔", { limit: 3 });
    const analysis = deriveAnalysis(matches);
    expect(analysis.imagery.length).toBeGreaterThan(0);
  });

  it("没有命中时三个维度都是空数组", () => {
    const analysis = deriveAnalysis([]);
    expect(analysis).toEqual({ themes: [], emotions: [], imagery: [] });
  });
});

describe("目录本身", () => {
  it("每条作品都有可访问的来源 URL 与版权说明", () => {
    for (const entry of CATALOG) {
      expect(entry.source.url).toMatch(/^https:\/\//);
      expect(entry.source.rights.length).toBeGreaterThan(0);
      expect(entry.source.label.length).toBeGreaterThan(0);
    }
  });

  it("作品 id 不重复", () => {
    const ids = new Set(CATALOG.map((entry) => entry.id));
    expect(ids.size).toBe(CATALOG.length);
  });

  it("每个检索关键词都标注了分析维度", () => {
    for (const entry of CATALOG) {
      for (const keyword of entry.keywords) {
        expect(keyword.facet).toBeTruthy();
        expect(keyword.term.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
