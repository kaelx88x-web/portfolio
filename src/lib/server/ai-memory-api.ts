import { analyticsJson } from '$lib/server/analytics-api';
import { getDemoUser } from '$lib/server/demo-user';
import {
  compressAiMemory,
  getAiMemoryOverview,
  getLatestAiMemory,
  listAiHistoricalInsights,
  listAiMemorySnapshots,
  listAiMemoryTimeline,
  parseAiMemoryBenchmark,
  parseAiMemoryPeriod,
  parseAiMemoryType,
  refreshAiMemorySnapshot,
  type AiMemoryOptions
} from '$lib/services/ai-memory.service';

export async function aiMemoryOverviewJson(url: URL) {
  const user = await getDemoUser();
  return analyticsJson(await getAiMemoryOverview(user.id, memoryOptionsFromUrl(url)));
}

export async function latestAiMemoryJson(url: URL) {
  const user = await getDemoUser();
  return analyticsJson({
    status: 'ready',
    memory: await getLatestAiMemory(user.id, memoryOptionsFromUrl(url))
  });
}

export async function aiMemoryHistoryJson(url: URL) {
  const user = await getDemoUser();
  return analyticsJson({
    status: 'ready',
    history: await listAiMemorySnapshots(user.id, memoryOptionsFromUrl(url))
  });
}

export async function aiMemoryTimelineJson() {
  const user = await getDemoUser();
  return analyticsJson({
    status: 'ready',
    timeline: await listAiMemoryTimeline(user.id)
  });
}

export async function aiHistoricalInsightsJson() {
  const user = await getDemoUser();
  return analyticsJson({
    status: 'ready',
    insights: await listAiHistoricalInsights(user.id)
  });
}

export async function refreshAiMemoryJson(url: URL) {
  const user = await getDemoUser();
  return analyticsJson(await refreshAiMemorySnapshot(user.id, { ...memoryOptionsFromUrl(url), forceRefresh: true }));
}

export async function compressAiMemoryJson(url: URL) {
  const user = await getDemoUser();
  return analyticsJson(await compressAiMemory(user.id, memoryOptionsFromUrl(url)));
}

export function memoryOptionsFromUrl(url: URL): AiMemoryOptions {
  return {
    period: parseAiMemoryPeriod(url.searchParams.get('period')),
    benchmark: parseAiMemoryBenchmark(url.searchParams.get('benchmark')),
    snapshotType: parseAiMemoryType(url.searchParams.get('type') ?? url.searchParams.get('snapshotType')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  };
}
