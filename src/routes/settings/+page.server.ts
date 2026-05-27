import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { requiredString } from '$lib/server/form';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return { user };
}

export const actions: Actions = {
  update: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: requiredString(formData, 'name'),
          baseCurrency: requiredString(formData, 'baseCurrency').toUpperCase()
        }
      });
      return { message: 'Settings updated' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to update settings' });
    }
  }
};
