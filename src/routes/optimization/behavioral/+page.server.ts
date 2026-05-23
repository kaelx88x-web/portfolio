// src/routes/optimization/behavioral/+page.server.ts
import { getDemoUser } from '$lib/server/demo-user';
import { getBehavioralProfile } from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user    = await getDemoUser();
  const profile = await getBehavioralProfile(user.id);
  return { profile };
};
