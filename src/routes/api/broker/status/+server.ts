// GET /api/broker/status — lightweight poll endpoint for connection state
import { json } from '@sveltejs/kit';
import { getMoomooStatus } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const status = await getMoomooStatus();
    return json({ status, ts: Date.now() });
  } catch {
    return json({ status: null, ts: Date.now() });
  }
};
