import { CATALOG } from "./catalog";
import { EXPANSION_WEIGHT, expandQuery } from "./expansion";
import type {
  CatalogEntry,
  CatalogKeyword,
  EchoFacet,
  EchoMatch,
  MatchedFacet,
} from "./types";

/**
 * 目录内的关键词检索。
 *
 * 这是一个刻意保持简单、可测试、可解释的检索器：中文用子串匹配，
 * 英文大小写归一。权重采用 IDF（越少见的词越说明问题）再乘以词长加成
 * （更长的词更具体）。
 *
 * 它的职责不是「决定最终推荐」，而是从目录里挑出候选作品，
 * 再交给模型做语义判断与解释。没有模型时，它本身也能给出诚实可用的结果。
 */

interface IndexedKeyword {
  term: string;
  normalized: string;
  facet: EchoFacet;
  entryIds: string[];
}

export interface CatalogIndex {
  entries: CatalogEntry[];
  keywords: IndexedKeyword[];
  byId: Map<string, CatalogEntry>;
  /** 归一化词 → 索引项，供意象扩展精确命中使用。 */
  byTerm: Map<string, IndexedKeyword>;
}

function normalize(term: string): string {
  return term.trim().toLowerCase();
}

/** 构建倒排索引。目录很小，每次调用重建的成本可以忽略。 */
export function buildIndex(entries: CatalogEntry[] = CATALOG): CatalogIndex {
  const map = new Map<string, IndexedKeyword>();

  for (const entry of entries) {
    for (const keyword of entry.keywords) {
      const normalized = normalize(keyword.term);
      if (!normalized) continue;
      const existing = map.get(normalized);
      if (existing) {
        if (!existing.entryIds.includes(entry.id)) existing.entryIds.push(entry.id);
      } else {
        map.set(normalized, {
          term: keyword.term,
          normalized,
          facet: keyword.facet,
          entryIds: [entry.id],
        });
      }
    }
  }

  return {
    entries,
    keywords: Array.from(map.values()),
    byId: new Map(entries.map((entry) => [entry.id, entry])),
    byTerm: map,
  };
}

const LONG_TERM_BONUS = 0.12;
const MAX_LENGTH_BONUS_TERM = 6;
// 单个汉字（雨、雪、夜……）出现在文本里，证据强度明显弱于「太阳雨」这类具体词，
// 因此打个折扣，让更具体的命中有机会排在前面。
const SINGLE_CHAR_DISCOUNT = 0.65;

/** 词长加成：两个字的词权重 1.24，六字及以上 1.72。 */
function lengthBonus(term: string): number {
  const len = Math.min(Array.from(term).length, MAX_LENGTH_BONUS_TERM);
  return 1 + len * LONG_TERM_BONUS;
}

/** 在查询文本中定位关键词所命中的原文片段，用于向用户解释「因为出现了什么」。 */
function matchedSnippet(query: string, normalizedTerm: string): string | null {
  const lowerQuery = query.toLowerCase();
  const index = lowerQuery.indexOf(normalizedTerm);
  if (index < 0) return null;
  return query.slice(index, index + normalizedTerm.length);
}

export interface SearchOptions {
  limit?: number;
  /** 每个维度最多计几个词，避免某一维度靠堆词数碾压其他维度。 */
  perFacetCap?: number;
}

const DEFAULT_LIMIT = 4;
const DEFAULT_FACET_CAP = 3;

/**
 * 检索目录，返回按相关度排序的作品。
 *
 * 只统计真正出现在文本里的关键词；不做同义扩展，也不臆测。
 * 因此当用户写的内容确实和目录无交集时，返回值可能为空 ——
 * 这是诚实的结果，调用方需要如实告知用户，而不是硬凑几条。
 */
