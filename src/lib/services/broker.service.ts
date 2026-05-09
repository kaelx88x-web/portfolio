import type { BrokerHolding, MoomooStatus, MoomooSyncResult } from '$lib/types/portfolio';
import { env } from '$env/dynamic/private';

function base(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export async function getMoomooStatus(): Promise<MoomooStatus> {
  const res = await fetch(`${base()}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export async function syncMoomoo(): Promise<MoomooSyncResult> {
  const res = await fetch(`${base()}/sync`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `Sync failed: ${res.status}`);
  }
  return res.json();
}
