"use client";

import { Fragment } from "react";
import { Eyebrow, Notice } from "@/components/ui";
import type { EchoResponse } from "@/lib/echo/types";

// 文学回声结果展示。
//
// 两条诚实性要求直接体现在界面上：
//   1. 明确标注「AI 语义匹配」还是「本地目录关键词匹配」；
//   2. 每条来源都给出可点击链接，并把「已核对 / 待核实」如实标出来。
export function EchoResults({
  response,
  loading,
  error,
  onRetry,
}: {
  response: EchoResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div className="mt-5 border-t border-line pt-5">
        <Eyebrow>LITERARY ECHOES</Eyebrow>
        <p className="cd-loading mt-3">正在从你的灵感里寻找回声……</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-5 border-t border-line pt-5">
        <Eyebrow>LITERARY ECHOES</Eyebrow>
        <div className="mt-3">
          <Notice tone="error">
            {error}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="ml-2 underline decoration-dotted underline-offset-2"
              >
                再试一次
              </button>
            ) : null}
          </Notice>
        </div>
      </div>
    );
  }

  if (!response) return null;

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>FOUND ECHOES</Eyebrow>
        <span className="cd-label">
          {response.generatedBy === "deepseek" ? "AI 语义匹配" : "本地目录关键词匹配"}
        </span>
      </div>

      <p className="cd-small mt-2">{response.catalogScope}</p>

      {response.notice ? (
        <div className="mt-3">
          <Notice tone={response.results.length === 0 ? "warn" : "info"}>{response.notice}</Notice>
        </div>
      ) : null}

      {hasAnalysis(response) ? (
        <div className="mt-4 space-y-2">
          <AnalysisRow label="主题" items={response.analysis.themes} />
          <AnalysisRow label="情绪" items={response.analysis.emotions} />
          <AnalysisRow label="意象" items={response.analysis.imagery} />
        </div>
      ) : null}

      {response.results.map((result) => (
        <article key={result.id} className="mt-5 border-t border-line pt-5">
          <h3 className="font-serif text-[18px] text-ink">
            《{result.title}》· {result.author}
          </h3>
          <p className="cd-small mt-1">
            {[result.year ? `${result.year} 年` : null, result.form].filter(Boolean).join(" · ")}
          </p>

          {result.matchedFacets.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-[6px]">
              {result.matchedFacets.map((facet) => (
                <Fragment key={facet.facet}>
                  {facet.terms.length > 0 ? (
                    <span className="cd-chip">
                      {facetLabel(facet.facet)}·{facet.terms.slice(0, 3).join("、")}
                    </span>
                  ) : null}
                  {(facet.related ?? []).map((item) => (
                    <span
                      key={`${facet.facet}-${item.term}`}
                      title={`由「${item.via}」联想到`}
                      className="cd-chip border-dashed text-[#7c736b]"
                    >
                      {facetLabel(facet.facet)}·{item.term}
                      <span className="opacity-70">← {item.via}</span>
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          ) : null}

          <p className="cd-prose mt-3 text-[14.5px]">{result.why}</p>

          {result.similarities.length > 0 ? (
            <ul className="mt-3 space-y-[6px]">
              {result.similarities.map((item) => (
                <li key={item} className="text-[13px] leading-[1.8] text-[#5f5851]">
                  <span className="text-violet">相似 · </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          {result.differences.length > 0 ? (
            <ul className="mt-2 space-y-[6px]">
              {result.differences.map((item) => (
                <li key={item} className="text-[13px] leading-[1.8] text-[#5f5851]">
                  <span className="text-warm">不同 · </span>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="cd-sub mt-3">建议这样读：{result.readingPath}</p>

          <div className="mt-3 flex flex-wrap items-baseline gap-2 text-[12px]">
            <a
              href={result.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet underline decoration-dotted underline-offset-2"
            >
              去 {result.source.label} 阅读 ↗
            </a>
            <span className="text-muted">
              {result.source.verified ? "来源已核对" : "来源待核实"}
              {result.source.edition ? ` · ${result.source.edition}` : ""}
            </span>
          </div>
          <p className="cd-small mt-1">{result.source.rights}</p>

          <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
            <a
              href={`https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(
                result.title,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-chip hover:border-[#ddd3c7]"
            >
              在微信读书里搜这本书 ↗
            </a>
            <a
              href={`https://search.douban.com/book/subject_search?search_text=${encodeURIComponent(
                result.title,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-chip hover:border-[#ddd3c7]"
            >
              在豆瓣里看简介 ↗
            </a>
          </div>
        </article>
      ))}

      <p className="cd-small mt-5">
        带 ← 的标签是捕梦从你的意象联想到的目录词（例如「太阳雨」联想到「雨」「阳光」），
        不是你原文里写过的词；实心的标签才是你真正写下的线索。
      </p>
      <p className="cd-small mt-5">
        捕梦不会伪造作品、作者或引文。作品信息与链接都来自本地目录，AI 只负责解释它们与你的灵感之间的关系。
      </p>
    </div>
  );
}

function hasAnalysis(response: EchoResponse): boolean {
  return (
    response.analysis.themes.length > 0 ||
    response.analysis.emotions.length > 0 ||
    response.analysis.imagery.length > 0
  );
}

function AnalysisRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="cd-small w-[28px] shrink-0">{label}</span>
      {items.map((item) => (
        <span key={item} className="cd-chip">
          {item}
        </span>
      ))}
    </div>
  );
}

const FACET_NAMES: Record<string, string> = {
  theme: "主题",
  emotion: "情绪",
  imagery: "意象",
  scene: "场景",
  time: "时间感",
  relation: "人物关系",
  narrative: "叙事",
};

function facetLabel(facet: string): string {
  return FACET_NAMES[facet] ?? facet;
}
