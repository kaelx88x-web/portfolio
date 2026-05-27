// src/routes/optimization/behavioral/+page.server.ts
import { getBehavioralProfile } from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const profile = await getBehavioralProfile(user.id);
  return { profile };
};
