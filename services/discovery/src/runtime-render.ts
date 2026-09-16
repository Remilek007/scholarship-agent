import { chromium } from "playwright";

const JS_SHELL_HINT = /(enable javascript|javascript is required|loading\.\.\.|please wait|noscript)/i;

export async function fetchRenderedHtml(sourceUrl: string, fallbackHtml: string): Promise<{ html: string; finalUrl: string }> {
  const plainText = fallbackHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plainText.length >= 180 && !JS_SHELL_HINT.test(plainText)) return { html: fallbackHtml, finalUrl: sourceUrl };

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: "ScholarshipAgent/0.2 (+deep-extraction)" });
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    return { html: await page.content(), finalUrl: page.url() || sourceUrl };
  } finally {
    await browser.close();
  }
}
