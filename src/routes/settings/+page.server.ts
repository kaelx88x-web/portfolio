import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { getDemoUser } from '$lib/server/demo-user';
import { requiredString } from '$lib/server/form';

export async function load() {
  const user = await getDemoUser();
  return { user };
}

export const actions = {
  update: async ({ request }) => {
    const user = await getDemoUser();
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
