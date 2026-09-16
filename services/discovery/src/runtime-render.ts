const JS_SHELL_HINT = /(enable javascript|javascript is required|loading\.\.\.|please wait|noscript)/i;
const MIN_PLAIN_TEXT = 180;

export function needsRuntimeRendering(html: string): boolean {
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return plainText.length < MIN_PLAIN_TEXT || JS_SHELL_HINT.test(plainText);
}

export async function fetchRenderedHtml(sourceUrl: string, fallbackHtml: string): Promise<{ html: string; finalUrl: string }> {
  if (!needsRuntimeRendering(fallbackHtml)) return { html: fallbackHtml, finalUrl: sourceUrl };
  if (process.env.DISCOVERY_PLAYWRIGHT_ENABLED !== "true") return { html: fallbackHtml, finalUrl: sourceUrl };

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ userAgent: "ScholarshipAgent/0.2 (+deep-extraction)" });
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      return { html: await page.content(), finalUrl: page.url() || sourceUrl };
    } finally {
      await browser.close();
    }
  } catch {
    return { html: fallbackHtml, finalUrl: sourceUrl };
  }
}
