export interface DiscoveryConfig {
  directUrls: string[];
}

export function loadDiscoveryConfig(env: NodeJS.ProcessEnv = process.env): DiscoveryConfig {
  const directUrls = (env.DISCOVERY_DIRECT_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return { directUrls };
}
