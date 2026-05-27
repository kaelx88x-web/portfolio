import { fail } from '@sveltejs/kit';
import { numberFromForm, requiredString } from '$lib/server/form';
import { prisma } from '$lib/server/db';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount
} from '$lib/services/account.service';
import { getHoldings } from '$lib/services/portfolio.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const [accounts, holdings, snapshot] = await Promise.all([
    listAccounts(user.id),
    getHoldings(user.id),
    getLatestSnapshot(user.id)
  ]);

  let snapshotTotalValue = 0;   // holdings + cash (from snapshot.totalValue)
  let snapshotDayPl = 0;
  let snapshotAccountId: string | null = null;
  let snapshotDate: Date | null = null;

  if (snapshot) {
    let snapshotHoldings: SnapshotHolding[] = [];
    try { snapshotHoldings = JSON.parse(snapshot.holdingsJson); } catch { snapshotHoldings = []; }

    snapshotTotalValue = snapshot.totalValue; // includes cashBalance
    snapshotDayPl = snapshotHoldings.reduce((s, h) => s + (h.todayPl ?? 0), 0);
    snapshotDate = snapshot.snapshotDate;

    const moomooAccount = accounts.find((a) => a.brokerName === 'Moomoo' && a.accountType !== 'paper');
    snapshotAccountId = moomooAccount?.id ?? null;
  }

  return { accounts, holdings, snapshotTotalValue, snapshotDayPl, snapshotAccountId, snapshotDate };
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      await createAccount({
        userId: user.id,
        name: requiredString(formData, 'name'),
        brokerName: requiredString(formData, 'brokerName'),
        accountType: requiredString(formData, 'accountType'),
        currency: requiredString(formData, 'currency').toUpperCase()
      });
      return { message: 'Account created' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to create account' });
    }
  },
  update: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      await updateAccount(user.id, requiredString(formData, 'accountId'), {
        name: requiredString(formData, 'name'),
        brokerName: requiredString(formData, 'brokerName'),
        accountType: requiredString(formData, 'accountType'),
        currency: requiredString(formData, 'currency').toUpperCase()
      });
      return { message: 'Account updated' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to update account' });
    }
  },
  delete: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      await deleteAccount(user.id, requiredString(formData, 'accountId'));
      return { message: 'Account deleted' };
    } catch {
      return fail(400, { message: 'Account cannot be deleted while it has transactions' });
    }
  },

  setCash: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();
    const accountId = requiredString(formData, 'accountId');
    const cash = numberFromForm(formData, 'cash');

    // Verify ownership
    const account = await prisma.account.findFirst({ where: { id: accountId, userId: user.id } });
    if (!account) return fail(403, { message: 'Account not found' });

    await prisma.account.update({
      where: { id: accountId },
      data: { cashBalance: cash },
    });

    return { message: `Cash balance updated to $${cash.toLocaleString()}` };
  },
};
