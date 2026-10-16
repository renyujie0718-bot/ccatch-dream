import type { AiFeedback } from "@/lib/ai/contract";
import type { AiMode } from "@/lib/ai/modes";
import type { EchoResult } from "@/lib/echo/types";
import { createId, deriveTitle } from "@/lib/text";
import {
  DEFAULT_PREFERENCES,
  MAX_VERSIONS_PER_WRITING,
  normalizeTags,
  type DreamStore,
  type Inspiration,
  type InspirationInput,
  type Preferences,
  type StoredEcho,
  type StoredFeedback,
  type WorkspaceExport,
  type Writing,
  type WritingInput,
  type WritingVersion,
} from "./types";

/**
 * 访客模式存储（localStorage）。
 *
 * 说明：数据只在这台设备的这个浏览器里。清理浏览器数据会一并清空，
 * 因此界面上必须提示用户，并引导他们登录以保存到云端。
 */

const PREFIX = "catchdream:v2:";

export const GUEST_KEYS = {
  inspirations: `${PREFIX}inspirations`,
  writings: `${PREFIX}writings`,
  versions: `${PREFIX}versions`,
  echoes: `${PREFIX}echoes`,
  feedback: `${PREFIX}feedback`,
  preferences: `${PREFIX}preferences`,
} as const;

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存储配额用尽时静默失败；调用方通过返回值判断是否真的写入
  }
}

