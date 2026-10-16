"use client";

import { useState } from "react";
import { SaveActions, suggestedTitle } from "@/components/SaveActions";
import { Button, Card, PageHeader, TextArea } from "@/components/ui";
import { countCharacters } from "@/lib/text";
import { OBSERVATION_PROMPTS, pickPrompt } from "@/lib/training/prompts";

// 观察训练：从物件、空间、声音、气味、动作切入，训练具体细节。
export default function ObservePage() {
  const [prompt, setPrompt] = useState(() => OBSERVATION_PROMPTS[0]!);
  const [text, setText] = useState("");

  return (
    <>
      <PageHeader
        eyebrow="OBSERVE"
        title="观察训练"
        description="文学有时只是把别人忽略的东西看久一点。"
        actions={
          <Button
            onClick={() =>
              setPrompt(pickPrompt(OBSERVATION_PROMPTS, Math.random() * OBSERVATION_PROMPTS.length))
            }
          >
            换一个物件
          </Button>
        }
      />

      <Card>
        <h2 className="font-serif text-[21px] leading-[1.6] text-ink md:text-[22px]">
          今天的物件：{prompt.text}
        </h2>
        <p className="cd-sub mt-2">{prompt.hint}</p>

        <div className="mt-4">
          <label htmlFor="observe-text" className="sr-only">
            观察记录
          </label>
          <TextArea
            id="observe-text"
            className="min-h-[300px]"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="写下你看见的、听见的、闻到的、摸到的。暂时不要解释它。"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="cd-small">{countCharacters(text)} 字符</span>
          <SaveActions
            text={text}
            defaultTitle={suggestedTitle("观察", prompt.text)}
            tags={["观察训练"]}
          />
        </div>
      </Card>
    </>
  );
}
