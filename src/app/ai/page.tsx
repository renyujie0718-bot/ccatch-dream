"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, EmptyState, Notice, PageHeader, TextArea } from "@/components/ui";
import { ApiClientError, requestAiFeedback } from "@/lib/api-client";
import type { AiFeedback } from "@/lib/ai/contract";
import { AI_MODES, MODE_HINTS, MODE_LABELS, type AiMode } from "@/lib/ai/modes";
import { useStore } from "@/lib/data/store-provider";
import type { Preferences, Writing } from "@/lib/data/types";
import { countCharacters } from "@/lib/text";

// AI 写作伙伴：五种模式，全部走服务端 API。
// 未配置密钥时显示准确提示，绝不返回伪造内容。
export default function AiPage() {
  const { store, ready, toast, mode: storeMode } = useStore();

  const [text, setText] = useState("");
  const [writings, setWritings] = useState<Writing[]>([]);
  const [selectedWritingId, setSelectedWritingId] = useState("");
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [result, setResult] = useState<AiFeedback | null>(null);
  const [running, setRunning] = useState<AiMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfig, setNeedsConfig] = useState(false);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const [nextWritings, nextPreferences] = await Promise.all([
          store.listWritings(),
          store.getPreferences(),
        ]);
        setWritings(nextWritings);
        setPreferences(nextPreferences);
      } catch {
        /* 读取失败时保持空列表，不影响手动粘贴文本 */
      }
    })();
  }, [ready, store]);

  const loadWriting = async (id: string) => {
    setSelectedWritingId(id);
    if (!id) return;
    try {
      const found = await store.getWriting(id);
      if (found) setText(found.content);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "读取作品失败了。", "warn");
    }
  };

  const run = useCallback(
    async (mode: AiMode) => {
      if (!text.trim()) {
        toast("先把要分析的文字放进来。", "warn");
        return;
      }
      setRunning(mode);
      setError(null);
      setNeedsConfig(false);
      try {
        const response = await requestAiFeedback({
          mode,
          text,
          polishLevel: preferences?.polishLevel,
          feedbackLength: preferences?.feedbackLength,
        });
        setResult(response);
        await store.saveFeedback({
          writingId: selectedWritingId || null,
          mode,
          feedback: response,
        });
      } catch (cause) {
        if (cause instanceof ApiClientError) {
          setNeedsConfig(cause.needsConfiguration);
          setError(cause.message);
        } else {
          setError(cause instanceof Error ? cause.message : "出了点问题，请稍后再试。");
        }
        setResult(null);
      } finally {
        setRunning(null);
      }
    },
    [text, preferences, store, selectedWritingId, toast],
  );

  return (
    <>
      <PageHeader
        eyebrow="AI WRITING COMPANION"
        title="AI 写作伙伴"
        description="你决定写什么，它帮你看见文字里还没被发现的东西。它不替你写完，也不评价你的天赋。"
      />

      {storeMode === "guest" ? (
        <div className="mb-4">
          <Notice>
            访客模式下，分析结果只保存在这台浏览器里。你发送的文本会传给 AI 服务用于生成反馈，
            不会用于其他用途。
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
            <label htmlFor="writing-picker" className="cd-small shrink-0">
              从作品载入
            </label>
            <select
              id="writing-picker"
              className="cd-select w-full"
              value={selectedWritingId}
              onChange={(event) => void loadWriting(event.target.value)}
            >
              <option value="">不载入，直接粘贴</option>
              {writings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <label htmlFor="ai-text" className="sr-only">
            待分析的文本
          </label>
          <TextArea
            id="ai-text"
            className="min-h-[400px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="把正在写的文章放进来。"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {AI_MODES.map((item) => (
              <Button
                key={item}
                variant={item === "feedback" ? "primary" : "default"}
                onClick={() => void run(item)}
                disabled={running !== null}
              >
                {running === item ? "正在读……" : MODE_LABELS[item]}
              </Button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="cd-small">{countCharacters(text)} 字符</span>
            {preferences ? (
              <span className="cd-small">
                润色程度：{preferences.polishLevel === "light" ? "极轻" : "轻"} · 反馈长度：
                {preferences.feedbackLength === "short"
                  ? "简短"
                  : preferences.feedbackLength === "long"
                    ? "较详细"
                    : "中等"}
                （在「设置」里可改）
              </span>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="cd-eyebrow">AI NOTES</div>

          {error ? (
            <div className="mt-4">
              <Notice tone={needsConfig ? "warn" : "error"}>
                {error}
                {needsConfig ? (
                  <>
                    <br />
                    在有权限的环境里设置 <code>DEEPSEEK_API_KEY</code> 与{" "}
                    <code>DEEPSEEK_MODEL</code> 后重新部署即可启用。写作诊断之外的功能不受影响。
                  </>
                ) : null}
              </Notice>
            </div>
          ) : null}

          {!result && !error ? (
            <div className="mt-4">
              <p className="cd-sub">
                把文字放进来，选一个模式。它会引用你原文里的具体句子来说明问题，
                而不是给一段通用的写作建议。
              </p>
              <ul className="mt-4 space-y-2">
                {AI_MODES.map((item) => (
                  <li key={item} className="text-[13px] leading-[1.8] text-[#5f5851]">
                    <span className="text-violet">{MODE_LABELS[item]}</span>：{MODE_HINTS[item]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result ? <FeedbackView feedback={result} /> : null}
        </Card>
      </div>
    </>
  );
}

function FeedbackView({ feedback }: { feedback: AiFeedback }) {
  return (
    <div className="mt-4">
      <div className="cd-label">{MODE_LABELS[feedback.mode]}</div>

      {feedback.headline ? (
        <p className="cd-prose mt-3 font-serif text-[16px]">{feedback.headline}</p>
      ) : null}

      {feedback.polish ? (
        <div className="mt-4 space-y-4">
          <div>
            <div className="cd-small mb-1">原文</div>
            <div className="cd-prose rounded-soft border border-line bg-[#fbf9f6] p-3 text-[14px]">
              {feedback.polish.original}
            </div>
          </div>
          <div>
            <div className="cd-small mb-1">修改稿</div>
            <div className="cd-prose rounded-soft border border-[#ddd3c7] bg-[#fffefb] p-3 text-[14px]">
              {feedback.polish.revised}
            </div>
          </div>
          <div>
            <div className="cd-small mb-1">改了哪里，为什么</div>
            {feedback.polish.changes.length === 0 ? (
              <p className="cd-sub">这次没有做改动，说明原文已经足够稳。</p>
            ) : (
              <ul className="space-y-3">
                {feedback.polish.changes.map((change, index) => (
                  <li key={`${change.original}-${index}`} className="cd-prose text-[13.5px]">
                    <div className="text-[#8d5a48] line-through decoration-dotted">
                      {change.original}
                    </div>
                    <div className="text-[#4b4540]">{change.revised}</div>
                    <div className="cd-small mt-1">原因：{change.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {feedback.notes.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {feedback.notes.map((note, index) => (
            <li key={`${note.quote}-${index}`}>
              <div className="border-l-2 border-violet2 pl-3 font-serif text-[14px] leading-[1.8] text-[#514a44]">
                {note.quote}
              </div>
              <p className="mt-2 text-[13.5px] leading-[1.85] text-[#4b4540]">{note.comment}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="这次没有可引用的具体句子"
            hint="可能是文本还比较短。再多写几句，它就能落到细节上了。"
          />
        </div>
      )}

      {feedback.suggestions.length > 0 ? (
        <div className="mt-5">
          <div className="cd-small mb-2">可以试试</div>
          <ul className="space-y-2">
            {feedback.suggestions.map((item) => (
              <li key={item} className="text-[13.5px] leading-[1.8] text-[#4b4540]">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback.nextStep ? (
        <div className="mt-5 rounded-soft border border-line bg-[#fbf9f6] p-3">
          <div className="cd-small mb-1">下一步</div>
          <p className="text-[13.5px] leading-[1.8] text-[#4b4540]">{feedback.nextStep}</p>
        </div>
      ) : null}

      <p className="cd-small mt-4">
        由 {feedback.model} 生成。
        {feedback.droppedNotes
          ? `有 ${feedback.droppedNotes} 条引用与原文不符，已经被丢弃。`
          : ""}
      </p>
    </div>
  );
}
