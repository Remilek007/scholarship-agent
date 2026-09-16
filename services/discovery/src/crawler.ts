import { CheerioCrawler, PlaywrightCrawler } from "crawlee";
import type { DiscoveryRecord } from "./index";

export interface CrawlOptions { maxPages: number; maxDepth: number; concurrency: number; requestTimeoutMs: number; playwrightEnabled: boolean; }
export interface CrawlResult { records: DiscoveryRecord[]; failures: Array<{ url: string; error: string; stage: "http" | "playwright" | "extract" }>; pagesVisited: number; }

const TRACKING = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i;
const SCHOLARSHIP_HINT = /(scholar|fund|fellow|grant|studentship|assistantship|tuition|stipend|bursary|financial aid|research position|graduate)/i;
const PAGINATION_HINT = /(next|older|page(?:=|\/)|pagination|load more)/i;

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
  const records = new Map<string, DiscoveryRecord>(); const failures: CrawlResult["failures"] = []; const visited = new Set<string>();
  const seeds = [...new Set(seedUrls.filter(isHttpUrl).map(canonicalUrl))];
  const handler = async ({ request, $, enqueueLinks }: any) => {
    const url = canonicalUrl(request.url); const depth = Number(request.userData?.depth ?? 0); visited.add(url);
    const title = $("title").first().text().trim() || $("h1").first().text().trim();
    const main = $("main").text(" ").trim() || $("article").text(" ").trim() || $("body").text(" ").trim();
    const text = main.replace(/\s+/g, " ").slice(0, 12000);
    if (relevance(title, text, url)) addRecord(records, { url, originalUrl: url, title, snippet: text.slice(0, 700), source: "crawlee", discoveryMethod: "crawlee", query });
    if (depth >= options.maxDepth || visited.size >= options.maxPages) return;
    const links: string[] = [];
    $("a[href]").each((_: number, element: any) => {
      const href = $(element).attr("href"); if (!href) return;
      try {
        const absolute = canonicalUrl(new URL(href, url).toString()); if (!isHttpUrl(absolute)) return;
        const anchor = $(element).text().replace(/\s+/g, " ").trim();
        if (SCHOLARSHIP_HINT.test(`${anchor} ${absolute}`) || PAGINATION_HINT.test(`${anchor} ${absolute}`)) links.push(absolute);
      } catch { /* malformed link */ }
    });
    const remaining = Math.max(0, options.maxPages - visited.size);
    if (remaining) await enqueueLinks({ urls: [...new Set(links)].slice(0, remaining), userData: { depth: depth + 1 } });
  };
  const crawler = new CheerioCrawler({ maxRequestsPerCrawl: options.maxPages, maxConcurrency: options.concurrency, requestHandlerTimeoutSecs: Math.ceil(options.requestTimeoutMs / 1000), maxRequestRetries: 1, requestHandler: handler, failedRequestHandler: async ({ request, error }: any) => failures.push({ url: request.url, error: error instanceof Error ? error.message : String(error), stage: "http" }) });
  if (seeds.length) await crawler.run(seeds.map(url => ({ url, userData: { depth: 0 } })));

  if (options.playwrightEnabled && failures.length) {
    const failedUrls = [...new Set(failures.map(item => item.url).filter(isHttpUrl))].slice(0, Math.max(1, options.maxPages - visited.size));
    if (failedUrls.length) {
      const browser = new PlaywrightCrawler({ maxRequestsPerCrawl: failedUrls.length, maxConcurrency: Math.max(1, Math.min(options.concurrency, 4)), requestHandlerTimeoutSecs: Math.ceil(options.requestTimeoutMs / 1000), maxRequestRetries: 1,
        requestHandler: async ({ request, page }: any) => {
          const title = await page.title().catch(() => "");
          const text = ((await page.locator("main, article, body").first().innerText().catch(() => "")) as string).replace(/\s+/g, " ").trim();
          const url = canonicalUrl(request.url);
          if (relevance(title, text, url)) addRecord(records, { url, originalUrl: url, title, snippet: text.slice(0, 700), source: "playwright", discoveryMethod: "playwright-fallback", query });
        },
        failedRequestHandler: async ({ request, error }: any) => failures.push({ url: request.url, error: error instanceof Error ? error.message : String(error), stage: "playwright" })
      });
      await browser.run(failedUrls);
    }
  }
  return { records: [...records.values()], failures, pagesVisited: visited.size };
}
