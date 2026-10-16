/**
 * 文学回声的数据结构。
 *
 * 关键设计：作品信息与来源 URL 永远来自本地受控目录（catalog），
 * 不由模型生成。模型只负责「解释为什么相关」，因此不存在捏造作品或链接的可能。
 */

/** 与 PRD 3.2 一致的七个分析维度。 */
export type EchoFacet =
  | "theme" // 主题
  | "emotion" // 情绪
  | "imagery" // 意象
  | "scene" // 场景
  | "time" // 时间感
  | "relation" // 人物关系
  | "narrative"; // 叙事方式

export const FACET_LABELS: Record<EchoFacet, string> = {
  theme: "主题",
  emotion: "情绪",
  imagery: "意象",
  scene: "场景",
  time: "时间感",
  relation: "人物关系",
  narrative: "叙事方式",
};

/** 关键词条目：一个可被检索的中文/英文触发词，并标注它指向的分析维度。 */
export interface CatalogKeyword {
  term: string;
  facet: EchoFacet;
}

export interface CatalogSource {
  /** 来源入口名称，例如「Project Gutenberg」。 */
  label: string;
  url: string;
  /**
   * 是否已由脚本实际访问核实。未核实的链接在界面上会显示「来源待核实」，
   * 不会被当作事实呈现。
   */
  verified: boolean;
  /** 版权状态说明，例如「公版（作者逝世逾 50 年）」。 */
  rights: string;
  /** 界面展示的语言与版本说明。 */
  edition?: string;
}

export interface CatalogEntry {
  id: string;
  title: string;
  author: string;
  /** 作品年代。仅在有可靠依据时填写，否则留空，界面不显示。 */
  year?: string;
  /** 体裁，例如「长篇小说」「短篇集」「随笔」「诗集」。 */
  form: string;
  /** 一句话内容概述，用于给用户提供阅读坐标。 */
  summary: string;
  /** 各分析维度上的特征。 */
  facets: Record<EchoFacet, string[]>;
  /** 检索关键词。 */
  keywords: CatalogKeyword[];
  /** 建议的阅读切入点。 */
  readingPath: string;
  /**
   * 核对来源时额外接受的文本（例如同一部书名的繁体写法，或英译本书名）。
   * 只被 scripts/verify-catalog.mjs 使用，不影响界面。
   */
  verifyTokens?: string[];
  source: CatalogSource;
}

/** 检索命中的一个维度。 */
export interface MatchedFacet {
  facet: EchoFacet;
  /** 用户原文里真实出现的词。 */
  terms: string[];
  /**
   * 由意象扩展联想到的词，附上触发它的原词。
   * 界面上必须标注来源，不能伪装成用户写过的词。
   */
  related?: { term: string; via: string }[];
}

/** 检索结果。 */
export interface EchoMatch {
  entry: CatalogEntry;
  score: number;
  matchedFacets: MatchedFacet[];
}

/** 返回给前端的单条文学回声。 */
export interface EchoResult {
  id: string;
  title: string;
  author: string;
  year?: string;
  form: string;
  /** 为什么与你的灵感有关。模型生成，或本地模板生成。 */
  why: string;
  /** 相似之处。 */
  similarities: string[];
  /** 不同之处——避免用户以为这是「同一个东西」。 */
  differences: string[];
  /** 建议阅读方向。 */
  readingPath: string;
  /** 命中的分析维度。 */
  matchedFacets: MatchedFacet[];
  source: CatalogSource;
}

/** 文学回声接口的响应体。 */
export interface EchoResponse {
  /** 本次解释由谁生成：真实模型 / 本地模板。前端据此如实提示用户。 */
  generatedBy: "deepseek" | "local-catalog";
  /** 目录范围说明，必须如实告知用户检索范围。 */
  catalogScope: string;
  analysis: {
    themes: string[];
    emotions: string[];
    imagery: string[];
  };
  results: EchoResult[];
  /** 当 AI 未启用时给出的说明，前端会温和地提示。 */
  notice?: string;
}
