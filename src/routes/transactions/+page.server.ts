import { fail } from '@sveltejs/kit';
import { listAccounts } from '$lib/services/account.service';
import { listAssets } from '$lib/services/asset.service';
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction
} from '$lib/services/transaction.service';
import { dateFromForm, numberFromForm, optionalString, requiredString } from '$lib/server/form';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const filters = {
    accountId: url.searchParams.get('accountId'),
    assetId: url.searchParams.get('assetId'),
    type: url.searchParams.get('type'),
    start: url.searchParams.get('start'),
    end: url.searchParams.get('end')
  };

  const [transactions, accounts, assets] = await Promise.all([
    listTransactions(user.id, filters),
    listAccounts(user.id),
    listAssets()
  ]);

  return { transactions, accounts, assets, filters };
}

function assetIdForType(formData: FormData) {
  const type = requiredString(formData, 'type').toLowerCase();
  const assetId = optionalString(formData, 'assetId');
  return ['buy', 'sell', 'dividend', 'split'].includes(type) ? assetId : null;
}

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      const type = requiredString(formData, 'type').toLowerCase();
      await createTransaction({
        userId: user.id,
        accountId: requiredString(formData, 'accountId'),
        assetId: assetIdForType(formData),
        type,
        tradeDate: dateFromForm(formData, 'tradeDate'),
        quantity: numberFromForm(formData, 'quantity'),
        price: numberFromForm(formData, 'price'),
        fee: numberFromForm(formData, 'fee'),
        currency: requiredString(formData, 'currency').toUpperCase(),
        notes: optionalString(formData, 'notes')
      });
      return { message: 'Transaction created' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to create transaction' });
    }
  },
  update: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      const type = requiredString(formData, 'type').toLowerCase();
      await updateTransaction(user.id, requiredString(formData, 'transactionId'), {
        accountId: requiredString(formData, 'accountId'),
        assetId: assetIdForType(formData),
        type,
        tradeDate: dateFromForm(formData, 'tradeDate'),
        quantity: numberFromForm(formData, 'quantity'),
        price: numberFromForm(formData, 'price'),
        fee: numberFromForm(formData, 'fee'),
        currency: requiredString(formData, 'currency').toUpperCase(),
        notes: optionalString(formData, 'notes')
      });
      return { message: 'Transaction updated' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to update transaction' });
    }
  },
  delete: async ({ request, locals }) => {
    const user = locals.user!;
    const formData = await request.formData();

    try {
      await deleteTransaction(user.id, requiredString(formData, 'transactionId'));
      return { message: 'Transaction deleted' };
    } catch {
      return fail(400, { message: 'Unable to delete transaction' });
    }
  }
};
