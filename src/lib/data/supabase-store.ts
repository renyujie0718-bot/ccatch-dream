import type { SupabaseClient } from "@supabase/supabase-js";
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
 * 云端存储（Supabase + RLS）。
 *
 * 每一条查询都不带 user_id 过滤条件之外的信任：RLS 策略要求
 * `auth.uid() = user_id`，即使用户伪造请求也只能看到自己的数据。
 * 这里仍然显式带上 user_id，既让策略成立，也让插入的数据归属明确。
 */

interface InspirationRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface WritingRow extends InspirationRow {
  source_inspiration_id: string | null;
}

interface VersionRow {
  id: string;
  writing_id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
}

interface EchoRow {
  id: string;
  user_id: string;
  inspiration_id: string | null;
  query_text: string;
  generated_by: "deepseek" | "local-catalog";
  results_json: EchoResult[];
  created_at: string;
}

interface FeedbackRow {
  id: string;
  user_id: string;
  writing_id: string | null;
  mode: AiMode;
  feedback: AiFeedback;
  created_at: string;
}

interface PreferenceRow {
  user_id: string;
  polish_level: Preferences["polishLevel"];
  feedback_length: Preferences["feedbackLength"];
  auto_save_inspiration: boolean;
  updated_at: string;
}

function toInspiration(row: InspirationRow): Inspiration {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWriting(row: WritingRow): Writing {
  return {
    ...toInspiration(row),
    sourceInspirationId: row.source_inspiration_id,
  };
}

// supabase-js 在未生成数据库类型时会把 data 推成 null，所以这里显式指定行类型
// 并在边界处做一次断言，之后所有字段访问都由 Row 接口约束。
function unwrap<T>(
  result: { data: unknown; error: { message: string } | null },
  fallbackMessage: string,
): T {
  if (result.error) throw new Error(friendlyMessage(result.error.message, fallbackMessage));
  if (result.data === null || result.data === undefined) throw new Error(fallbackMessage);
  return result.data as T;
}

/** 把数据库错误翻译成安静的中文提示，不暴露内部细节。 */
function friendlyMessage(raw: string, fallback: string): string {
  if (/row-level security|permission denied/i.test(raw)) {
    return "没有权限访问这条数据，请确认登录状态。";
  }
  if (/JWT|token|not authenticated/i.test(raw)) {
    return "登录状态已过期，请重新登录后再试。";
  }
  return fallback;
}

export class SupabaseStore implements DreamStore {
  readonly kind = "cloud" as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listInspirations(): Promise<Inspiration[]> {
    const result = await this.client
      .from("inspirations")
      .select("*")
      .order("updated_at", { ascending: false });
    return ((result.data ?? []) as InspirationRow[]).map(toInspiration);
  }

  async getInspiration(id: string): Promise<Inspiration | null> {
    const result = await this.client.from("inspirations").select("*").eq("id", id).maybeSingle();
    return result.data ? toInspiration(result.data as InspirationRow) : null;
  }

  async createInspiration(input: InspirationInput): Promise<Inspiration> {
    const content = input.content.trim();
    const row = unwrap<InspirationRow>(
      await this.client
        .from("inspirations")
        .insert({
          user_id: this.userId,
          title: input.title?.trim() || deriveTitle(content, "未命名灵感"),
          content,
          tags: normalizeTags(input.tags),
        })
        .select("*")
        .single(),
      "保存灵感失败，请稍后再试。",
    );
    return toInspiration(row);
  }

  async updateInspiration(
    id: string,
    patch: Partial<Pick<Inspiration, "title" | "content" | "tags">>,
  ): Promise<Inspiration> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.content !== undefined) payload.content = patch.content;
    if (patch.tags !== undefined) payload.tags = normalizeTags(patch.tags);

    const row = unwrap<InspirationRow>(
      await this.client.from("inspirations").update(payload).eq("id", id).select("*").single(),
      "更新灵感失败，请稍后再试。",
    );
    return toInspiration(row);
  }

  async deleteInspiration(id: string): Promise<void> {
    const { error } = await this.client.from("inspirations").delete().eq("id", id);
    if (error) throw new Error(friendlyMessage(error.message, "删除灵感失败，请稍后再试。"));
  }

  async listWritings(): Promise<Writing[]> {
    const result = await this.client
      .from("writings")
      .select("*")
      .order("updated_at", { ascending: false });
    return ((result.data ?? []) as WritingRow[]).map(toWriting);
  }

  async getWriting(id: string): Promise<Writing | null> {
    const result = await this.client.from("writings").select("*").eq("id", id).maybeSingle();
    return result.data ? toWriting(result.data as WritingRow) : null;
  }

  async createWriting(input: WritingInput): Promise<Writing> {
    const content = input.content ?? "";
    const row = unwrap<WritingRow>(
      await this.client
        .from("writings")
        .insert({
          user_id: this.userId,
          title: input.title?.trim() || deriveTitle(content, "未命名作品"),
          content,
          tags: normalizeTags(input.tags),
          source_inspiration_id: input.sourceInspirationId ?? null,
        })
        .select("*")
        .single(),
      "新建作品失败，请稍后再试。",
    );
    const writing = toWriting(row);
    await this.appendVersion(writing, true);
    return writing;
  }

  async saveWriting(
    id: string,
    patch: Partial<Pick<Writing, "title" | "content" | "tags">>,
  ): Promise<Writing> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) payload.title = patch.title.trim();
    if (patch.content !== undefined) payload.content = patch.content;
    if (patch.tags !== undefined) payload.tags = normalizeTags(patch.tags);

    const row = unwrap<WritingRow>(
      await this.client.from("writings").update(payload).eq("id", id).select("*").single(),
      "保存作品失败，请检查网络后重试。",
    );
    const writing = toWriting(row);
    await this.appendVersion(writing, false);
    return writing;
  }

  async deleteWriting(id: string): Promise<void> {
    const { error } = await this.client.from("writings").delete().eq("id", id);
    if (error) throw new Error(friendlyMessage(error.message, "删除作品失败，请稍后再试。"));
  }

  async listVersions(writingId: string): Promise<WritingVersion[]> {
    const result = await this.client
      .from("writing_versions")
      .select("*")
      .eq("writing_id", writingId)
      .order("created_at", { ascending: false })
      .limit(MAX_VERSIONS_PER_WRITING);
    return ((result.data ?? []) as VersionRow[]).map((row) => ({
      id: row.id,
      writingId: row.writing_id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
    }));
  }

  async restoreVersion(writingId: string, versionId: string): Promise<Writing> {
    const current = await this.getWriting(writingId);
    if (current) await this.appendVersion(current, true);

    const row = unwrap<VersionRow>(
      await this.client.from("writing_versions").select("*").eq("id", versionId).single(),
      "这个版本已经不存在了。",
    );
    return this.saveWriting(writingId, { content: row.content, title: row.title });
  }

  async listEchoes(): Promise<StoredEcho[]> {
    const result = await this.client
      .from("literary_echoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return ((result.data ?? []) as EchoRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      inspirationId: row.inspiration_id,
      queryText: row.query_text,
      generatedBy: row.generated_by,
      results: row.results_json ?? [],
      createdAt: row.created_at,
    }));
  }

  async saveEcho(input: Omit<StoredEcho, "id" | "createdAt" | "userId">): Promise<StoredEcho> {
    const row = unwrap<EchoRow>(
      await this.client
        .from("literary_echoes")
        .insert({
          user_id: this.userId,
          inspiration_id: input.inspirationId,
          query_text: input.queryText,
          generated_by: input.generatedBy,
          results_json: input.results,
        })
        .select("*")
        .single(),
      "保存文学回声失败，请稍后再试。",
    );
    return {
      id: row.id,
      userId: row.user_id,
      inspirationId: row.inspiration_id,
      queryText: row.query_text,
      generatedBy: row.generated_by,
      results: row.results_json ?? [],
      createdAt: row.created_at,
    };
  }

  async deleteEcho(id: string): Promise<void> {
    const { error } = await this.client.from("literary_echoes").delete().eq("id", id);
    if (error) throw new Error(friendlyMessage(error.message, "删除失败，请稍后再试。"));
  }

  async listFeedback(): Promise<StoredFeedback[]> {
    const result = await this.client
      .from("ai_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return ((result.data ?? []) as FeedbackRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      writingId: row.writing_id,
      mode: row.mode,
      feedback: row.feedback,
      createdAt: row.created_at,
    }));
  }

  async saveFeedback(
    input: Omit<StoredFeedback, "id" | "createdAt" | "userId">,
  ): Promise<StoredFeedback> {
    const row = unwrap<FeedbackRow>(
      await this.client
        .from("ai_feedback")
        .insert({
          user_id: this.userId,
          writing_id: input.writingId,
          mode: input.mode,
          feedback: input.feedback,
        })
        .select("*")
        .single(),
      "保存分析结果失败，请稍后再试。",
    );
    return {
      id: row.id,
      userId: row.user_id,
      writingId: row.writing_id,
      mode: row.mode,
      feedback: row.feedback,
      createdAt: row.created_at,
    };
  }

  async getPreferences(): Promise<Preferences> {
    const result = await this.client
      .from("preferences")
      .select("*")
      .eq("user_id", this.userId)
      .maybeSingle();
    const row = result.data as PreferenceRow | null;
    if (!row) return { ...DEFAULT_PREFERENCES };
    return {
      polishLevel: row.polish_level,
      feedbackLength: row.feedback_length,
      autoSaveInspiration: row.auto_save_inspiration,
      updatedAt: row.updated_at,
    };
  }

  async savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
    const current = await this.getPreferences();
    const next: Preferences = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const { error } = await this.client.from("preferences").upsert({
      user_id: this.userId,
      polish_level: next.polishLevel,
      feedback_length: next.feedbackLength,
      auto_save_inspiration: next.autoSaveInspiration,
      updated_at: next.updatedAt,
    });
    if (error) throw new Error(friendlyMessage(error.message, "保存偏好失败，请稍后再试。"));
    return next;
  }

  async exportAll(): Promise<WorkspaceExport> {
    return {
      app: "catch-dream",
      version: 2,
      exportedAt: new Date().toISOString(),
      mode: "cloud",
      inspirations: await this.listInspirations(),
      writings: await this.listWritings(),
      versions: await this.listAllVersions(),
      echoes: await this.listEchoes(),
      feedback: await this.listFeedback(),
      preferences: await this.getPreferences(),
    };
  }

  async clearAll(): Promise<void> {
    // 依赖外键的 on delete cascade 保证子表一并清理
    for (const table of ["inspirations", "writings", "literary_echoes", "ai_feedback"] as const) {
      const { error } = await this.client.from(table).delete().eq("user_id", this.userId);
      if (error) throw new Error(friendlyMessage(error.message, "删除数据失败，请稍后再试。"));
    }
  }

  private async listAllVersions(): Promise<WritingVersion[]> {
    const writings = await this.listWritings();
    const versions: WritingVersion[] = [];
    for (const writing of writings) {
      versions.push(...(await this.listVersions(writing.id)));
    }
    return versions;
  }

  private async appendVersion(writing: Writing, force: boolean): Promise<void> {
    const existing = await this.listVersions(writing.id);
    const latest = existing[0];

    if (!force && latest && latest.content === writing.content && latest.title === writing.title) {
      return;
    }

    await this.client.from("writing_versions").insert({
      id: createId(),
      writing_id: writing.id,
      user_id: this.userId,
      title: writing.title,
      content: writing.content,
    });

    // 超出上限时删除最旧的版本
    if (existing.length + 1 > MAX_VERSIONS_PER_WRITING) {
      const stale = existing.slice(MAX_VERSIONS_PER_WRITING - 1);
      for (const version of stale) {
        await this.client.from("writing_versions").delete().eq("id", version.id);
      }
    }
  }
}
