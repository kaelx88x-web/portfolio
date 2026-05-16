import { fail } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { numberFromForm, requiredString } from '$lib/server/form';
import {
  getPaperDashboard,
  submitPaperOrder,
  switchPaperAccount
} from '$lib/services/paper-trading.service';
import type { Actions, PageServerLoad } from './$types';

const ACTIVE_ACCOUNT_COOKIE = 'portfolio_ai_active_account';

export const load: PageServerLoad = async ({ cookies }) => {
  const user = await getDemoUser();
  return getPaperDashboard(user.id, cookies.get(ACTIVE_ACCOUNT_COOKIE));
};

export const actions: Actions = {
  switch: async ({ request, cookies }) => {
    const user = await getDemoUser();
    const formData = await request.formData();

    try {
      const account = await switchPaperAccount(user.id, requiredString(formData, 'accountId'));
      cookies.set(ACTIVE_ACCOUNT_COOKIE, account.id, {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 90
      });
      return { message: `Active account switched to ${account.name}.` };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to switch account' });
    }
  },
  buy: async ({ request, cookies }) => {
    return submit(request, cookies.get(ACTIVE_ACCOUNT_COOKIE), 'buy');
  },
  sell: async ({ request, cookies }) => {
    return submit(request, cookies.get(ACTIVE_ACCOUNT_COOKIE), 'sell');
  }
};

async function submit(request: Request, activeAccountId: string | undefined, side: 'buy' | 'sell') {
  const user = await getDemoUser();
  const dashboard = await getPaperDashboard(user.id, activeAccountId);
  const formData = await request.formData();

  try {
    await submitPaperOrder({
      userId: user.id,
      accountId: dashboard.activeAccount.id,
      side,
      symbol: requiredString(formData, 'symbol'),
      quantity: numberFromForm(formData, 'quantity'),
      price: numberFromForm(formData, 'price'),
      fee: numberFromForm(formData, 'fee')
    });
    return { message: `Paper ${side} order filled.` };
  } catch (error) {
    return fail(400, { message: error instanceof Error ? error.message : `Unable to submit paper ${side}` });
  }
}
