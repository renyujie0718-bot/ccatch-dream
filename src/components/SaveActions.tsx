"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/data/store-provider";
import { deriveTitle } from "@/lib/text";

// 训练页与自由写页共用的落盘动作：
// 「存进灵感库」和「存为草稿」都是真实可用的操作，不存在空壳按钮。
export function SaveActions({
  text,
  defaultTitle,
  tags,
  onSaved,
}: {
  text: string;
  defaultTitle?: string;
  tags?: string[];
  onSaved?: (kind: "inspiration" | "writing", id: string) => void;
}) {
  const { store, toast } = useStore();
  const router = useRouter();
  const [pending, setPending] = useState<"inspiration" | "writing" | null>(null);
  const content = text.trim();

  const saveInspiration = async () => {
    if (!content) {
      toast("先写一点东西。", "warn");
      return;
    }
    setPending("inspiration");
    try {
      const created = await store.createInspiration({ content, title: defaultTitle, tags });
      toast("已经存进灵感库。");
      onSaved?.("inspiration", created.id);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "保存失败了，请稍后再试。", "warn");
    } finally {
      setPending(null);
    }
  };

  const saveWriting = async () => {
    if (!content) {
      toast("先写一点东西。", "warn");
      return;
    }
    setPending("writing");
    try {
      const created = await store.createWriting({ content, title: defaultTitle, tags });
      toast("已经存为草稿。");
      onSaved?.("writing", created.id);
      router.push(`/works/${created.id}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "保存失败了，请稍后再试。", "warn");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="primary"
        onClick={() => void saveWriting()}
        disabled={pending !== null || !content}
      >
        {pending === "writing" ? "保存中…" : "存为草稿，继续写"}
      </Button>
      <Button onClick={() => void saveInspiration()} disabled={pending !== null || !content}>
        {pending === "inspiration" ? "保存中…" : "存进灵感库"}
      </Button>
    </div>
  );
}

// 给训练页生成一个小标题候选
export function suggestedTitle(prefix: string, prompt: string): string {
  return `${prefix}：${deriveTitle(prompt, "练习")}`;
}
