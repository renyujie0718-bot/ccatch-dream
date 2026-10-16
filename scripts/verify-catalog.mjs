#!/usr/bin/env node
//
// 核对 src/lib/echo/catalog.ts 里每一条作品的来源链接。
//
// 为什么需要这个脚本：
//   目录里的链接会被如实标注为「来源已核对」或「来源待核实」。
//   这个标注不能靠猜，必须由真实请求得出。
//
// 用法：
//   node scripts/verify-catalog.mjs            # 只报告，不改文件
//   node scripts/verify-catalog.mjs --write    # 把通过核对的条目标记为 verified: true
//
// 判定标准：
//   1. HTTP 状态为 2xx；
//   2. 页面内容里能印证这部作品（Project Gutenberg 检查作者姓氏，
//      其他来源检查中文书名）。
// 两者同时满足才会被标记为已核对。

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.join(__dirname, "..", "src", "lib", "echo", "catalog.ts");
const REPORT_PATH = path.join(__dirname, "..", ".catalog-verification.json");

const USER_AGENT =
  "CatchDreamCatalogVerifier/1.0 (source verification for a personal writing app)";
const TIMEOUT_MS = 20000;

/** 从 catalog.ts 里解析出每条作品的 id / 标题 / 作者 / 来源。 */
function parseEntries(source) {
  const entries = [];
  const idRegex = /id:\s*"([^"]+)"/g;
  const matches = [...source.matchAll(idRegex)];

  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index;
    const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const block = source.slice(start, end);

    const title = /title:\s*"([^"]+)"/.exec(block)?.[1];
    const author = /author:\s*"([^"]+)"/.exec(block)?.[1];
    const label = /label:\s*"([^"]+)"/.exec(block)?.[1];
    const url = /url:\s*"([^"]+)"/.exec(block)?.[1];
    const tokensMatch = /verifyTokens:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? "";
    const verifyTokens = [...tokensMatch.matchAll(/"([^"]+)"/g)].map((item) => item[1]);

    if (!title || !url) continue;
    entries.push({
      id: matches[index][1],
      title,
      author: author ?? "",
      label: label ?? "",
      url,
      verifyTokens,
    });
  }

  return entries;
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 作者姓氏的最后一段，用于在页面上印证作品归属。 */
function authorSurnameToken(author) {
  const ascii = author.replace(/[^A-Za-z\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (ascii.length === 0) return "";
  return ascii[ascii.length - 1].toLowerCase();
}

async function verifyEntry(entry) {
  const result = { ...entry, status: 0, bodyConfirms: false, ok: false, note: "" };

  let response;
  try {
    response = await fetchWithTimeout(entry.url, "GET");
  } catch (error) {
    result.note = `请求失败：${error instanceof Error ? error.message : String(error)}`;
    return result;
  }

  result.status = response.status;
  if (!response.ok) {
    result.note = `HTTP ${response.status}`;
    return result;
  }

  let html = "";
  try {
    html = await response.text();
  } catch {
    result.note = "读取响应内容失败";
    return result;
  }

  const haystack = html.toLowerCase();

  // 印证方式：书名（含异体/译名）或作者姓氏任一命中，即认为页面确实指向这部作品
  const candidates = [entry.title, ...(entry.verifyTokens ?? [])].filter(Boolean);
  const surname = authorSurnameToken(entry.author);
  if (surname.length > 2) candidates.push(surname);

  const hit = candidates.find((candidate) =>
    haystack.includes(candidate.toLowerCase()),
  );
  result.bodyConfirms = Boolean(hit);
  result.note = hit ? `页面包含「${hit}」` : `页面未出现 ${candidates.join(" / ")}`;

  result.ok = result.status >= 200 && result.status < 300 && result.bodyConfirms;
  return result;
}

async function main() {
  const write = process.argv.includes("--write");
  let source = await readFile(CATALOG_PATH, "utf8");
  const entries = parseEntries(source);

  console.log(`共 ${entries.length} 条来源需要核对。`);

  const results = [];
  for (const entry of entries) {
    const result = await verifyEntry(entry);
    results.push(result);
    const mark = result.ok ? "OK  " : "FAIL";
    console.log(`[${mark}] ${result.id} -> ${result.url} （${result.note}）`);
  }

  const passed = results.filter((item) => item.ok).map((item) => item.id);
  const failed = results.filter((item) => !item.ok);

  await writeFile(
    REPORT_PATH,
    `${JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        total: results.length,
        passed: passed.length,
        failed: failed.map((item) => ({ id: item.id, url: item.url, note: item.note })),
        results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`\n通过 ${passed.length}/${results.length}，明细已写入 .catalog-verification.json`);

  if (failed.length > 0) {
    console.log("以下条目需要人工修正链接：");
    for (const item of failed) console.log(`  - ${item.id}: ${item.note}`);
  }

  if (write && passed.length > 0) {
    // 只在通过核对的条目块内把 verified: false 改成 true
    const passedSet = new Set(passed);
    const idRegex = /id:\s*"([^"]+)"/g;
    const marks = [...source.matchAll(idRegex)];
    let rebuilt = source.slice(0, marks[0].index);

    for (let index = 0; index < marks.length; index += 1) {
      const start = marks[index].index;
      const end = index + 1 < marks.length ? marks[index + 1].index : source.length;
      let block = source.slice(start, end);
      if (passedSet.has(marks[index][1])) {
        block = block.replace(/verified:\s*false/, "verified: true");
      }
      rebuilt += block;
    }

    source = rebuilt;
    await writeFile(CATALOG_PATH, source, "utf8");
    console.log(`已把 ${passed.length} 条标记为 verified: true。`);
  }
}

main().catch((error) => {
  console.error("核对脚本执行失败：", error);
  process.exitCode = 1;
});
