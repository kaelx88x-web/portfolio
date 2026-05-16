import { listPromptTemplates, reloadPromptTemplates } from '$lib/services/prompt-builder.service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    templates: await listPromptTemplates()
  };
};

export const actions: Actions = {
  reload: async () => {
    await reloadPromptTemplates();
    return { status: 'reloaded' };
  }
};