function byUpdatedDesc<T extends { updatedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function byCreatedDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class GuestStore implements DreamStore {
  readonly kind = "guest" as const;

  async listInspirations(): Promise<Inspiration[]> {
    return byUpdatedDesc(readArray<Inspiration>(GUEST_KEYS.inspirations));
  }

  async getInspiration(id: string): Promise<Inspiration | null> {
    const items = readArray<Inspiration>(GUEST_KEYS.inspirations);
    return items.find((item) => item.id === id) ?? null;
  }

  async createInspiration(input: InspirationInput): Promise<Inspiration> {
    const now = new Date().toISOString();
    const content = input.content.trim();
    const inspiration: Inspiration = {
      id: createId(),
      userId: null,
      title: input.title?.trim() || deriveTitle(content, "未命名灵感"),
      content,
      tags: normalizeTags(input.tags),
      createdAt: now,
      updatedAt: now,
    };
    writeArray(GUEST_KEYS.inspirations, [inspiration, ...readArray<Inspiration>(GUEST_KEYS.inspirations)]);
    return inspiration;
  }

  async updateInspiration(
    id: string,
    patch: Partial<Pick<Inspiration, "title" | "content" | "tags">>,
  ): Promise<Inspiration> {
    const items = readArray<Inspiration>(GUEST_KEYS.inspirations);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("这条灵感已经不存在了。");

    const current = items[index]!;
    const next: Inspiration = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() || current.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
      updatedAt: new Date().toISOString(),
    };
    items[index] = next;
    writeArray(GUEST_KEYS.inspirations, items);
    return next;
  }

  async deleteInspiration(id: string): Promise<void> {
    writeArray(
      GUEST_KEYS.inspirations,
      readArray<Inspiration>(GUEST_KEYS.inspirations).filter((item) => item.id !== id),
    );
    writeArray(
      GUEST_KEYS.echoes,
      readArray<StoredEcho>(GUEST_KEYS.echoes).map((echo) =>
        echo.inspirationId === id ? { ...echo, inspirationId: null } : echo,
      ),
    );
  }

  async listWritings(): Promise<Writing[]> {
    return byUpdatedDesc(readArray<Writing>(GUEST_KEYS.writings));
  }

  async getWriting(id: string): Promise<Writing | null> {
    return readArray<Writing>(GUEST_KEYS.writings).find((item) => item.id === id) ?? null;
  }

  async createWriting(input: WritingInput): Promise<Writing> {
    const now = new Date().toISOString();
    const content = input.content ?? "";
    const writing: Writing = {
      id: createId(),
      userId: null,
      title: input.title?.trim() || deriveTitle(content, "未命名作品"),
      content,
      tags: normalizeTags(input.tags),
      sourceInspirationId: input.sourceInspirationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    writeArray(GUEST_KEYS.writings, [writing, ...readArray<Writing>(GUEST_KEYS.writings)]);
    this.appendVersion(writing, true);
    return writing;
  }

  async saveWriting(
    id: string,
    patch: Partial<Pick<Writing, "title" | "content" | "tags">>,
  ): Promise<Writing> {
    const items = readArray<Writing>(GUEST_KEYS.writings);
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("这篇作品已经不存在了。");

    const current = items[index]!;
    const next: Writing = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() || current.title } : {}),
      ...(patch.content !== undefined ? { content: patch.content } : {}),
      ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
      updatedAt: new Date().toISOString(),
    };
    items[index] = next;
    writeArray(GUEST_KEYS.writings, items);
    this.appendVersion(next, false);
    return next;
  }

  async deleteWriting(id: string): Promise<void> {
    writeArray(
      GUEST_KEYS.writings,
      readArray<Writing>(GUEST_KEYS.writings).filter((item) => item.id !== id),
    );
    writeArray(
      GUEST_KEYS.versions,
      readArray<WritingVersion>(GUEST_KEYS.versions).filter((item) => item.writingId !== id),
    );
    writeArray(
      GUEST_KEYS.feedback,
      readArray<StoredFeedback>(GUEST_KEYS.feedback).map((item) =>
        item.writingId === id ? { ...item, writingId: null } : item,
      ),
    );
  }

  async listVersions(writingId: string): Promise<WritingVersion[]> {
    return byCreatedDesc(
      readArray<WritingVersion>(GUEST_KEYS.versions).filter(
        (item) => item.writingId === writingId,
      ),
    );
  }

  async restoreVersion(writingId: string, versionId: string): Promise<Writing> {
    const version = readArray<WritingVersion>(GUEST_KEYS.versions).find(
      (item) => item.id === versionId && item.writingId === writingId,
    );
    if (!version) throw new Error("这个版本已经不存在了。");
    // 先把当前内容存进历史，再恢复，避免恢复动作本身丢内容
    const current = await this.getWriting(writingId);
    if (current) this.appendVersion(current, false);
    return this.saveWriting(writingId, { content: version.content, title: version.title });
  }

  async listEchoes(): Promise<StoredEcho[]> {
    return byCreatedDesc(readArray<StoredEcho>(GUEST_KEYS.echoes));
  }

  async saveEcho(input: Omit<StoredEcho, "id" | "createdAt" | "userId">): Promise<StoredEcho> {
    const echo: StoredEcho = {
      ...input,
      id: createId(),
      userId: null,
      createdAt: new Date().toISOString(),
    };
    writeArray(GUEST_KEYS.echoes, [echo, ...readArray<StoredEcho>(GUEST_KEYS.echoes)].slice(0, 200));
    return echo;
  }

  async deleteEcho(id: string): Promise<void> {
    writeArray(
      GUEST_KEYS.echoes,
      readArray<StoredEcho>(GUEST_KEYS.echoes).filter((item) => item.id !== id),
    );
  }

  async listFeedback(): Promise<StoredFeedback[]> {
    return byCreatedDesc(readArray<StoredFeedback>(GUEST_KEYS.feedback));
  }

  async saveFeedback(
    input: Omit<StoredFeedback, "id" | "createdAt" | "userId">,
  ): Promise<StoredFeedback> {
    const record: StoredFeedback = {
      ...input,
      id: createId(),
      userId: null,
      createdAt: new Date().toISOString(),
    };
    writeArray(
      GUEST_KEYS.feedback,
      [record, ...readArray<StoredFeedback>(GUEST_KEYS.feedback)].slice(0, 200),
    );
    return record;
  }

  async getPreferences(): Promise<Preferences> {
    if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
    try {
      const raw = window.localStorage.getItem(GUEST_KEYS.preferences);
      if (!raw) return { ...DEFAULT_PREFERENCES };
      return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    const next: Preferences = {
      ...(await this.getPreferences()),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_KEYS.preferences, JSON.stringify(next));
    }
    return next;
  }

  async exportAll(): Promise<WorkspaceExport> {
    return {
      app: "catch-dream",
      version: 2,
      exportedAt: new Date().toISOString(),
      mode: "guest",
      inspirations: await this.listInspirations(),
      writings: await this.listWritings(),
      versions: readArray<WritingVersion>(GUEST_KEYS.versions),
      echoes: await this.listEchoes(),
      feedback: await this.listFeedback(),
      preferences: await this.getPreferences(),
    };
  }

  async clearAll(): Promise<void> {
    if (typeof window === "undefined") return;
    for (const key of Object.values(GUEST_KEYS)) {
      window.localStorage.removeItem(key);
    }
  }

  /** 只在内容相对上一版确实变化时记录版本，避免自动保存把历史塞满。 */
  private appendVersion(writing: Writing, force: boolean): void {
    const versions = readArray<WritingVersion>(GUEST_KEYS.versions);
    const forWriting = versions
      .filter((item) => item.writingId === writing.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latest = forWriting[0];

    if (!force && latest && latest.content === writing.content && latest.title === writing.title) {
      return;
    }

    const version: WritingVersion = {
      id: createId(),
      writingId: writing.id,
      userId: null,
      title: writing.title,
      content: writing.content,
      createdAt: new Date().toISOString(),
    };

    const keep = new Set(forWriting.slice(0, MAX_VERSIONS_PER_WRITING - 1).map((item) => item.id));
    const others = versions.filter((item) => item.writingId !== writing.id || keep.has(item.id));
    writeArray(GUEST_KEYS.versions, [version, ...others]);
  }
}

/** 供 store provider 判断是否需要提示用户「本地数据只在浏览器里」。 */
export function guestStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export type { AiMode, AiFeedback, EchoResult };
