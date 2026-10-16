import { describe, expect, it } from "vitest";
import { activeDaySet, computeGrowthStats, localDayKey, recentDayKeys, streakDays } from "./stats";
import type { Inspiration, StoredEcho, Writing } from "@/lib/data/types";

const TODAY = new Date("2026-10-16T12:00:00");

function inspiration(createdAt: string, content = "一条灵感"): Inspiration {
  return {
    id: `i-${createdAt}`,
    userId: null,
    title: "标题",
    content,
    tags: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function writing(createdAt: string, updatedAt: string, content = "正文"): Writing {
  return {
    id: `w-${createdAt}`,
    userId: null,
    title: "作品",
    content,
    tags: [],
    sourceInspirationId: null,
    createdAt,
    updatedAt,
  };
}

function echo(createdAt: string): StoredEcho {
  return {
    id: `e-${createdAt}`,
    userId: null,
    inspirationId: null,
    queryText: "查询",
    generatedBy: "local-catalog",
    results: [],
    createdAt,
  };
}

describe("localDayKey", () => {
  it("按本地时区生成 YYYY-MM-DD", () => {
    expect(localDayKey(new Date(2026, 9, 16, 8, 30))).toBe("2026-10-16");
  });

  it("非法时间返回空字符串", () => {
    expect(localDayKey("not-a-date")).toBe("");
  });
});

describe("streakDays", () => {
  const days = (values: string[]) => new Set(values);

  it("今天有记录时从今天开始数", () => {
    expect(
      streakDays(days(["2026-10-16", "2026-10-15", "2026-10-14"]), TODAY),
    ).toBe(3);
  });

  it("今天还没记录时从昨天开始数", () => {
    expect(streakDays(days(["2026-10-15", "2026-10-14"]), TODAY)).toBe(2);
  });

  it("前天有记录但昨天没有时归零", () => {
    expect(streakDays(days(["2026-10-14"]), TODAY)).toBe(0);
  });

  it("中间断掉就停下", () => {
    expect(
      streakDays(days(["2026-10-16", "2026-10-15", "2026-10-13"]), TODAY),
    ).toBe(2);
  });
});

describe("computeGrowthStats", () => {
  it("分别统计今天与累计", () => {
    const stats = computeGrowthStats(
      {
        inspirations: [
          inspiration("2026-10-16T09:00:00"),
          inspiration("2026-10-15T09:00:00"),
        ],
        writings: [
          writing("2026-10-10T09:00:00", "2026-10-16T10:00:00", "今天改了六个字"),
          writing("2026-10-01T09:00:00", "2026-10-02T10:00:00", "很旧的稿子"),
        ],
        echoes: [echo("2026-10-16T11:00:00")],
      },
      TODAY,
    );

    expect(stats.todayInspirations).toBe(1);
    expect(stats.totalInspirations).toBe(2);
    expect(stats.writingCount).toBe(2);
    expect(stats.echoCount).toBe(1);
    // "今天改了六个字" 去掉空白是 7 个字符；"很旧的稿子" 是 5 个
    expect(stats.todayCharacters).toBe(7);
    expect(stats.totalCharacters).toBe(7 + 5);
  });

  it("活跃天数按自然日去重", () => {
    const input = {
      inspirations: [inspiration("2026-10-16T09:00:00"), inspiration("2026-10-16T21:00:00")],
      writings: [],
      echoes: [],
    };
    expect(activeDaySet(input).size).toBe(1);
  });
});

describe("recentDayKeys", () => {
  it("返回按时间升序排列的 N 天，最后一天是今天", () => {
    const keys = recentDayKeys(3, TODAY);
    expect(keys).toEqual(["2026-10-14", "2026-10-15", "2026-10-16"]);
  });
});
