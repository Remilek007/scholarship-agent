import type { DiscoveryRecord, ScholarshipSource } from "./index";
import type { DiscoverySourceDefinition } from "./source-registry";

const LINK_PATTERN = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const USEFUL_TERMS = /(scholarship|funding|fellowship|studentship|assistantship|research|graduate|master|msc|application|admission|bursary|stipend|tuition)/i;

/**
 * Crawls the maintained source registry without requiring a paid search API.
 * It intentionally stays on the registry domain and emits only links whose
 * labels/URLs look like opportunity or funding pages. Those links are later
 * deep-enriched and verified before entering the ranked shortlist.
 */
export class RegistrySource implements ScholarshipSource {
  readonly name = "source-registry";
  private readonly definitions: DiscoverySourceDefinition[];

  constructor(definitions: DiscoverySourceDefinition[]) {
    this.definitions = definitions.filter((item) => item.enabledByDefault && item.urls.length);
  }

  async search(query: string): Promise<DiscoveryRecord[]> {
    const records: DiscoveryRecord[] = [];
    for (const definition of this.definitions) {
      for (const seedUrl of definition.urls) {
        try {
          const response = await fetch(seedUrl, {
            headers: { "user-agent": "ScholarshipAgent/0.1 (+opportunity-discovery)" },
            signal: AbortSignal.timeout(12_000)
          });
          if (!response.ok) continue;
          const html = await response.text();
          const baseUrl = response.url || seedUrl;
          const seedTitle = extractTitle(html);
          const seedText = visibleText(html);

          if (USEFUL_TERMS.test(`${seedTitle ?? ""} ${seedText.slice(0, 8000)}`)) {
            records.push({
              url: baseUrl,
              title: seedTitle ?? definition.name,
              snippet: seedText.slice(0, 1800),
              source: definition.name,
              discoveryMethod: "registry_seed",
              query
            });
          }

          for (const match of html.matchAll(LINK_PATTERN)) {
            const href = match[1]?.trim();
            const label = clean(match[2]);
            if (!href || !label || !USEFUL_TERMS.test(`${label} ${href}`)) continue;
            let absolute: URL;
            let seed: URL;
            try {
              absolute = new URL(href, baseUrl);
              seed = new URL(seedUrl);
            } catch {
              continue;
            }
            if (absolute.protocol !== "https:" || absolute.hostname !== seed.hostname) continue;
            absolute.hash = "";
            if (records.some((record) => record.url === absolute.toString())) continue;
            records.push({
              url: absolute.toString(),
              title: label,
              snippet: `${definition.name}: ${label}`,
              source: definition.name,
              discoveryMethod: "registry_link",
              query
            });
            if (records.length >= 150) return records;
          }
        } catch {
          // One unavailable source must not stop global discovery.
        }
      }
    }
    return records;
  }

  async healthCheck(): Promise<boolean> {
    for (const definition of this.definitions) {
      for (const url of definition.urls) {
        try {
          const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8_000) });
          if (response.ok) return true;
        } catch {
          // Try the next source.
        }
      }
    }
    return false;
  }
}

function extractTitle(html: string): string | undefined {
  return clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function visibleText(html: string): string {
  return clean(html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")) ?? "";
}

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/\s+/g, " ").trim() || undefined;
}
