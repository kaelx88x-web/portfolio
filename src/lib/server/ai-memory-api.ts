import { analyticsJson } from '$lib/server/analytics-api';
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

export async function aiMemoryOverviewJson(userId: string, url: URL) {
  return analyticsJson(await getAiMemoryOverview(userId, memoryOptionsFromUrl(url)));
}

export async function latestAiMemoryJson(userId: string, url: URL) {
  return analyticsJson({
    status: 'ready',
    memory: await getLatestAiMemory(userId, memoryOptionsFromUrl(url))
  });
}

export async function aiMemoryHistoryJson(userId: string, url: URL) {
  return analyticsJson({
    status: 'ready',
    history: await listAiMemorySnapshots(userId, memoryOptionsFromUrl(url))
  });
}

export async function aiMemoryTimelineJson(userId: string) {
  return analyticsJson({
    status: 'ready',
    timeline: await listAiMemoryTimeline(userId)
  });
}

export async function aiHistoricalInsightsJson(userId: string) {
  return analyticsJson({
    status: 'ready',
    insights: await listAiHistoricalInsights(userId)
  });
}

export async function refreshAiMemoryJson(userId: string, url: URL) {
  return analyticsJson(await refreshAiMemorySnapshot(userId, { ...memoryOptionsFromUrl(url), forceRefresh: true }));
}

export async function compressAiMemoryJson(userId: string, url: URL) {
  return analyticsJson(await compressAiMemory(userId, memoryOptionsFromUrl(url)));
}

export function memoryOptionsFromUrl(url: URL): AiMemoryOptions {
  return {
    period: parseAiMemoryPeriod(url.searchParams.get('period')),
    benchmark: parseAiMemoryBenchmark(url.searchParams.get('benchmark')),
    snapshotType: parseAiMemoryType(url.searchParams.get('type') ?? url.searchParams.get('snapshotType')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  };
}
