// src/routes/settings/agent/+page.server.ts
import { getOrCreateAgentRegistration } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const reg = await getOrCreateAgentRegistration(user.id);
  return {
    apiKey: reg.apiKey,
    label: reg.label,
    status: reg.status,
    lastSeenAt: reg.lastSeenAt?.toISOString() ?? null,
    lastPushAt: reg.lastPushAt?.toISOString() ?? null,
    createdAt: reg.createdAt.toISOString(),
  };
};

export const actions: Actions = {
  rotate: async () => {
    const user = await getDemoUser();
    const { rotateAgentKey } = await import('$lib/services/agent.service');
    await rotateAgentKey(user.id);
    return { rotated: true };
  },
};
