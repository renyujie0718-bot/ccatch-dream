"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, ConfirmDialog, EmptyState, Notice, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";
import type { Writing } from "@/lib/data/types";
import { downloadText, writingToMarkdown } from "@/lib/export";
import { countCharacters, excerpt, formatDateTime } from "@/lib/text";

// 我的作品：列表、新建、导出、删除。
export default function WorksPage() {
  const { store, ready, toast, mode } = useStore();
  const router = useRouter();
  const [items, setItems] = useState<Writing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Writing | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await store.listWritings());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取作品失败了，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  const createNew = async () => {
    setCreating(true);
    try {
      const created = await store.createWriting({ content: "" });
      router.push(`/works/${created.id}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "新建失败了，请稍后再试。", "warn");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="YOUR WORDS"
        title="我的作品"
        description="所有写过的东西，都可以慢慢回来看看。"
        actions={
          <Button variant="primary" onClick={() => void createNew()} disabled={creating}>
            {creating ? "新建中…" : "新建"}
          </Button>
        }
      />

      {mode === "guest" ? (
        <div className="mb-4">
          <Notice tone="warn">
            访客模式下作品保存在这台浏览器里。想换设备继续写，可以在「设置」里登录后同步到云端。
          </Notice>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {loading ? (
        <Card>
          <p className="cd-loading">正在读取……</p>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title="还没有作品"
            hint="可以先去「自由写」待十五分钟，或者点右上角新建一篇。"
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} as="article">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/works/${item.id}`} className="cd-h4 break-words">
                    {item.title}
                  </Link>
                  <div className="cd-small mt-1">
                    最后修改 {formatDateTime(item.updatedAt)} · {countCharacters(item.content)} 字符
                  </div>
                </div>
              </div>

              <p className="cd-prose mt-3 text-[13.5px]">{excerpt(item.content, 160)}</p>

              {item.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="cd-chip">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => router.push(`/works/${item.id}`)}>继续写</Button>
                <Button
                  onClick={() =>
                    downloadText(
                      `${item.title}.md`,
                      writingToMarkdown(item),
                      "text/markdown;charset=utf-8",
                    )
                  }
                >
                  导出 Markdown
                </Button>
                <Button variant="danger" onClick={() => setPendingDelete(item)}>
                  删除
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`删除《${pendingDelete?.title ?? ""}》？`}
        description="连同这篇文章的历史版本一起删除，无法恢复。"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          void (async () => {
            try {
              await store.deleteWriting(target.id);
              await refresh();
              toast("已经删除。");
            } catch (cause) {
              toast(cause instanceof Error ? cause.message : "删除失败了，请稍后再试。", "warn");
            }
          })();
        }}
      />
    </>
  );
}
