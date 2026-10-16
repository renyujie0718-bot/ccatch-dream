"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EchoResults } from "@/components/EchoResults";
import { Button, Card, EmptyState, Notice, PageHeader, StatRow } from "@/components/ui";
import { ApiClientError, requestLiteraryEchoes } from "@/lib/api-client";
import { useStore } from "@/lib/data/store-provider";
import type { Inspiration, Writing } from "@/lib/data/types";
import type { EchoResponse } from "@/lib/echo/types";
import { activeDaySet, computeGrowthStats, streakDays } from "@/lib/stats";
import { excerpt, formatDateTime } from "@/lib/text";
import { CARD_PROMPTS, pickPrompt } from "@/lib/training/prompts";

// 首页：灵感输入是首屏核心，右侧是今天的记录与小练习。
export default function HomePage() {
  const { store, ready, seed, takeSeed, toast } = useStore();

  const [inspirations, setInspirations] = useState<Inspiration[]>([]);
  const [writings, setWritings] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [echo, setEcho] = useState<EchoResponse | null>(null);
  const [echoLoading, setEchoLoading] = useState(false);
  const [echoError, setEchoError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextInspirations, nextWritings] = await Promise.all([
        store.listInspirations(),
        store.listWritings(),
      ]);
      setInspirations(nextInspirations);
      setWritings(nextWritings);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "读取数据失败了，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  // 从「灵感抽卡」等页面带回来的引子
  useEffect(() => {
    if (!seed) return;
    setText(seed);
    takeSeed();
  }, [seed, takeSeed]);

  const stats = useMemo(
    () => computeGrowthStats({ inspirations, writings, echoes: [] }),
    [inspirations, writings],
  );

  const streak = useMemo(
    () => streakDays(activeDaySet({ inspirations, writings, echoes: [] })),
    [inspirations, writings],
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const handleSaveOnly = useCallback(async () => {
    if (!text.trim()) {
      toast("先写下一点灵感。", "warn");
      return;
    }
    setSaving(true);
    try {
      await store.createInspiration({ content: text });
      await refresh();
      toast("灵感已经留下。");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "保存失败了，请稍后再试。", "warn");
    } finally {
      setSaving(false);
    }
  }, [text, store, refresh, toast]);

  const runEcho = useCallback(async () => {
    const query = text.trim();
    if (!query) {
      toast("先留下你的灵感。", "warn");
      return;
    }
    setEchoLoading(true);
    setEchoError(null);
    try {
      const response = await requestLiteraryEchoes(query);
      setEcho(response);

      // 每次检索都留档，方便之后回看与导出
      const preferences = await store.getPreferences();
      let inspirationId: string | null = null;
      if (preferences.autoSaveInspiration) {
        const created = await store.createInspiration({ content: query });
        inspirationId = created.id;
      }
      await store.saveEcho({
        inspirationId,
        queryText: query,
        generatedBy: response.generatedBy,
        results: response.results,
      });
      await refresh();
    } catch (cause) {
      setEchoError(describeError(cause));
    } finally {
      setEchoLoading(false);
    }
  }, [text, store, refresh, toast]);

  const handlePrompt = useCallback(() => {
    setText(pickPrompt(CARD_PROMPTS, Math.random() * CARD_PROMPTS.length).text);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="CATCH A DREAM"
        title="今天，捕捉一点什么。"
        description="不用完整。一个画面、一句话、一种说不清的感觉，都值得留下。"
        actions={<span className="cd-small">{todayLabel}</span>}
      />

      {loadError ? (
        <div className="mb-4">
          <Notice tone="error">{loadError}</Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,.75fr)]">
        <Card className="cd-hero min-h-[460px]">
          <span className="cd-label">灵感 → 文学回声</span>
          <h2 className="cd-h2 mt-[10px] mb-[18px]">
            把你随手记下的东西放在这里。
            <br />
            让它去遇见别人的文字。
          </h2>

          <label htmlFor="idea" className="sr-only">
            灵感内容
          </label>
          <textarea
            id="idea"
            className="cd-textarea min-h-[150px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="例如：搬家那天，我把一盆薄荷留在窗台上。后来每次想起那个房子，我只记得薄荷的味道。"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void runEcho()} disabled={echoLoading}>
              {echoLoading ? "正在寻找……" : "寻找文学回声"}
            </Button>
            <Button onClick={handlePrompt}>给我一个引子</Button>
            <Button onClick={() => void handleSaveOnly()} disabled={saving}>
              {saving ? "保存中…" : "只保存"}
            </Button>
          </div>

          <EchoResults
            response={echo}
            loading={echoLoading}
            error={echoError}
            onRetry={() => void runEcho()}
          />
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="cd-h3 mb-3">今天</h3>
            <StatRow label="灵感" value={stats.todayInspirations} />
            <StatRow label="今天改动的作品字数" value={stats.todayCharacters} />
            <StatRow label="连续记录" value={`${streak} 天`} />
            <p className="cd-small mt-2">
              字数按去掉空白后的字符统计。这里不做排名，也不计分。
            </p>
          </Card>

          <Card>
            <h3 className="cd-h3 mb-3">今天练一点</h3>
            <div className="grid grid-cols-2 gap-[10px]">
              <Link href="/observe" className="cd-tile">
                <b>观察</b>
                <span>用五个感官写一杯已经凉掉的咖啡。</span>
              </Link>
              <Link href="/think" className="cd-tile">
                <b>克制</b>
                <span>写告别，但不要出现「再见」。</span>
              </Link>
              <Link href="/think" className="cd-tile">
                <b>换位</b>
                <span>从一个路人的视角写一场争吵。</span>
              </Link>
              <Link href="/write" className="cd-tile">
                <b>十五分钟</b>
                <span>不删、不改，只让文字往前走。</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="cd-h3">最近灵感</h3>
            <Link href="/inspirations" className="cd-small text-violet">
              全部灵感
            </Link>
          </div>
          {loading ? (
            <p className="cd-loading">正在读取……</p>
          ) : inspirations.length === 0 ? (
            <EmptyState title="还没有灵感记录" hint="上面那个输入框写下第一句就可以。" />
          ) : (
            <ul className="space-y-3">
              {inspirations.slice(0, 4).map((item) => (
                <li key={item.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <div className="text-[13.5px] leading-[1.8] text-[#4b4540]">
                    {excerpt(item.content, 80)}
                  </div>
                  <div className="cd-small mt-1">{formatDateTime(item.updatedAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="cd-h3">最近作品</h3>
            <Link href="/works" className="cd-small text-violet">
              全部作品
            </Link>
          </div>
          {loading ? (
            <p className="cd-loading">正在读取……</p>
          ) : writings.length === 0 ? (
            <EmptyState title="还没有作品" hint="可以先去「自由写」待十五分钟，不用想标题。" />
          ) : (
            <ul className="space-y-3">
              {writings.slice(0, 4).map((item) => (
                <li key={item.id} className="border-b border-line pb-3 last:border-b-0 last:pb-0">
                  <Link href={`/works/${item.id}`} className="cd-h4">
                    {item.title}
                  </Link>
                  <div className="cd-small mt-1">
                    {formatDateTime(item.updatedAt)} · {item.content.replace(/\s/g, "").length} 字符
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function describeError(cause: unknown): string {
  if (cause instanceof ApiClientError) {
    if (cause.needsConfiguration) {
      return "AI 还没有配置，所以暂时无法做语义匹配。你仍然可以用「只保存」把灵感留下来；在服务端配置 DEEPSEEK_API_KEY 后，「寻找文学回声」会给出基于语义的推荐与解释。";
    }
    return cause.message;
  }
  return cause instanceof Error ? cause.message : "出了点问题，请稍后再试。";
}
