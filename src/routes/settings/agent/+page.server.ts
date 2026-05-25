// src/routes/settings/agent/+page.server.ts
import { error } from '@sveltejs/kit';
import { getOrCreateAgentRegistration, rotateAgentKey } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  try {
    const user = await getDemoUser();
    const reg = await getOrCreateAgentRegistration(user.id);
    return {
      apiKey: reg.apiKey,
      label: reg.label,
      status: reg.status,
      lastSeenAt: reg.lastSeenAt?.toISOString() ?? null,
      lastPushAt: reg.lastPushAt?.toISOString() ?? null,
      createdAt: reg.createdAt.toISOString(),
      serverOrigin: url.origin,
    };
  } catch (err) {
    console.error('[settings/agent] load failed', err);
    throw error(500, 'Failed to load agent settings');
  }
};

export const actions: Actions = {
  rotate: async () => {
    try {
      const user = await getDemoUser();
      await rotateAgentKey(user.id);
      return { rotated: true };
    } catch (err) {
      console.error('[settings/agent] rotate failed', err);
      return { rotated: false, error: 'Failed to rotate key — please try again.' };
    }
  },
};
