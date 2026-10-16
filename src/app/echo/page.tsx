"use client";

import { useCallback, useEffect, useState } from "react";
import { EchoResults } from "@/components/EchoResults";
import { Button, Card, ConfirmDialog, EmptyState, Notice, PageHeader } from "@/components/ui";
import { ApiClientError, requestLiteraryEchoes } from "@/lib/api-client";
import { useStore } from "@/lib/data/store-provider";
import type { StoredEcho } from "@/lib/data/types";
import type { EchoResponse } from "@/lib/echo/types";
import { formatDateTime } from "@/lib/text";

// 文学回声：单独入口 + 历史记录。
export default function EchoPage() {
  const { store, ready, toast } = useStore();
  const [text, setText] = useState("");
  const [response, setResponse] = useState<EchoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StoredEcho[]>([]);
  const [pendingDelete, setPendingDelete] = useState<StoredEcho | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await store.listEchoes());
    } catch {
      setHistory([]);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void loadHistory();
  }, [ready, loadHistory]);

  const run = useCallback(async () => {
    const query = text.trim();
    if (!query) {
      toast("先写下你的灵感。", "warn");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await requestLiteraryEchoes(query);
      setResponse(result);
      await store.saveEcho({
        inspirationId: null,
        queryText: query,
        generatedBy: result.generatedBy,
        results: result.results,
      });
      await loadHistory();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.needsConfiguration
            ? "AI 还没有配置，所以暂时无法做语义匹配。配置 DEEPSEEK_API_KEY 后，这里会给出基于语义的推荐与解释。"
            : cause.message
          : "出了点问题，请稍后再试。",
      );
    } finally {
      setLoading(false);
    }
  }, [text, store, loadHistory, toast]);

  return (
    <>
      <PageHeader
        eyebrow="LITERARY ECHOES"
        title="文学回声"
        description="不是找「答案」，而是找与你的灵感发生关系的作品。作品与链接都来自可核对的公版目录。"
      />

      <Card>
        <label htmlFor="echo-text" className="sr-only">
          灵感内容
        </label>
        <textarea
          id="echo-text"
          className="cd-textarea min-h-[150px]"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="写下你的灵感……"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void run()} disabled={loading}>
            {loading ? "正在寻找……" : "寻找回声"}
          </Button>
          {text ? <Button onClick={() => setText("")}>清空</Button> : null}
        </div>

        <EchoResults
          response={response}
          loading={loading}
          error={error}
          onRetry={() => void run()}
        />
      </Card>

      <Card className="mt-5">
        <h2 className="cd-h3 mb-3">之前的回声</h2>
        {history.length === 0 ? (
          <EmptyState
            title="还没有记录"
            hint="每次寻找回声都会自动留档，方便你之后回看和导出。"
          />
        ) : (
          <ul className="space-y-4">
            {history.map((item) => (
              <li key={item.id} className="border-b border-line pb-4 last:border-b-0 last:pb-0">
                <p className="text-[13.5px] leading-[1.8] text-[#4b4540]">{item.queryText}</p>
                <div className="cd-small mt-1">
                  {formatDateTime(item.createdAt)} ·{" "}
                  {item.generatedBy === "deepseek" ? "AI 语义匹配" : "本地目录匹配"} ·{" "}
                  {item.results.length} 条
                </div>
                {item.results.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.results.map((result) => (
                      <a
                        key={result.id}
                        href={result.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cd-chip hover:border-[#ddd3c7]"
                      >
                        《{result.title}》↗
                      </a>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="cd-small mt-2 text-[#9a5f4c] underline decoration-dotted underline-offset-2"
                  onClick={() => setPendingDelete(item)}
                >
                  删除这条记录
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-5">
        <Notice>
          捕梦没有接入网页搜索。这里使用的是本地公版作品目录（Project Gutenberg、维基文库、中国哲学书电子化计划），
          AI 只在目录范围内解释作品与你的灵感之间的关系。
        </Notice>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条回声记录？"
        description="只会删掉这条记录，作品目录和你的灵感都不受影响。"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          void (async () => {
            try {
              await store.deleteEcho(target.id);
              await loadHistory();
              toast("已经删除。");
            } catch (cause) {
              toast(cause instanceof Error ? cause.message : "删除失败，请稍后再试。", "warn");
            }
          })();
        }}
      />
    </>
  );
}
