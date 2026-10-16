"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

interface AutosaveOptions<T> {
  // 当前内容。变化后经过 delay 毫秒触发保存。
  value: T;
  delay?: number;
  enabled?: boolean;
  save: (value: T) => Promise<void>;
  // 返回 false 表示这次变化不值得保存（例如没有实际改动）。
  shouldSave?: (next: T, previous: T) => boolean;
}

// 防抖自动保存。
//
// 设计要点：
//   1. 用序号（seq）丢弃迟到的结果，避免旧请求把「已保存」写回新内容上；
//   2. 组件卸载时把还没保存的内容补交一次，避免切页面丢字；
//   3. 状态机直接驱动界面上的「保存中 / 已保存 / 保存失败」。
export function useAutosave<T>(options: AutosaveOptions<T>) {
  const { value, delay = 1200, enabled = true } = options;
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const saveRef = useRef(options.save);
  const shouldSaveRef = useRef(options.shouldSave);
  const lastSavedRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const latestRef = useRef(value);

  latestRef.current = value;

  useEffect(() => {
    saveRef.current = options.save;
    shouldSaveRef.current = options.shouldSave;
  }, [options.save, options.shouldSave]);

  const commit = useCallback(async (next: T) => {
    const seq = (seqRef.current += 1);
    setState("saving");
    setError(null);
    try {
      await saveRef.current(next);
      lastSavedRef.current = next;
      if (seq === seqRef.current) setState("saved");
    } catch (cause) {
      if (seq === seqRef.current) {
        setState("error");
        setError(cause instanceof Error ? cause.message : "保存失败，请稍后再试。");
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const previous = lastSavedRef.current;
    if (previous !== null) {
      const checker = shouldSaveRef.current;
      if (checker && !checker(value, previous)) return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void commit(value);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay, enabled, commit]);

  // 卸载时补交一次未保存的内容（编辑器切换页面时尤其重要）
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const latest = latestRef.current;
      if (lastSavedRef.current !== latest && enabled) {
        void saveRef.current(latest);
      }
    };
  }, [enabled]);

  const saveNow = useCallback(
    async (next?: T) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      await commit(next ?? latestRef.current);
    },
    [commit],
  );

  // 切换作品时复位状态，避免显示上一份内容的保存结果。
  const reset = useCallback((baseline: T | null = null) => {
    lastSavedRef.current = baseline;
    if (baseline !== null) latestRef.current = baseline;
    setState("idle");
    setError(null);
  }, []);

  return { state, error, saveNow, reset };
}

// 保存状态的界面文案。
export function saveStateLabel(state: SaveState): string {
  switch (state) {
    case "saving":
      return "保存中…";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "尚未修改";
  }
}
