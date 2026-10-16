"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Notice, PageHeader, TextArea } from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";
import { saveStateLabel, useAutosave } from "@/lib/hooks/useAutosave";
import { countCharacters } from "@/lib/text";

const DURATION_SECONDS = 15 * 60;

// 自由写：十五分钟计时器 + 实时保存。
// 刻意不显示评分、连胜或成就；计时结束只是温和地提示一下。
export default function WritePage() {
  const { store, ready, toast } = useStore();
  const [text, setText] = useState("");
  const [writingId, setWritingId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(DURATION_SECONDS);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [creating, setCreating] = useState(false);

  const writingIdRef = useRef<string | null>(null);
  writingIdRef.current = writingId;

  const persist = useCallback(
    async (next: string) => {
      const content = next.trim();
      if (!content) return;
      const currentId = writingIdRef.current;
      if (!currentId) {
        setCreating(true);
        try {
          const created = await store.createWriting({ content: next });
          setWritingId(created.id);
        } finally {
          setCreating(false);
        }
        return;
      }
      await store.saveWriting(currentId, { content: next });
    },
    [store],
  );

  const { state, error, saveNow } = useAutosave<string>({
    value: text,
    delay: 1500,
    enabled: ready,
    save: persist,
    shouldSave: (next, previous) => next !== previous,
  });

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          setRunning(false);
          setFinished(true);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  // 计时结束时把已经写下的内容补交保存一次
  useEffect(() => {
    if (!finished) return;
    void saveNow().catch(() => {
      /* 保存失败时 useAutosave 已经把状态切成 error，界面上会显示 */
    });
  }, [finished, saveNow]);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <>
      <PageHeader
        eyebrow="FREE WRITING"
        title="十五分钟自由写"
        description="不追求好，只要求继续。写下的字会自动保存到「我的作品」。"
      />

      <Card>
        <div className="my-4 text-center font-serif text-[52px] leading-none tracking-[2px] text-ink md:text-[58px]">
          {minutes}:{seconds}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setFinished(false);
              setRunning((current) => !current);
            }}
          >
            {running ? "暂停" : remaining === DURATION_SECONDS ? "开始" : "继续"}
          </Button>
          <Button
            onClick={() => {
              setRunning(false);
              setFinished(false);
              setRemaining(DURATION_SECONDS);
            }}
          >
            重置
          </Button>
          <Button
            onClick={() => {
              if (!text.trim()) {
                toast("还没有内容可以保存。", "warn");
                return;
              }
              void saveNow()
                .then(() => toast("已经保存。"))
                .catch(() => toast("保存失败，请稍后再试。", "warn"));
            }}
          >
            保存一下
          </Button>
        </div>

        {finished ? (
          <div className="mt-4">
            <Notice tone="warn">
              十五分钟到了。想停就停，想继续写也完全可以——计时器不评价你写了多少。
            </Notice>
          </div>
        ) : null}

        <div className="mt-4">
          <label htmlFor="freewrite" className="sr-only">
            自由写内容
          </label>
          <TextArea
            id="freewrite"
            className="min-h-[390px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="从一个词开始也可以……"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="cd-small">{countCharacters(text)} 字符</span>
          <span className="cd-small text-[#6b625b]">
            {creating ? "正在新建作品…" : saveStateLabel(state)}
          </span>
          {writingId ? (
            <a href={`/works/${writingId}`} className="cd-small text-violet">
              打开这篇文章
            </a>
          ) : null}
          {error ? <span className="cd-small text-[#9a5f4c]">{error}</span> : null}
        </div>
      </Card>
    </>
  );
}
