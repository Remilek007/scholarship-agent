import { DiscoveryEngine, type ScholarshipSource } from "./index";
import { loadDiscoveryConfig } from "./config";
import { HttpPageSource } from "./http";

export function createDiscoveryEngine(): DiscoveryEngine {
  const config = loadDiscoveryConfig();
  const sources: ScholarshipSource[] = [];

  if (config.directUrls.length > 0) {
    sources.push(new HttpPageSource({
      name: "configured-direct-pages",
      urls: config.directUrls
    }));
  }

  return new DiscoveryEngine(sources);
}
