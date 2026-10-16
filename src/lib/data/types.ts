import type { AiFeedback } from "@/lib/ai/contract";
import type { AiMode, FeedbackLength, PolishLevel } from "@/lib/ai/modes";
import type { EchoResult } from "@/lib/echo/types";

/** 灵感。 */
export interface Inspiration {
  id: string;
  userId: string | null;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** 作品。 */
export interface Writing {
  id: string;
  userId: string | null;
  title: string;
  content: string;
  tags: string[];
  sourceInspirationId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 作品的历史版本。 */
export interface WritingVersion {
  id: string;
  writingId: string;
  userId: string | null;
  title: string;
  content: string;
  createdAt: string;
}

/** 保存下来的文学回声。 */
export interface StoredEcho {
  id: string;
  userId: string | null;
  inspirationId: string | null;
  queryText: string;
  generatedBy: "deepseek" | "local-catalog";
  results: EchoResult[];
  createdAt: string;
}

/** 保存下来的 AI 反馈。 */
export interface StoredFeedback {
  id: string;
  userId: string | null;
  writingId: string | null;
  mode: AiMode;
  feedback: AiFeedback;
  createdAt: string;
}

export interface Preferences {
  polishLevel: PolishLevel;
  feedbackLength: FeedbackLength;
  /** 使用「寻找文学回声」时是否同时把灵感存入灵感库。 */
  autoSaveInspiration: boolean;
  updatedAt: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  polishLevel: "light",
  feedbackLength: "standard",
  autoSaveInspiration: true,
  updatedAt: new Date(0).toISOString(),
};

/** 数据导出结构（设置页「导出全部数据」使用）。 */
export interface WorkspaceExport {
  app: "catch-dream";
  version: 2;
  exportedAt: string;
  mode: "guest" | "cloud";
  inspirations: Inspiration[];
  writings: Writing[];
  versions: WritingVersion[];
  echoes: StoredEcho[];
  feedback: StoredFeedback[];
  preferences: Preferences;
}

export interface InspirationInput {
  title?: string;
  content: string;
  tags?: string[];
}

export interface WritingInput {
  title?: string;
  content?: string;
  tags?: string[];
  sourceInspirationId?: string | null;
}

export interface GrowthStats {
  totalInspirations: number;
  todayInspirations: number;
  totalCharacters: number;
  todayCharacters: number;
  writingCount: number;
  echoCount: number;
  activeDays: number;
}

/** 数据源统一接口。访客模式与云端模式共用同一套方法签名。 */
export interface DreamStore {
  readonly kind: "guest" | "cloud";

  listInspirations(): Promise<Inspiration[]>;
  getInspiration(id: string): Promise<Inspiration | null>;
  createInspiration(input: InspirationInput): Promise<Inspiration>;
  updateInspiration(
    id: string,
    patch: Partial<Pick<Inspiration, "title" | "content" | "tags">>,
  ): Promise<Inspiration>;
  deleteInspiration(id: string): Promise<void>;

  listWritings(): Promise<Writing[]>;
  getWriting(id: string): Promise<Writing | null>;
  createWriting(input: WritingInput): Promise<Writing>;
  saveWriting(
    id: string,
    patch: Partial<Pick<Writing, "title" | "content" | "tags">>,
  ): Promise<Writing>;
  deleteWriting(id: string): Promise<void>;
  listVersions(writingId: string): Promise<WritingVersion[]>;
  restoreVersion(writingId: string, versionId: string): Promise<Writing>;

  listEchoes(): Promise<StoredEcho[]>;
  saveEcho(input: Omit<StoredEcho, "id" | "createdAt" | "userId">): Promise<StoredEcho>;
  deleteEcho(id: string): Promise<void>;

  listFeedback(): Promise<StoredFeedback[]>;
  saveFeedback(input: Omit<StoredFeedback, "id" | "createdAt" | "userId">): Promise<StoredFeedback>;

  getPreferences(): Promise<Preferences>;
  savePreferences(patch: Partial<Preferences>): Promise<Preferences>;

  exportAll(): Promise<WorkspaceExport>;
  clearAll(): Promise<void>;
}

/** 版本历史上限，避免无限增长。 */
export const MAX_VERSIONS_PER_WRITING = 20;

/** 灵感标签上限。 */
export const MAX_TAGS = 12;

/** 清洗标签输入：去空白、去重、限个数。 */
export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().replace(/^#/, "").slice(0, 24);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}
