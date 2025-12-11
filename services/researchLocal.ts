// services/researchLocal.ts
import * as webAccessService from './webAccessService';
import { type Settings } from './settings';
import * as localLlmService from './localLlmService';

// --- Inlined Utilities for Robustness ---

// Concurrency pool from user feedback
async function runWithPool<T>(items: T[], limit: number, fn: (x: T, i: number) => Promise<any>) {
  const q = [...items.map((item, i) => ({ item, i }))];
  const results: any[] = new Array(items.length);
  const workers = Array.from({ length: Math.min(limit, q.length) }, async () => {
      while (q.length > 0) {
          const task = q.shift();
          if (task) {
              try {
                  results[task.i] = await fn(task.item, task.i);
              } catch (e) {
                  console.error(`[Worker Pool] Error processing item #${task.i}:`, task.item, e);
                  results[task.i] = { __error: String(e) };
              }
          }
      }
  });
  await Promise.all(workers);
  return results;
}


// URL hygiene functions from user feedback
function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = ''; // strip fragments
    const strip = /^(utm_|fbclid$|gclid$|yclid$|mc_)/i;
    [...u.searchParams.keys()].forEach(k => {
      if (strip.test(k)) u.searchParams.delete(k);
    });
    if (!u.pathname || u.pathname === '/') u.pathname = '';
    u.hostname = u.hostname.toLowerCase();
    u.pathname = u.pathname.replace(/\/{2,}/g, '/');
    return u.toString();
  } catch {
    return raw.trim();
  }
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const n = normalizeUrl(raw);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// More robust URL extractor
function extractUrlsFromText(block: string): string[] {
  const urls = new Set<string>();
  // (1) Markdown links: [title](url)
  for (const m of block.matchAll(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/gi)) urls.add(m[1]);
  // (2) Bare URLs
  for (const m of block.matchAll(/(^|\s)(https?:\/\/[^\s)]+)(?=\s|$)/gi)) urls.add(m[2]);
  // (3) Parens-wrapped bare URLs
  for (const m of block.matchAll(/\((https?:\/\/[^\s)]+)\)/gi)) urls.add(m[1]);

  return [...urls].filter(u => /^https?:\/\//i.test(u));
}


function stripHtmlKeepText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMainText(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const main = doc.querySelector('main, article, [role="main"]');
    const text = (main?.textContent || doc.body?.textContent || '') as string;
    const out = text.replace(/\s+/g, ' ').trim();
    return out || stripHtmlKeepText(html);
  } catch {
    return stripHtmlKeepText(html);
  }
}

function sniffTitle(html: string, fallback: string) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (m?.[1] || fallback).replace(/\s+/g, ' ').trim();
}

function take(str: string, n: number) {
  return str.length > n ? str.slice(0, n) : str;
}


export async function synthesizeFromWeb(
  query: string,
  settings: Settings,
  opts?: {
    maxResults?: number;
    perDocChars?: number;
    finalContextChars?: number;
    fetchConcurrency?: number;
    summarizeConcurrency?: number;
    systemInstruction?: string;
  },
  signal?: AbortSignal // Add signal parameter
): Promise<{ answer: string; sources: Array<{ title: string; url: string }> }> {

  const maxResults = opts?.maxResults ?? 5;
  const perDocChars = opts?.perDocChars ?? 16000;
  const finalContextChars = opts?.finalContextChars ?? 64000;
  const fetchConcurrency = opts?.fetchConcurrency ?? 3;
  const summarizeConcurrency = opts?.summarizeConcurrency ?? 3;
  const systemInstruction = opts?.systemInstruction ??
    "You are a precise researcher. Answer clearly, include recent facts, note uncertainties, and cite sources when given.";

  // 1) Search
  const searchBlock = await webAccessService.search(query, settings, signal); // Pass signal
  const rawUrls = extractUrlsFromText(searchBlock);
  const urls = dedupeUrls(rawUrls).slice(0, maxResults);

  if (!urls.length) {
    return {
      answer: `I couldn’t find fetchable URLs for: "${query}".\n\nSearch said:\n${searchBlock}`,
      sources: []
    };
  }

  // 2) Fetch pages
  const pages: {url:string,title:string,text:string}[] = [];
  await runWithPool(urls, fetchConcurrency, async (url, i) => {
    const t0 = performance.now();
    try {
        const html = await webAccessService.curl(url, settings, signal); // Pass signal
        const title = sniffTitle(html, url);
        const text = take(extractMainText(html), perDocChars);
        console.debug('[researchLocal] fetched', { url, chars: text.length, ms: Math.round(performance.now()-t0) });
        if (text.length > 300) {
            pages.push({ url, title, text });
        }
    } catch(e) {
        console.error(`Failed to fetch and process ${url}:`, e);
    }
  });

  if (!pages.length) {
    return {
      answer: `I fetched the pages but didn’t extract usable text. Query: "${query}".\n\nSearch said:\n${searchBlock}`,
      sources: urls.map(u => ({ title: u, url: u }))
    };
  }

  // 3) Per-doc summaries (map)
  const summaries: any[] = [];
  await runWithPool(pages, summarizeConcurrency, async (p) => {
    const prompt =
`Return: bullet list of facts. No opinions. Keep numbers/dates. ≤ 120 words.
Summarize the key facts relevant to the query in bullet points. Keep it concise and objective.
Query: ${query}

PAGE TITLE: ${p.title}
PAGE URL: ${p.url}

--- PAGE TEXT (truncated) ---
${p.text}
`;
    const out = await localLlmService.getCompletion(prompt, {
      ...settings,
      url: settings.localLlmUrl,
      model: settings.localLlmModelName,
      localLlmPromptFormat: settings.localLlmPromptFormat,
      systemInstruction: "You are a helpful research assistant.",
      messages: [],
    }, signal); // Pass signal
    console.debug('[researchLocal] summarized', { url: p.url, words: out.trim().split(/\s+/).length });
    summaries.push({ ...p, summary: out.trim() });
  });


  const usable = summaries.filter(s => s.summary && s.summary.length > 0);
  const joined = take(
    usable.map(s => `### ${s.title}\n${s.summary}\n`).join('\n'),
    finalContextChars
  );

  // 4) Final synthesis (reduce)
  const finalPrompt =
`You are a precise researcher. Using the evidence below, answer the user's query clearly and directly.
- Synthesize; don’t repeat.
- Include caveats/uncertainty if applicable.
- If numbers differ across sources, reconcile or present range.
- Return 1–3 short paragraphs plus a compact bullet list of key facts.
- Do not invent citations.

User query: "${query}"

=== EVIDENCE FROM SOURCES ===
${joined}
`;

  const answer = (await localLlmService.getCompletion(finalPrompt, {
    ...settings,
    url: settings.localLlmUrl,
    model: settings.localLlmModelName,
    localLlmPromptFormat: settings.localLlmPromptFormat,
    systemInstruction,
    messages: [],
  }, signal)).trim(); // Pass signal

  return {
    answer,
    sources: usable.map(s => ({ title: s.title, url: s.url }))
  };
}