import type { ApplicantProfile } from "@scholarship-agent/shared";
import { createDiscoveryEngine } from "./factory";

export interface DiscoverySchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMinutes: number | null;
  lastRunAt?: string;
  lastCompletedAt?: string;
  lastError?: string;
}

export function createDiscoveryScheduler(profile: ApplicantProfile, intervalMinutes = Number(process.env.DISCOVERY_INTERVAL_MINUTES ?? 0)) {
  const interval = Number.isFinite(intervalMinutes) ? Math.max(0, Math.floor(intervalMinutes)) : 0;
  let running = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const status: DiscoverySchedulerStatus = { enabled: interval > 0, running: false, intervalMinutes: interval > 0 ? interval : null };

  async function run() {
    if (running) return { skipped: true, reason: "A discovery run is already in progress" };
    running = true;
    status.running = true;
    status.lastRunAt = new Date().toISOString();
    status.lastError = undefined;
    try {
      const result = await createDiscoveryEngine().searchAndPersist(profile);
      status.lastCompletedAt = new Date().toISOString();
      return result;
    } catch (error) {
      status.lastError = error instanceof Error ? error.message : "Scheduled discovery failed";
      throw error;
    } finally {
      running = false;
      status.running = false;
    }
  }

  if (interval > 0) {
    timer = setInterval(() => { void run().catch(() => undefined); }, interval * 60_000);
    timer.unref?.();
  }

  return {
    status: () => ({ ...status }),
    run,
    stop: () => { if (timer) clearInterval(timer); timer = undefined; status.enabled = false; }
  };
}

export function readScheduledProfile(value = process.env.DISCOVERY_PROFILE_JSON): ApplicantProfile | undefined {
  if (!value) return undefined;
  try {
    const profile = JSON.parse(value) as Partial<ApplicantProfile>;
    if (!profile.nationality || !profile.degreeLevel || !Array.isArray(profile.targetFields) || !profile.minimumFunding) return undefined;
    return profile as ApplicantProfile;
  } catch {
    return undefined;
  }
}
