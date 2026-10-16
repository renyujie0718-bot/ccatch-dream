"use client";

import Link from "next/link";
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
import type { Inspiration, StoredEcho } from "@/lib/data/types";
import { countCharacters, excerpt, formatDateTime } from "@/lib/text";

type SortKey = "updated" | "created";

// 灵感库：新建、编辑、删除、全文搜索、标签增删与筛选、转成草稿。
export default function InspirationsPage() {
  const { store, ready, toast, mode } = useStore();
  const [items, setItems] = useState<Inspiration[]>([]);
  const [echoes, setEchoes] = useState<StoredEcho[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("updated");

  const [draft, setDraft] = useState("");
  const [newTags, setNewTags] = useState("");
  const [creating, setCreating] = useState(false);

  const [editing, setEditing] = useState<Inspiration | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Inspiration | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextEchoes] = await Promise.all([
        store.listInspirations(),
        store.listEchoes(),
      ]);
      setItems(nextItems);
      setEchoes(nextEchoes);
      setLoadError(null);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "读取灵感失败了，请稍后再试。");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) for (const tag of item.tags) set.add(tag);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [items]);

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (activeTags.length > 0 && !activeTags.every((tag) => item.tags.includes(tag))) {
        return false;
      }
      if (!keyword) return true;
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.content.toLowerCase().includes(keyword) ||
        item.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });

    return [...filtered].sort((a, b) =>
      sort === "updated"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
  }, [items, query, activeTags, sort]);

  const echoCountByInspiration = useMemo(() => {
    const map = new Map<string, number>();
    for (const echo of echoes) {
      if (!echo.inspirationId) continue;
      map.set(echo.inspirationId, (map.get(echo.inspirationId) ?? 0) + 1);
    }
    return map;
  }, [echoes]);

  const handleCreate = async () => {
    if (!draft.trim()) {
      toast("先写下一点灵感。", "warn");
      return;
    }
    setCreating(true);
    try {
      await store.createInspiration({
        content: draft,
        tags: newTags.split(/[,，\s]+/).filter(Boolean),
      });
      setDraft("");
      setNewTags("");
      await refresh();
      toast("已经留下。");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "保存失败了，请稍后再试。", "warn");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (item: Inspiration) => {
    setEditing(item);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditTags(item.tags.join(" "));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editContent.trim()) {
      toast("内容不能是空的。", "warn");
      return;
    }
    setSavingEdit(true);
    try {
      await store.updateInspiration(editing.id, {
        title: editTitle,
        content: editContent,
        tags: editTags.split(/[,，\s]+/).filter(Boolean),
      });
      setEditing(null);
      await refresh();
      toast("已经更新。");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "更新失败了，请稍后再试。", "warn");
    } finally {
      setSavingEdit(false);
    }
  };

  const convertToDraft = async (item: Inspiration) => {
    setConverting(item.id);
    try {
      const created = await store.createWriting({
        title: item.title,
        content: item.content,
        tags: item.tags,
        sourceInspirationId: item.id,
      });
      toast("已经变成一篇草稿。");
      window.location.href = `/works/${created.id}`;
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "转换失败了，请稍后再试。", "warn");
    } finally {
      setConverting(null);
    }
  };

  const toggleTag = (tag: string) => {
    setActiveTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="YOUR NOTES"
        title="灵感库"
        description="所有随手记下的东西都在这里，可以搜索、加标签，也可以长成一篇文章。"
      />

      {mode === "guest" ? (
        <div className="mb-4">
          <Notice tone="warn">
            现在是访客模式，灵感只存在这台浏览器里。清理浏览器数据会一并清空；
            在「设置」里登录后数据会保存到云端。
          </Notice>
        </div>
      ) : null}

      {loadError ? (
        <div className="mb-4">
          <Notice tone="error">{loadError}</Notice>
        </div>
      ) : null}

      <Card>
        <h2 className="cd-h3 mb-3">记一条新的</h2>
        <label htmlFor="new-idea" className="sr-only">
          灵感内容
        </label>
        <TextArea
          id="new-idea"
          className="min-h-[110px]"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="一个画面、一句话，都可以。"
        />
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <label htmlFor="new-tags" className="sr-only">
              标签
            </label>
            <input
              id="new-tags"
              className="cd-input"
              value={newTags}
              onChange={(event) => setNewTags(event.target.value)}
              placeholder="标签，用空格或逗号分开（可留空）"
            />
          </div>
          <Button variant="primary" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? "保存中…" : "保存灵感"}
          </Button>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">
              搜索灵感
            </label>
            <input
              id="search"
              className="cd-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索标题、内容或标签"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="cd-small shrink-0">
              排序
            </label>
            <select
              id="sort"
              className="cd-select"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="updated">按更新时间</option>
              <option value="created">按创建时间</option>
            </select>
          </div>
        </div>

        {allTags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={activeTags.includes(tag)}
                className={`cd-chip ${
                  activeTags.includes(tag) ? "cd-chip-active" : "hover:border-[#ddd3c7]"
                }`}
              >
                #{tag}
              </button>
            ))}
            {activeTags.length > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTags([])}
                className="cd-chip hover:border-[#ddd3c7]"
              >
                清除筛选
              </button>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="mt-5 space-y-4">
        {loading ? (
          <Card>
            <p className="cd-loading">正在读取……</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              title={items.length === 0 ? "灵感库还是空的" : "没有符合条件的灵感"}
              hint={items.length === 0 ? "上面写一句，就会出现在这里。" : "试试换个关键词，或清除标签筛选。"}
            />
          </Card>
        ) : (
          visible.map((item) => (
            <Card key={item.id} as="article">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="cd-h4">{item.title}</h3>
                  <div className="cd-small mt-1">
                    {formatDateTime(item.createdAt)} · {countCharacters(item.content)} 字符
                    {echoCountByInspiration.get(item.id)
                      ? ` · 关联 ${echoCountByInspiration.get(item.id)} 次文学回声`
                      : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openEdit(item)}>编辑</Button>
                  <Button
                    onClick={() => void convertToDraft(item)}
                    disabled={converting === item.id}
                  >
                    {converting === item.id ? "转换中…" : "写成文章"}
                  </Button>
                  <Button variant="danger" onClick={() => setPendingDelete(item)}>
                    删除
                  </Button>
                </div>
              </div>

              <p className="cd-prose mt-3 text-[14px]">{excerpt(item.content, 400)}</p>

              {item.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="cd-chip">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>

      {editing ? (
        <div className="mt-5">
          <Card>
            <h2 className="cd-h3 mb-3">编辑这条灵感</h2>
            <label htmlFor="edit-title" className="cd-small mb-1 block">
              标题
            </label>
            <input
              id="edit-title"
              className="cd-input"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <label htmlFor="edit-content" className="cd-small mt-3 mb-1 block">
              内容
            </label>
            <TextArea
              id="edit-content"
              className="min-h-[160px]"
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
            <label htmlFor="edit-tags" className="cd-small mt-3 mb-1 block">
              标签
            </label>
            <input
              id="edit-tags"
              className="cd-input"
              value={editTags}
              onChange={(event) => setEditTags(event.target.value)}
              placeholder="用空格或逗号分开"
            />
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => void saveEdit()} disabled={savingEdit}>
                {savingEdit ? "保存中…" : "保存修改"}
              </Button>
              <Button onClick={() => setEditing(null)}>取消</Button>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-5">
        <Link href="/works" className="cd-small text-violet">
          去「我的作品」看看已经长大的那些 →
        </Link>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条灵感？"
        description="删除后无法恢复。已经转成作品的内容不受影响。"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (!target) return;
          void (async () => {
            try {
              await store.deleteInspiration(target.id);
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
