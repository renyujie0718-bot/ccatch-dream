import { AiNotConfiguredError, AiUpstreamError, callDeepSeekJson } from "@/lib/ai/deepseek";
import { ECHO_SYSTEM_PROMPT, buildEchoPrompt } from "@/lib/ai/prompts";
import { echoRequestSchema, modelEchoSchema } from "@/lib/ai/schemas";
import { apiError, apiOk, describeValidationIssues, logRequest } from "@/lib/api/respond";
import { CATALOG_SCOPE, getCatalogEntry } from "@/lib/echo/catalog";
import {
  buildIndex,
  deriveAnalysis,
  fallbackCandidates,
  searchCatalog,
  toPromptCandidates,
} from "@/lib/echo/search";
import type { EchoResponse, EchoResult } from "@/lib/echo/types";
import { FACET_LABELS } from "@/lib/echo/types";
import { isAiConfigured, serverEnv } from "@/lib/env";
import { checkRateLimit, clientKeyFrom } from "@/lib/rate-limit";
import { createId } from "@/lib/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE = "/api/literary-echoes";
const MAX_RESULTS = 3;

export async function POST(request: Request): Promise<Response> {
  const requestId = createId();
  const startedAt = Date.now();

  const finish = (response: Response, code?: string) => {
    logRequest({
      requestId,
      route: ROUTE,
      status: response.status,
      durationMs: Date.now() - startedAt,
      code,
    });
    return response;
  };

  const limit = checkRateLimit(
    `echo:${clientKeyFrom(request)}`,
    serverEnv.ai.rateLimitMax,
    serverEnv.ai.rateLimitWindowSeconds,
  );
  if (!limit.allowed) {
    return finish(
      apiError("RATE_LIMITED", `先歇一下，${limit.retryAfterSeconds} 秒后再来。`, {
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      }),
      "RATE_LIMITED",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return finish(apiError("INVALID_INPUT", "请求内容不是合法的 JSON。"), "INVALID_INPUT");
  }

  const parsed = echoRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const message = describeValidationIssues(parsed.error.issues);
    const tooLong = parsed.error.issues.some((issue) => issue.message.includes("最多分析"));
    return finish(
      apiError(tooLong ? "INPUT_TOO_LONG" : "INVALID_INPUT", message),
      tooLong ? "INPUT_TOO_LONG" : "INVALID_INPUT",
    );
  }

  const query = parsed.data.text;
  const index = buildIndex();

  // 检索始终发生在本地受控目录里；作品信息与来源 URL 只来自目录，模型无法提供。
  const matches = searchCatalog(query, { limit: 8 }, index);
  const hasKeywordHits = matches.length > 0;

  if (!isAiConfigured()) {
    const results: EchoResult[] = matches.slice(0, MAX_RESULTS).map((match) => {
      const directText = match.matchedFacets
        .filter((item) => item.terms.length > 0)
        .map((item) => `${FACET_LABELS[item.facet]}（${item.terms.join("、")}）`)
        .join("、");
      const related = match.matchedFacets.flatMap((item) =>
        (item.related ?? []).map((entry) => ({ ...entry, facet: item.facet })),
      );
      const viaWords = Array.from(new Set(related.map((item) => item.via)));
      const relatedTerms = Array.from(new Set(related.map((item) => item.term)));
      const themes = match.entry.facets.theme.slice(0, 2).join("」「");

      const whyParts: string[] = [];
      if (directText) {
        whyParts.push(`本地目录在你的文字里匹配到这些线索：${directText}。`);
      }
      if (relatedTerms.length > 0) {
        whyParts.push(
          `另外，「${viaWords.join("」「")}」这样具体的意象，还可以往「${relatedTerms.join(
            "」「",
          )}」这些方向走近一点。`,
        );
      }
      whyParts.push(`这本书在「${themes}」这些方向上与之相邻。`);

      return {
        id: match.entry.id,
        title: match.entry.title,
        author: match.entry.author,
        year: match.entry.year,
        form: match.entry.form,
        why: whyParts.join(""),
        similarities: [
          ...match.matchedFacets
            .filter((item) => item.terms.length > 0)
            .map((item) => `${FACET_LABELS[item.facet]}：${item.terms.join("、")}`),
          ...related.map(
            (item) =>
              `${FACET_LABELS[item.facet]}：由「${item.via}」联想到「${item.term}」`,
          ),
        ],
        differences: [
          "现在还没有配置 AI，这里是关键词与意象关联层面的相遇，没有做语义分析；两者是否真的相通，要等你读几页才知道。",
        ],
        readingPath: match.entry.readingPath,
        matchedFacets: match.matchedFacets,
        source: match.entry.source,
      };
    });

    const body: EchoResponse = {
      generatedBy: "local-catalog",
      catalogScope: CATALOG_SCOPE,
      analysis: deriveAnalysis(matches),
      results,
      notice: hasKeywordHits
        ? "当前未配置 DeepSeek，下面是本地公版作品目录的关键词与意象匹配结果，未经语义分析。配置 DEEPSEEK_API_KEY 后，会由模型做语义判断并写出更具体的关联解释。"
        : "本地公版目录里没有找到明显相关的作品。可以试着写得更具体一些——一个物件、一个动作、一段声音，往往比抽象的情绪更容易找到回声。",
    };
    return finish(apiOk(body));
  }

  // 有 AI 时：关键词检索挑出候选；若一个都没命中，则给模型一份体裁分散的兜底候选，
  // 由模型自己判断是否存在契合（允许它返回空结果，不硬凑）。
  const candidates = hasKeywordHits ? matches : fallbackCandidates(8, index);

  try {
    const raw = await callDeepSeekJson({
      system: ECHO_SYSTEM_PROMPT,
      user: buildEchoPrompt(query, toPromptCandidates(candidates)),
      maxTokens: 1400,
      temperature: 0.45,
    });

    const modelOutput = modelEchoSchema.safeParse(raw);
    if (!modelOutput.success) {
      return finish(
        apiError("BAD_MODEL_OUTPUT", "这次返回的内容没能读懂，请再试一次。"),
        "BAD_MODEL_OUTPUT",
      );
    }

    const candidateIds = new Set(candidates.map((match) => match.entry.id));
    const results: EchoResult[] = [];

    for (const item of modelOutput.data.results) {
      // 关键防线：模型只能引用候选列表里的 id，否则整条丢弃
      if (!candidateIds.has(item.id)) continue;
      const entry = getCatalogEntry(item.id);
      if (!entry) continue;

      const keywordMatch = matches.find((match) => match.entry.id === item.id);
      results.push({
        id: entry.id,
        title: entry.title,
        author: entry.author,
        year: entry.year,
        form: entry.form,
        why: item.similarities.join("；") || entry.summary,
        similarities: item.similarities,
        differences: item.differences,
        readingPath: item.readingPath || entry.readingPath,
        matchedFacets: keywordMatch?.matchedFacets ?? [],
        // 来源永远取自目录，而不是模型输出
        source: entry.source,
      });
      if (results.length >= MAX_RESULTS) break;
    }

    const body: EchoResponse = {
      generatedBy: "deepseek",
      catalogScope: CATALOG_SCOPE,
      analysis: {
        themes: modelOutput.data.analysis.themes.slice(0, 4),
        emotions: modelOutput.data.analysis.emotions.slice(0, 4),
        imagery: modelOutput.data.analysis.imagery.slice(0, 4),
      },
      results,
      notice:
        results.length === 0
          ? "这次没有找到真正契合的作品。与其硬凑一篇，不如把灵感再写具体一点——一个场景、一个动作、一种具体的味道。"
          : undefined,
    };

    return finish(apiOk(body));
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return finish(apiError("AI_NOT_CONFIGURED", error.message), "AI_NOT_CONFIGURED");
    }
    if (error instanceof AiUpstreamError) {
      const code =
        error.code === "UPSTREAM_TIMEOUT"
          ? "UPSTREAM_TIMEOUT"
          : error.code === "BAD_MODEL_OUTPUT"
            ? "BAD_MODEL_OUTPUT"
            : "UPSTREAM_ERROR";
      return finish(apiError(code, error.message, { status: error.status }), code);
    }
    return finish(
      apiError("INTERNAL_ERROR", "服务端出了点问题，请稍后再试。"),
      "INTERNAL_ERROR",
    );
  }
}
