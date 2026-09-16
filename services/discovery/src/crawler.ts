import { CheerioCrawler, PlaywrightCrawler } from "crawlee";
import type { DiscoveryRecord } from "./index";

export interface CrawlOptions { maxPages: number; maxDepth: number; concurrency: number; requestTimeoutMs: number; playwrightEnabled: boolean; }
export interface CrawlResult { records: DiscoveryRecord[]; failures: Array<{ url: string; error: string; stage: "http" | "playwright" | "extract" }>; pagesVisited: number; }

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;
const SCHOLARSHIP_HINT = /(scholar|fund|fellow|grant|studentship|assistantship|tuition|stipend|bursary|financial aid|research position|graduate)/i;
const PAGINATION_HINT = /(next|older|page(?:=|\/)|pagination|load more)/i;
const JS_SHELL_HINT = /(enable javascript|javascript is required|loading\.\.\.|please wait|noscript)/i;

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value); url.hash = ""; url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch { return value.trim(); }
}
function isHttpUrl(value: string): boolean { try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; } }
function relevance(title: string, text: string, url: string): boolean { return SCHOLARSHIP_HINT.test(`${title} ${text} ${url}`); }
function addRecord(map: Map<string, DiscoveryRecord>, record: DiscoveryRecord): void { const key = canonicalUrl(record.url); if (!key || !isHttpUrl(key) || map.has(key)) return; map.set(key, { ...record, url: key, originalUrl: record.originalUrl ?? key }); }

export async function crawlDiscoveryPages(seedUrls: string[], query: string, options: CrawlOptions): Promise<CrawlResult> {
  const records = new Map<string, DiscoveryRecord>();
  const failures: CrawlResult["failures"] = [];
  const visited = new Set<string>();
  const browserCandidates = new Set<string>();
  const seeds = [...new Set(seedUrls.filter(isHttpUrl).map(canonicalUrl))];
  const maxRequests = Math.max(1, options.maxPages);

  const handler = async ({ request, $, enqueueLinks }: any) => {
    const url = canonicalUrl(request.url);
    const depth = Number(request.userData?.depth ?? 0);
    visited.add(url);
    try {
      const title = $("title").first().text().trim() || $("h1").first().text().trim();
      const main = $("main").text(" ").trim() || $("article").text(" ").trim() || $("body").text(" ").trim();
      const text = main.replace(/\s+/g, " ").slice(0, 16000);
      if (options.playwrightEnabled && (text.length < 180 || JS_SHELL_HINT.test(text))) browserCandidates.add(url);
      if (relevance(title, text, url)) addRecord(records, { url, originalUrl: url, title, snippet: text.slice(0, 1200), source: "crawlee", discoveryMethod: "crawlee", query, discoveryState: "extracted" });

      if (depth >= options.maxDepth || visited.size >= maxRequests) return;
      const links: string[] = [];
      $("a[href]").each((_: number, element: any) => {
        const href = $(element).attr("href"); if (!href) return;
        try {
          const absolute = canonicalUrl(new URL(href, url).toString()); if (!isHttpUrl(absolute)) return;
          const anchor = $(element).text().replace(/\s+/g, " ").trim();
          if (SCHOLARSHIP_HINT.test(`${anchor} ${absolute}`) || PAGINATION_HINT.test(`${anchor} ${absolute}`)) links.push(absolute);
        } catch { /* malformed link */ }
      });
      const remaining = Math.max(0, maxRequests - visited.size);
      if (remaining) await enqueueLinks({ urls: [...new Set(links)].slice(0, remaining), userData: { depth: depth + 1 } });
    } catch (error) {
      failures.push({ url, error: error instanceof Error ? error.message : String(error), stage: "extract" });
    }
  };

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: maxRequests,
    maxConcurrency: Math.max(1, options.concurrency),
    requestHandlerTimeoutSecs: Math.ceil(options.requestTimeoutMs / 1000),
    maxRequestRetries: 1,
    requestHandler: handler,
    failedRequestHandler: async ({ request, error }: any) => {
      browserCandidates.add(canonicalUrl(request.url));
      failures.push({ url: request.url, error: error instanceof Error ? error.message : String(error), stage: "http" });
    }
  });
  if (seeds.length) await crawler.run(seeds.map(url => ({ url, userData: { depth: 0 } })));

  if (options.playwrightEnabled) {
    const remainingBrowser = Math.max(0, maxRequests - visited.size);
    const browserUrls = [...browserCandidates].filter(isHttpUrl).slice(0, remainingBrowser);
    if (browserUrls.length) {
      const browser = new PlaywrightCrawler({
        maxRequestsPerCrawl: browserUrls.length,
        maxConcurrency: Math.max(1, Math.min(options.concurrency, 4)),
        maxCrawlDepth: options.maxDepth,
        requestHandlerTimeoutSecs: Math.ceil(options.requestTimeoutMs / 1000),
        maxRequestRetries: 1,
        requestHandler: async ({ request, page, enqueueLinks }: any) => {
          const title = await page.title().catch(() => "");
          const text = ((await page.locator("main, article, body").first().innerText().catch(() => "")) as string).replace(/\s+/g, " ").trim();
          const url = canonicalUrl(request.url);
          if (relevance(title, text, url)) addRecord(records, { url, originalUrl: url, title, snippet: text.slice(0, 1200), source: "playwright", discoveryMethod: "playwright-fallback", query, discoveryState: "extracted" });
          const anchors = await page.locator("a[href]").evaluateAll((elements: Element[]) => elements.map(element => ({ href: (element as HTMLAnchorElement).href, label: element.textContent ?? "" })));
          const links = anchors.filter(item => isHttpUrl(item.href) && (SCHOLARSHIP_HINT.test(`${item.label} ${item.href}`) || PAGINATION_HINT.test(`${item.label} ${item.href}`))).map(item => canonicalUrl(item.href));
          if (links.length) await enqueueLinks({ urls: [...new Set(links)].slice(0, 20), userData: { depth: Number(request.userData?.depth ?? 0) + 1 } });
        },
        failedRequestHandler: async ({ request, error }: any) => failures.push({ url: request.url, error: error instanceof Error ? error.message : String(error), stage: "playwright" })
      });
      await browser.run(browserUrls.map(url => ({ url, userData: { depth: 0 } })));
    }
  }

  return { records: [...records.values()], failures, pagesVisited: visited.size };
}
