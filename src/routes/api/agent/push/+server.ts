// Receives data pushed by the customer's local agent.
// Authenticated via Bearer token (agent API key).

import { json } from '@sveltejs/kit';
import { verifyAgentKey, storeAgentPush, type AgentPushPayload } from '$lib/services/agent.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  // 1. Authenticate
  const auth = request.headers.get('Authorization');
  const agent = await verifyAgentKey(auth);
  if (!agent) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Guard payload size (512 KB max) before parsing
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 512_000) {
    return json({ error: 'Payload too large' }, { status: 413 });
  }

  // 3. Parse body
  let payload: AgentPushPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 4. Basic validation
  if (!payload.push_type) {
    return json({ error: 'push_type is required' }, { status: 400 });
  }

  // 5. Store
  try {
    await storeAgentPush(agent.id, agent.userId, payload);
    return json({
      ok: true,
      agent: agent.label,
      push_type: payload.push_type,
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[agent/push] storeAgentPush failed', err);
    return json({ error: 'Storage error' }, { status: 500 });
  }
};
