// src/routes/api/agent/key/+server.ts
// GET  → return current agent registration (api_key included — for the web UI)
// POST → rotate/create a new API key
// No agent auth here — this endpoint is called by the web UI, not the agent.

import { json } from '@sveltejs/kit';
import { getOrCreateAgentRegistration, rotateAgentKey } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const user = await getDemoUser();
    const reg = await getOrCreateAgentRegistration(user.id);
    return json({
      api_key: reg.apiKey,
      label: reg.label,
      status: reg.status,
      last_seen_at: reg.lastSeenAt,
      last_push_at: reg.lastPushAt,
      created_at: reg.createdAt,
    });
  } catch (err) {
    console.error('[agent/key] GET failed', err);
    return json({ error: 'Failed to load agent registration' }, { status: 500 });
  }
};

export const POST: RequestHandler = async () => {
  try {
    const user = await getDemoUser();
    const reg = await rotateAgentKey(user.id);
    return json({
      api_key: reg.apiKey,
      label: reg.label,
      status: reg.status,
      last_seen_at: reg.lastSeenAt,
      last_push_at: reg.lastPushAt,
      rotated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[agent/key] POST rotate failed', err);
    return json({ error: 'Failed to rotate agent key' }, { status: 500 });
  }
};
