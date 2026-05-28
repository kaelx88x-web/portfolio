import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

export function buildAccountName(trd_env: string, acc_id: string): string {
  return trd_env === 'REAL' ? `Live Account (${acc_id})` : `Simulate Account (${acc_id})`;
}

export function buildAccountType(trd_env: string): string {
  return trd_env === 'REAL' ? 'live' : 'paper';
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const body = await request.json() as { acc_id: string; trd_env: string; name?: string; currency?: string };
  const { acc_id, trd_env, name, currency = 'USD' } = body;

  if (!acc_id) throw error(400, 'acc_id is required');

  // Save selection on User
  await prisma.user.update({
    where: { id: locals.user.id },
    data: { activeBrokerAccId: acc_id },
  });

  // Auto-create portfolio Account if none exists for this brokerAccId
  const account = await prisma.account.upsert({
    where: { userId_brokerAccId: { userId: locals.user.id, brokerAccId: acc_id } },
    create: {
      userId: locals.user.id,
      name: name ?? buildAccountName(trd_env, acc_id),
      brokerName: 'moomoo',
      accountType: buildAccountType(trd_env),
      currency,
      brokerAccId: acc_id,
    },
    update: {},
  });

  return json({ ok: true, accountId: account.id });
};
