"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SaveActions, suggestedTitle } from "@/components/SaveActions";
import { Button, Card, Notice, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";
import { CARD_PROMPTS, pickPrompt } from "@/lib/training/prompts";

// 灵感抽卡：不是命题作文，只推用户一小步。
export default function CardsPage() {
  const router = useRouter();
  const { setSeed } = useStore();
  const [card, setCard] = useState<(typeof CARD_PROMPTS)[number] | null>(null);

  const draw = () => {
    setCard(pickPrompt(CARD_PROMPTS, Math.random() * CARD_PROMPTS.length));
  };

  return (
    <>
      <PageHeader
        eyebrow="PROMPT CARDS"
        title="灵感抽卡"
        description="不是命题作文，只推你一小步。抽到不喜欢的，再抽一张就好。"
      />

      <Card className="text-center">
        <p className="mx-auto my-8 max-w-[700px] font-serif text-[24px] leading-[1.7] text-ink md:text-[27px]">
          {card ? card.text : "抽一张，看看今天会遇见什么。"}
        </p>
        {card ? <p className="cd-sub mb-6">{card.hint}</p> : null}

        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="primary" onClick={draw}>
            抽一张
          </Button>
          <Button
            onClick={() => {
              if (!card) {
                draw();
                return;
              }
              setSeed(card.text);
              router.push("/");
            }}
          >
            把它带回首页
          </Button>
        </div>

        {card ? (
          <div className="mt-6 flex justify-center">
            <SaveActions
              text={card.text}
              defaultTitle={suggestedTitle("引子", card.text)}
              tags={["抽卡"]}
            />
          </div>
        ) : (
          <p className="cd-small mt-6">
            抽到的引子可以直接带回首页当开头，也可以存进灵感库，之后再回来。
          </p>
        )}
      </Card>

      <div className="mt-5">
        <Notice>
          抽卡不会记录成绩，也不会累计连续天数。它只是把注意力从「写什么」挪开一会儿。
        </Notice>
      </div>
    </>
  );
}