export function searchCatalog(
  query: string,
  options: SearchOptions = {},
  index: CatalogIndex = buildIndex(),
): EchoMatch[] {
  const text = query.trim();
  if (!text) return [];

  const limit = options.limit ?? DEFAULT_LIMIT;
  const perFacetCap = options.perFacetCap ?? DEFAULT_FACET_CAP;
  const total = index.entries.length;

  interface Bucket {
    score: number;
    direct: Map<EchoFacet, Set<string>>;
    related: Map<EchoFacet, Map<string, string>>;
    counts: Map<EchoFacet, number>;
    /** 已经计过分的目录词（归一化），避免「太阳雨 → 雨」这种重复计分。 */
    counted: Map<EchoFacet, Set<string>>;
  }

  const hits = new Map<string, Bucket>();

  /** 占一个「按维度计词」的名额；超出上限就不再计分，避免同一维度堆词刷分。 */
  const takeSlot = (bucket: Bucket, facet: EchoFacet): boolean => {
    const used = bucket.counts.get(facet) ?? 0;
    if (used >= perFacetCap) return false;
    bucket.counts.set(facet, used + 1);
    return true;
  };

  const ensureBucket = (entryId: string): Bucket => {
    const existing = hits.get(entryId);
    if (existing) return existing;
    const created: Bucket = {
      score: 0,
      direct: new Map(),
      related: new Map(),
      counts: new Map(),
      counted: new Map(),
    };
    hits.set(entryId, created);
    return created;
  };

  const weightOf = (keyword: IndexedKeyword): number => {
    const idf = Math.log(1 + total / keyword.entryIds.length);
    const singleChar = Array.from(keyword.term).length === 1 ? SINGLE_CHAR_DISCOUNT : 1;
    return idf * lengthBonus(keyword.term) * singleChar;
  };

  /** 同一个词在同一维度上只计一次分。 */
  const claimTerm = (bucket: Bucket, facet: EchoFacet, term: string): boolean => {
    const used = bucket.counted.get(facet) ?? new Set<string>();
    if (used.has(term)) return false;
    used.add(term);
    bucket.counted.set(facet, used);
    return true;
  };

  // 第一轮：用户原文里直接出现的词
  for (const keyword of index.keywords) {
    const snippet = matchedSnippet(text, keyword.normalized);
    if (snippet === null) continue;
    const weight = weightOf(keyword);

    for (const entryId of keyword.entryIds) {
      const bucket = ensureBucket(entryId);
      if (!claimTerm(bucket, keyword.facet, keyword.normalized)) continue;
      if (!takeSlot(bucket, keyword.facet)) continue;
      bucket.score += weight;
      const set = bucket.direct.get(keyword.facet) ?? new Set<string>();
      // 记录用户文本里实际出现的写法，而不是目录里的关键词写法
      set.add(snippet);
      bucket.direct.set(keyword.facet, set);
    }
  }

  // 第二轮：由具体意象联想到的目录词，权重更低，且必须标注来源
  for (const expansion of expandQuery(text)) {
    for (const target of expansion.targets) {
      const keyword = index.byTerm.get(normalize(target));
      if (!keyword) continue;
      const weight = weightOf(keyword) * EXPANSION_WEIGHT;

      for (const entryId of keyword.entryIds) {
        const bucket = ensureBucket(entryId);
        if (!claimTerm(bucket, keyword.facet, keyword.normalized)) continue;
        if (!takeSlot(bucket, keyword.facet)) continue;
        bucket.score += weight;
        const map = bucket.related.get(keyword.facet) ?? new Map<string, string>();
        map.set(keyword.term, expansion.from);
        bucket.related.set(keyword.facet, map);
      }
    }
  }

  const results: EchoMatch[] = [];
  for (const [entryId, bucket] of hits) {
    const entry = index.byId.get(entryId);
    if (!entry) continue;

    const facets = new Set<EchoFacet>([...bucket.direct.keys(), ...bucket.related.keys()]);
    const matchedFacets: MatchedFacet[] = Array.from(facets)
      .map((facet) => {
        const related = bucket.related.get(facet);
        return {
          facet,
          terms: Array.from(bucket.direct.get(facet) ?? []),
          ...(related && related.size > 0
            ? {
                related: Array.from(related.entries()).map(([term, via]) => ({ term, via })),
              }
            : {}),
        };
      })
      // 维度越多越说明契合，先按命中词数量，再按维度名固定排序保证结果稳定
      .sort(
        (a, b) =>
          b.terms.length + (b.related?.length ?? 0) - (a.terms.length + (a.related?.length ?? 0)) ||
          a.facet.localeCompare(b.facet),
      );

    results.push({ entry, score: bucket.score, matchedFacets });
  }

  return results
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.matchedFacets.length - a.matchedFacets.length ||
        a.entry.id.localeCompare(b.entry.id),
    )
    .slice(0, limit);
}

/**
 * 当关键词检索一无所获时，给模型提供一份体裁分散的兜底候选。
 *
 * 注意：这**不是**推荐结果。调用方必须把它标记为「待模型判断的候选」，
 * 在没有模型的情况下不允许直接当成匹配结果展示给用户。
 */
export function fallbackCandidates(limit = 6, index: CatalogIndex = buildIndex()): EchoMatch[] {
  const seenForms = new Set<string>();
  const picked: CatalogEntry[] = [];

  for (const entry of index.entries) {
    if (seenForms.has(entry.form)) continue;
    seenForms.add(entry.form);
    picked.push(entry);
    if (picked.length >= limit) break;
  }
  // 体裁种类不足时按顺序补齐
  for (const entry of index.entries) {
    if (picked.length >= limit) break;
    if (!picked.includes(entry)) picked.push(entry);
  }

  return picked.map((entry) => ({ entry, score: 0, matchedFacets: [] }));
}

/** 从关键词命中推导出的粗略分析结果，用于无模型时如实展示「检索到了什么」。 */
export function deriveAnalysis(matches: EchoMatch[]): {
  themes: string[];
  emotions: string[];
  imagery: string[];
} {
  const collect = (facet: EchoFacet, limit: number): string[] => {
    const terms: string[] = [];
    for (const match of matches) {
      for (const matched of match.matchedFacets) {
        if (matched.facet !== facet) continue;
        for (const term of matched.terms) {
          if (!terms.includes(term)) terms.push(term);
        }
      }
    }
    return terms.slice(0, limit);
  };

  return {
    themes: collect("theme", 4),
    emotions: collect("emotion", 4),
    imagery: collect("imagery", 4),
  };
}

/** 供 API 使用的紧凑目录摘要，减少发给模型的 token 量。 */
export function toPromptCandidates(matches: EchoMatch[]) {
  return matches.map((match) => ({
    id: match.entry.id,
    title: match.entry.title,
    author: match.entry.author,
    year: match.entry.year ?? null,
    form: match.entry.form,
    summary: match.entry.summary,
    themes: match.entry.facets.theme,
    emotions: match.entry.facets.emotion,
    imagery: match.entry.facets.imagery,
    readingPath: match.entry.readingPath,
    matchedFacets: match.matchedFacets.map((item) => ({
      facet: item.facet,
      terms: item.terms,
      ...(item.related ? { relatedByAssociation: item.related } : {}),
    })),
  }));
}

export type { CatalogKeyword };
