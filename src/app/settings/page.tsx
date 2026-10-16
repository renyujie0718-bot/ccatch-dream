"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, ConfirmDialog, Notice, PageHeader } from "@/components/ui";
import { FEEDBACK_LENGTHS, POLISH_LEVELS } from "@/lib/ai/modes";
import { useStore } from "@/lib/data/store-provider";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/data/types";
import { downloadText, writingToMarkdown } from "@/lib/export";

interface ServerStatus {
  ai: { configured: boolean; model: string | null; maxInputChars: number };
  cloud: { configured: boolean };
  catalog: { source: string; liveSearch: boolean };
}

// 设置：账号、AI 偏好、数据导出与删除、隐私说明。
export default function SettingsPage() {
  const {
    store,
    ready,
    mode,
    user,
    cloudAvailable,
    signOut,
    importGuestDataIntoCloud,
    toast,
  } = useStore();

  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/status", { cache: "no-store" });
        if (!response.ok) throw new Error("bad status");
        setStatus((await response.json()) as ServerStatus);
      } catch {
        setStatusError("没能读取服务端配置状态。");
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        setPreferences(await store.getPreferences());
      } catch {
        /* 读取失败时保留默认值 */
      }
    })();
  }, [ready, store]);

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      setSavingPrefs(true);
      const optimistic = { ...preferences, ...patch };
      setPreferences(optimistic);
      try {
        const saved = await store.savePreferences(patch);
        setPreferences(saved);
        toast("偏好已保存。");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "保存偏好失败了。", "warn");
      } finally {
        setSavingPrefs(false);
      }
    },
    [preferences, store, toast],
  );

  const exportAll = async () => {
    try {
      const data = await store.exportAll();
      downloadText(
        `捕梦-数据导出-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8",
      );
      toast("数据已经导出。");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "导出失败了。", "warn");
    }
  };

  const exportWritingsAsMarkdown = async () => {
    try {
      const writings = await store.listWritings();
      if (writings.length === 0) {
        toast("还没有作品可以导出。", "warn");
        return;
      }
      const merged = writings.map((item) => writingToMarkdown(item)).join("\n\n\n");
      downloadText(
        `捕梦-全部作品-${new Date().toISOString().slice(0, 10)}.md`,
        merged,
        "text/markdown;charset=utf-8",
      );
      toast("作品已经导出。");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "导出失败了。", "warn");
    }
  };

  const importLocal = async () => {
    setImporting(true);
    try {
      const result = await importGuestDataIntoCloud();
      toast(
        result.inspirations + result.writings === 0
          ? "本机没有可导入的内容。"
          : `已经同步 ${result.inspirations} 条灵感、${result.writings} 篇作品。`,
      );
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "同步失败了。", "warn");
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="SETTINGS"
        title="设置"
        description="账号、AI 偏好、数据导出，以及捕梦如何处理你的文字。"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="cd-h3 mb-3">账号</h2>

          {!cloudAvailable ? (
            <Notice tone="warn">
              这个站点没有配置云端账号（缺少 <code>NEXT_PUBLIC_SUPABASE_URL</code> 与{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>）。
              目前所有数据保存在这台浏览器里，功能不受影响，但清理浏览器数据会丢失。
            </Notice>
          ) : user ? (
            <>
              <p className="cd-sub">
                已登录：<span className="break-all text-ink">{user.email}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => void signOut().then(() => toast("已经退出登录。"))}
                >
                  退出登录
                </Button>
                <Button onClick={() => void importLocal()} disabled={importing}>
                  {importing ? "同步中…" : "把本机内容同步到云端"}
                </Button>
              </div>
              <p className="cd-small mt-3">
                同步只会把本机现有的灵感和作品复制到云端，不会删除本机数据。
              </p>
            </>
          ) : (
            <>
              <p className="cd-sub">
                现在是访客模式。数据保存在这台浏览器里，换设备就看不到了。
              </p>
              <div className="mt-4">
                <Link href="/login" className="cd-btn cd-btn-primary">
                  用邮箱登录
                </Link>
              </div>
            </>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <div className="cd-small">
              当前模式：{mode === "cloud" ? "云端（数据存在自己的账号下）" : "访客（数据只在本机）"}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="cd-h3 mb-3">AI 偏好</h2>

          <label htmlFor="polish-level" className="cd-small mb-1 block">
            轻度润色的程度
          </label>
          <select
            id="polish-level"
            className="cd-select w-full"
            value={preferences.polishLevel}
            disabled={savingPrefs}
            onChange={(event) =>
              void updatePreferences({
                polishLevel: event.target.value as Preferences["polishLevel"],
              })
            }
          >
            {POLISH_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level === "light" ? "极轻：只处理明显的重复和不通顺" : "轻：可以调整语序"}
              </option>
            ))}
          </select>

          <label htmlFor="feedback-length" className="cd-small mt-4 mb-1 block">
            反馈长度
          </label>
          <select
            id="feedback-length"
            className="cd-select w-full"
            value={preferences.feedbackLength}
            disabled={savingPrefs}
            onChange={(event) =>
              void updatePreferences({
                feedbackLength: event.target.value as Preferences["feedbackLength"],
              })
            }
          >
            {FEEDBACK_LENGTHS.map((length) => (
              <option key={length} value={length}>
                {length === "short" ? "简短" : length === "long" ? "较详细" : "中等"}
              </option>
            ))}
          </select>

          <label className="mt-4 flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-[3px]"
              checked={preferences.autoSaveInspiration}
              disabled={savingPrefs}
              onChange={(event) =>
                void updatePreferences({ autoSaveInspiration: event.target.checked })
              }
            />
            <span className="cd-sub">
              使用「寻找文学回声」时，同时在灵感库留下这段文字。
            </span>
          </label>

          <div className="mt-5 border-t border-line pt-4">
            <div className="cd-small mb-2">服务端配置状态</div>
            {statusError ? (
              <p className="cd-small text-[#9a5f4c]">{statusError}</p>
            ) : !status ? (
              <p className="cd-loading">正在读取……</p>
            ) : (
              <ul className="cd-sub space-y-1">
                <li>
                  AI 写作伙伴：{" "}
                  {status.ai.configured ? (
                    <span className="text-violet">
                      已配置（模型 {status.ai.model}，单次上限 {status.ai.maxInputChars} 字符）
                    </span>
                  ) : (
                    <span className="text-warm">未配置 DEEPSEEK_API_KEY</span>
                  )}
                </li>
                <li>
                  云端账号：
                  {status.cloud.configured ? (
                    <span className="text-violet">已配置</span>
                  ) : (
                    <span className="text-warm">未配置</span>
                  )}
                </li>
                <li>
                  文学回声检索范围：{status.catalog.source}
                  {status.catalog.liveSearch ? "" : "（没有联网搜索）"}
                </li>
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="cd-h3 mb-3">数据</h2>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportAll()}>导出全部数据（JSON）</Button>
            <Button onClick={() => void exportWritingsAsMarkdown()}>
              导出全部作品（Markdown）
            </Button>
            <Button variant="danger" onClick={() => setPendingClear(true)}>
              删除我的全部数据
            </Button>
          </div>
          <p className="cd-small mt-3">
            删除操作只影响你自己的数据。访客模式下删除的是本机数据，云端模式下删除的是账号下的数据。
          </p>
        </Card>

        <Card>
          <h2 className="cd-h3 mb-3">隐私说明</h2>
          <ul className="cd-sub space-y-2">
            <li>
              · 使用「文学回声」或「AI 写作伙伴」时，你提交的文本会发送给 DeepSeek 用于生成反馈。
            </li>
            <li>
              · 服务端日志只记录请求编号、状态码和耗时，不记录你的文章内容，也不记录密钥。
            </li>
            <li>
              · 密钥只存在于服务端环境变量中，不会进入浏览器代码，也不会写进日志或 Git。
            </li>
            <li>
              · 访客模式的数据保存在这台浏览器里；云端模式的数据由数据库的行级安全策略隔离，
              其他用户无法读取。
            </li>
            <li>
              · 捕梦没有联网搜索能力，文学回声只在本地公版作品目录内检索，AI 不会凭空生成作品或链接。
            </li>
          </ul>
        </Card>
      </div>

      <ConfirmDialog
        open={pendingClear}
        title="删除我的全部数据？"
        description="灵感、作品、历史版本、文学回声记录和 AI 分析记录都会被删除，无法恢复。建议先导出一份。"
        confirmLabel="确认全部删除"
        onCancel={() => setPendingClear(false)}
        onConfirm={() => {
          setPendingClear(false);
          void (async () => {
            try {
              await store.clearAll();
              toast("数据已经删除。");
            } catch (cause) {
              toast(cause instanceof Error ? cause.message : "删除失败了。", "warn");
            }
          })();
        }}
      />
    </>
  );
}
