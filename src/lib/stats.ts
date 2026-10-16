import type { GrowthStats, Inspiration, StoredEcho, StoredFeedback, Writing } from "@/lib/data/types";
import { countCharacters } from "@/lib/text";

// 统计逻辑集中在这里，首页与「成长记录」共用同一套口径，并被单元测试覆盖。
//
// 口径说明（界面上也会如实标注）：
//   - 字数按「去掉空白后的字符数」计算，中文一个字算一个字符；
//   - 「今天」以浏览器本地时区为准；
//   - 「连续记录」按有灵感、有作品更新或有文学回声的自然日计算。

export function localDayKey(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface StatsInput {
  inspirations: Inspiration[];
  writings: Writing[];
  echoes: StoredEcho[];
  feedback?: StoredFeedback[];
}

/** 所有「发生过事情」的日期集合。 */
export function activeDaySet(input: StatsInput): Set<string> {
  const days = new Set<string>();
  for (const item of input.inspirations) days.add(localDayKey(item.createdAt));
  for (const item of input.writings) {
    days.add(localDayKey(item.createdAt));
    days.add(localDayKey(item.updatedAt));
  }
  for (const item of input.echoes) days.add(localDayKey(item.createdAt));
  for (const item of input.feedback ?? []) days.add(localDayKey(item.createdAt));
  days.delete("");
  return days;
}

/** 从今天往前数，连续有记录的天数。今天没有记录时从昨天开始数。 */
export function streakDays(days: Set<string>, today: Date = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let streak = 0;

  if (!days.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayKey(cursor))) return 0;
  }

  while (days.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeGrowthStats(input: StatsInput, today: Date = new Date()): GrowthStats {
  const todayKey = localDayKey(today);

  const todayInspirations = input.inspirations.filter(
    (item) => localDayKey(item.createdAt) === todayKey,
  ).length;

  const totalCharacters = input.writings.reduce(
    (sum, item) => sum + countCharacters(item.content),
    0,
  );

  // 今天写下的字数：今天更新过的作品的字符数。不做精确 diff，
  // 因为 MVP 没有逐日快照；界面上标注为「今天改动的作品字数」。
  const todayCharacters = input.writings
    .filter((item) => localDayKey(item.updatedAt) === todayKey)
    .reduce((sum, item) => sum + countCharacters(item.content), 0);

  return {
    totalInspirations: input.inspirations.length,
    todayInspirations,
    totalCharacters,
    todayCharacters,
    writingCount: input.writings.length,
    echoCount: input.echoes.length,
    activeDays: activeDaySet(input).size,
  };
}

/** 最近 N 天的日期键，用于成长记录的活动格子。 */
export function recentDayKeys(days: number, today: Date = new Date()): string[] {
  const keys: string[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() - index);
    keys.push(localDayKey(date));
  }
  return keys;
}
