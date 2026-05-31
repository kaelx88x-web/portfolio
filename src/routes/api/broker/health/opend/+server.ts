import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async () => {
  try {
    const res = await fetch(`${BRIDGE}/health/opend`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      return json(
        { ok: false, error: body.detail ?? 'OpenD is not connected' },
        { status: 503 },
      );
    }
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: 'moomoo-service is not running — cannot check OpenD' },
      { status: 503 },
    );
  }
};
