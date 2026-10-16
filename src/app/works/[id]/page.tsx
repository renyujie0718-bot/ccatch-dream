"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Notice,
  PageHeader,
  TextArea,
} from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";
import type { Writing, WritingVersion } from "@/lib/data/types";
import { downloadText, writingToMarkdown } from "@/lib/export";
import { saveStateLabel, useAutosave } from "@/lib/hooks/useAutosave";
import { countCharacters, formatDateTime } from "@/lib/text";

interface FormState {
  title: string;
  content: string;
  tags: string;
}

const EMPTY_FORM: FormState = { title: "", content: "", tags: "" };

// 作品编辑器：自动保存、版本历史、导出。
export default function WritingEditorPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { store, ready, toast } = useStore();

  const [writing, setWriting] = useState<Writing | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [versions, setVersions] = useState<WritingVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<WritingVersion | null>(null);

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await store.listVersions(id));
    } catch {
      setVersions([]);
    }
  }, [store, id]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void (async () => {
      try {
        const found = await store.getWriting(id);
        if (!active) return;
        setWriting(found);
        if (found) {
          setForm({ title: found.title, content: found.content, tags: found.tags.join(" ") });
        }
        setLoadError(null);
      } catch (cause) {
        if (active) {
          setLoadError(cause instanceof Error ? cause.message : "读取失败了，请稍后再试。");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, store, id]);

  const persist = useCallback(
    async (next: FormState) => {
      await store.saveWriting(id, {
        title: next.title,
        content: next.content,
        tags: next.tags.split(/[,，\s]+/).filter(Boolean),
      });
    },
    [store, id],
  );

  const { state, error, saveNow, reset } = useAutosave<FormState>({
    value: form,
    enabled: ready && writing !== null,
    delay: 1200,
    save: persist,
    shouldSave: (next, previous) =>
      next.title !== previous.title ||
      next.content !== previous.content ||
      next.tags !== previous.tags,
  });

  // 作品加载完成后，把自动保存的基线对齐到已保存的内容
  useEffect(() => {
    if (!writing) return;
    reset({ title: writing.title, content: writing.content, tags: writing.tags.join(" ") });
  }, [writing, reset]);

  // 初始化时读一次历史版本；之后每次保存成功再刷新
  useEffect(() => {
    if (!ready || !writing) return;
    void loadVersions();
  }, [ready, writing, loadVersions]);

  useEffect(() => {
    if (state !== "saved") return;
    void loadVersions();
  }, [state, loadVersions]);

  const characters = useMemo(() => countCharacters(form.content), [form.content]);

  if (loading) {
    return (
      <Card>
        <p className="cd-loading">正在读取……</p>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <Notice tone="error">{loadError}</Notice>
        <div className="mt-4">
          <Button onClick={() => router.push("/works")}>返回作品列表</Button>
        </div>
      </Card>
    );
  }

  if (!writing) {
    return (
      <Card>
        <EmptyState title="找不到这篇文章" hint="它可能已经被删除了。" />
        <div className="mt-4">
          <Button onClick={() => router.push("/works")}>返回作品列表</Button>
        </div>
      </Card>
    );
  }

  const exportTarget: Writing = {
    ...writing,
    title: form.title,
    content: form.content,
    tags: form.tags.split(/[,，\s]+/).filter(Boolean),
  };

  return (
    <>
      <PageHeader
        eyebrow="EDITING"
        title={form.title.trim() || "未命名作品"}
        description={`创建于 ${formatDateTime(writing.createdAt)} · ${characters} 字符`}
        actions={
          <>
            <span className="cd-small">{saveStateLabel(state)}</span>
            <Button onClick={() => void saveNow()}>立即保存</Button>
            <Button onClick={() => router.push("/works")}>返回列表</Button>
          </>
        }
      />

      {error ? (
        <div className="mb-4">
          <Notice tone="error">
            {error}
            <button
              type="button"
              className="ml-2 underline decoration-dotted underline-offset-2"
              onClick={() => void saveNow()}
            >
              重试保存
            </button>
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,.7fr)]">
        <Card>
          <label htmlFor="title" className="cd-small mb-1 block">
            标题
          </label>
          <input
            id="title"
            className="cd-input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="给这篇文章一个名字"
          />

          <label htmlFor="content" className="cd-small mt-3 mb-1 block">
            正文
          </label>
          <TextArea
            id="content"
            className="min-h-[420px]"
            value={form.content}
            onChange={(event) => setForm({ ...form, content: event.target.value })}
            placeholder="从这里开始。"
          />

          <label htmlFor="tags" className="cd-small mt-3 mb-1 block">
            标签
          </label>
          <input
            id="tags"
            className="cd-input"
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="用空格或逗号分开"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() =>
                downloadText(
                  `${form.title || "未命名"}.md`,
                  writingToMarkdown(exportTarget),
                  "text/markdown;charset=utf-8",
                )
              }
            >
              导出 Markdown
            </Button>
            <Button
              onClick={() => downloadText(`${form.title || "未命名"}.txt`, exportTarget.content)}
            >
              导出 TXT
            </Button>
            <Button variant="danger" onClick={() => setPendingDelete(true)}>
              删除这篇
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="cd-h3 mb-1">版本历史</h2>
          <p className="cd-small mb-3">
            最多保留最近 20 个版本。恢复之前，当前内容会先被存成一个版本。
          </p>
          {versions.length === 0 ? (
            <EmptyState title="还没有历史版本" hint="继续写，改动会自动留下记录。" />
          ) : (
            <ul className="space-y-3">
              {versions.map((version) => (
                <li
                  key={version.id}
                  className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] text-[#4b4540]">
                      {formatDateTime(version.createdAt)}
                    </div>
                    <div className="cd-small mt-1">
                      {version.title} · {countCharacters(version.content)} 字符
                    </div>
                  </div>
                  <Button onClick={() => setPendingRestore(version)}>恢复</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={pendingDelete}
        title="删除这篇作品？"
        description="连同历史版本一起删除，无法恢复。"
        onCancel={() => setPendingDelete(false)}
        onConfirm={() => {
          setPendingDelete(false);
          void (async () => {
            try {
              await store.deleteWriting(id);
              toast("已经删除。");
              router.push("/works");
            } catch (cause) {
              toast(cause instanceof Error ? cause.message : "删除失败了，请稍后再试。", "warn");
            }
          })();
        }}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        title="恢复到这个版本？"
        description="当前内容会先存成一个历史版本，然后再恢复。"
        confirmLabel="确认恢复"
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => {
          const target = pendingRestore;
          setPendingRestore(null);
          if (!target) return;
          void (async () => {
            try {
              const restored = await store.restoreVersion(id, target.id);
              setWriting(restored);
              const next = {
                title: restored.title,
                content: restored.content,
                tags: restored.tags.join(" "),
              };
              setForm(next);
              reset(next);
              await loadVersions();
              toast("已经恢复到那个版本。");
            } catch (cause) {
              toast(cause instanceof Error ? cause.message : "恢复失败了，请稍后再试。", "warn");
            }
          })();
        }}
      />
    </>
  );
}
