import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const acc_id = url.searchParams.get('acc_id');
  const trd_env = url.searchParams.get('trd_env') ?? 'SIMULATE';
  if (!acc_id) throw error(400, 'acc_id required');

  try {
    const res = await fetch(
      `${BRIDGE}/account-balance?acc_id=${encodeURIComponent(acc_id)}&trd_env=${encodeURIComponent(trd_env)}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      return json({ error: body.detail ?? 'Balance unavailable' }, { status: res.status });
    }
    return json(await res.json());
  } catch {
    return json({ error: 'Bridge timeout' }, { status: 503 });
  }
};
