import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async () => {
  try {
    const res = await fetch(`${BRIDGE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return json({ ok: false, error: `moomoo-service returned ${res.status}` }, { status: 503 });
    }
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: 'moomoo-service is not running on port 8001' },
      { status: 503 },
    );
  }
};
