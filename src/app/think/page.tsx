"use client";

import { useState } from "react";
import { SaveActions, suggestedTitle } from "@/components/SaveActions";
import { Button, Card, PageHeader, TextArea } from "@/components/ui";
import { countCharacters } from "@/lib/text";
import { THINKING_PROMPTS, pickPrompt } from "@/lib/training/prompts";

// 思维训练：同一件事，换一个人看，会变成另一件事。
export default function ThinkPage() {
  const [prompt, setPrompt] = useState(() => THINKING_PROMPTS[0]!);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");

  const combined = [first.trim(), second.trim()].filter(Boolean).join("\n\n———\n\n");

  return (
    <>
      <PageHeader
        eyebrow="THINK"
        title="思维训练"
        description="同一件事，换一个人看，会变成另一件事。"
        actions={
          <Button
            onClick={() =>
              setPrompt(pickPrompt(THINKING_PROMPTS, Math.random() * THINKING_PROMPTS.length))
            }
          >
            换一个题目
          </Button>
        }
      />

      <Card>
        <h2 className="font-serif text-[21px] leading-[1.6] text-ink md:text-[22px]">
          {prompt.text}
        </h2>
        <p className="cd-sub mt-2">{prompt.hint}</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="think-first" className="cd-small mb-2 block">
              第一种视角
            </label>
            <TextArea
              id="think-first"
              className="min-h-[240px]"
              value={first}
              onChange={(event) => setFirst(event.target.value)}
              placeholder="先写这一边……"
            />
          </div>
          <div>
            <label htmlFor="think-second" className="cd-small mb-2 block">
              第二种视角
            </label>
            <TextArea
              id="think-second"
              className="min-h-[240px]"
              value={second}
              onChange={(event) => setSecond(event.target.value)}
              placeholder="再写另一边……"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="cd-small">共 {countCharacters(combined)} 字符</span>
          <SaveActions
            text={combined}
            defaultTitle={suggestedTitle("换位", prompt.text)}
            tags={["思维训练"]}
          />
        </div>
      </Card>
    </>
  );
}
