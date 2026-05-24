import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export const load: PageServerLoad = async () => {
  try {
    const [balRes, posRes] = await Promise.allSettled([
      fetch(`${bridgeBase()}/fund-balance`),
      fetch(`${bridgeBase()}/fund-positions`),
    ]);

    const balance = balRes.status === 'fulfilled' && balRes.value.ok
      ? await balRes.value.json()
      : null;

    const positions = posRes.status === 'fulfilled' && posRes.value.ok
      ? await posRes.value.json()
      : null;

    const balError = balRes.status === 'rejected'
      ? String(balRes.reason)
      : (balRes.status === 'fulfilled' && !balRes.value.ok ? `Balance error ${balRes.value.status}` : null);

    return { balance, positions, error: balError };
  } catch (e) {
    return { balance: null, positions: null, error: e instanceof Error ? e.message : 'Failed to load fund data.' };
  }
};
