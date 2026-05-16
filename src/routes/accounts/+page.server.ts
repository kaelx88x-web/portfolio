import { fail } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { numberFromForm, requiredString } from '$lib/server/form';
import {
  createAccount,
  deleteAccount,
  listAccounts,
  updateAccount
} from '$lib/services/account.service';
import { getHoldings } from '$lib/services/portfolio.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';

export async function load() {
  const user = await getDemoUser();
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

export const actions = {
  create: async ({ request }) => {
    const user = await getDemoUser();
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
  update: async ({ request }) => {
    const user = await getDemoUser();
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
  delete: async ({ request }) => {
    const user = await getDemoUser();
    const formData = await request.formData();

    try {
      await deleteAccount(user.id, requiredString(formData, 'accountId'));
      return { message: 'Account deleted' };
    } catch {
      return fail(400, { message: 'Account cannot be deleted while it has transactions' });
    }
  }
};
