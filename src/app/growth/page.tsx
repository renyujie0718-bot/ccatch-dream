"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, EmptyState, Notice, PageHeader, StatRow } from "@/components/ui";
import { MODE_LABELS } from "@/lib/ai/modes";
import { useStore } from "@/lib/data/store-provider";
import type { Inspiration, StoredEcho, StoredFeedback, Writing } from "@/lib/data/types";
import { activeDaySet, computeGrowthStats, localDayKey, recentDayKeys, streakDays } from "@/lib/stats";
import { formatDateTime } from "@/lib/text";

// 成长记录：只和过去的自己比较，没有排名与积分。
export default function GrowthPage() {
  const { store, ready } = useStore();
  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [writings, setWritings] = useState<Writing[]>([]);
  const [echoes, setEchoes] = useState<StoredEcho[]>([]);
  const [feedback, setFeedback] = useState<StoredFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b, c, d] = await Promise.all([
        store.listInspirations(),
        store.listWritings(),
        store.listEchoes(),
        store.listFeedback(),
      ]);
      setInspirations(a);
      setWritings(b);
      setEchoes(c);
      setFeedback(d);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取记录失败了，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const input = useMemo(
    () => ({ inspirations, writings, echoes, feedback }),
    [inspirations, writings, echoes, feedback],
  );

  const stats = useMemo(() => computeGrowthStats(input), [input]);
  const days = useMemo(() => activeDaySet(input), [input]);
  const streak = useMemo(() => streakDays(days), [days]);
  const grid = useMemo(() => recentDayKeys(28), []);

  return (
    <>
      <PageHeader
        eyebrow="YOUR GROWTH"
        title="成长记录"
        description="不和别人比较，只看看自己有没有继续。这里没有排名，也没有分数。"
      />

      {error ? (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {loading ? (
        <Card>
          <p className="cd-loading">正在读取……</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="cd-h3 mb-3">累计</h2>
              <StatRow label="灵感" value={stats.totalInspirations} />
              <StatRow label="作品字数（字符）" value={stats.totalCharacters} />
              <StatRow label="作品数量" value={stats.writingCount} />
              <StatRow label="文学回声" value={stats.echoCount} />
            </Card>

            <Card>
              <h2 className="cd-h3 mb-3">节奏</h2>
              <StatRow label="有记录的天数" value={stats.activeDays} />
              <StatRow label="连续记录" value={`${streak} 天`} />
              <StatRow label="AI 分析次数" value={feedback.length} />
              <p className="cd-small mt-2">
                字数按去掉空白后的字符统计。中断了也没关系，记录不会因此归零。
              </p>
            </Card>
          </div>

          <Card className="mt-5">
            <h2 className="cd-h3 mb-1">最近四周</h2>
            <p className="cd-small mb-3">有留下东西的那一天会被涂上颜色。</p>
            <div className="grid grid-cols-7 gap-[6px]">
              {grid.map((key) => {
                const active = days.has(key);
                const isToday = key === localDayKey(new Date());
                return (
                  <div
                    key={key}
                    title={key}
                    aria-label={`${key}${active ? " 有记录" : " 没有记录"}`}
                    className={`aspect-square rounded-[8px] border ${
                      active
                        ? "border-violet bg-violet2"
                        : "border-line bg-[#fbf9f6]"
                    } ${isToday ? "ring-1 ring-violet" : ""}`}
                  />
                );
              })}
            </div>
          </Card>

          <Card className="mt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="cd-h3">最近的分析记录</h2>
              <Link href="/ai" className="cd-small text-violet">
                去 AI 写作伙伴
              </Link>
            </div>
            {feedback.length === 0 ? (
              <EmptyState
                title="还没有分析记录"
                hint="在「AI 写作伙伴」里分析一篇作品后，记录会出现在这里。"
              />
            ) : (
              <ul className="space-y-3">
                {feedback.slice(0, 6).map((item) => (
                  <li key={item.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                    <div className="text-[13.5px] text-[#4b4540]">
                      {MODE_LABELS[item.mode]}
                      {item.feedback.headline ? ` · ${item.feedback.headline}` : ""}
                    </div>
                    <div className="cd-small mt-1">{formatDateTime(item.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
