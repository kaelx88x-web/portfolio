// src/routes/paper-trading/+page.server.ts
import { getMoomooPaperDashboard } from '$lib/services/moomoo-paper.service';
import { getLatestAgentPush } from '$lib/services/agent.service';
import type { PageServerLoad } from './$types';

const IS_SAAS = process.env.PUBLIC_APP_MODE === 'saas';

export const load: PageServerLoad = async ({ locals }) => {
  // In SaaS mode, read from the latest agent push stored in DB.
  // The customer's local agent is responsible for keeping it fresh.
  if (IS_SAAS) {
    try {
      const user = locals.user!;
      const push = await getLatestAgentPush(user.id);

      if (push) {
        return {
          paper: {
            account:         push.account      ?? { account_label: 'Moomoo Simulate', broker_account_id: '', trade_environment: 'SIMULATE', trdmarket_auth: [] },
            account_info:    push.account_info ?? { total_assets: 0, securities_assets: 0, cash: 0, market_val: 0, unrealized_pl: 0, realized_pl: 0, power: 0, avl_withdrawal_cash: 0 },
            positions:       push.positions    ?? [],
            orders:          push.orders       ?? [],
            deals:           push.deals        ?? [],
            synced_at:       push.synced_at    ?? push.pushedAt.toISOString(),
            error:           null,
            from_agent:      true,
            agent_pushed_at: push.pushedAt.toISOString(),
          },
        };
      }

      // No agent data yet — show clear message directing user to set up agent
      return {
        paper: {
          account:         { account_label: 'Moomoo Simulate', broker_account_id: '', trade_environment: 'SIMULATE', trdmarket_auth: [] },
          account_info:    { total_assets: 0, securities_assets: 0, cash: 0, market_val: 0, unrealized_pl: 0, realized_pl: 0, power: 0, avl_withdrawal_cash: 0 },
          positions:       [],
          orders:          [],
          deals:           [],
          synced_at:       new Date().toISOString(),
          error:           'No agent data yet. Set up the local agent on your PC — see Settings > Agent.',
          from_agent:      false,
          agent_pushed_at: null,
        },
      };
    } catch (err) {
      console.error('[paper-trading] SaaS load failed', err);
      return {
        paper: {
          account:         { account_label: 'Moomoo Simulate', broker_account_id: '', trade_environment: 'SIMULATE', trdmarket_auth: [] },
          account_info:    { total_assets: 0, securities_assets: 0, cash: 0, market_val: 0, unrealized_pl: 0, realized_pl: 0, power: 0, avl_withdrawal_cash: 0 },
          positions:       [],
          orders:          [],
          deals:           [],
          synced_at:       new Date().toISOString(),
          error:           'Failed to load agent data. Please try again.',
          from_agent:      false,
          agent_pushed_at: null,
        },
      };
    }
  }

  // Self-hosted mode: call moomoo-service directly as before
  const data = await getMoomooPaperDashboard();
  return { paper: { ...data, from_agent: false, agent_pushed_at: null } };
};
