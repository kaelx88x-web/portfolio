// src/routes/paper-trading/+page.server.ts
import { getMoomooPaperDashboard } from '$lib/services/moomoo-paper.service';
import { getLatestAgentPush } from '$lib/services/agent.service';
import { recordPriceAudit } from '$lib/services/price-audit.service';
import type { PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
const PAPER_ACC_ID = 4652657;

function toMoomooSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (/^(US\.|HK\.|SH\.|SZ\.)/.test(s)) return s;
  return `US.${s}`;
}

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

export const actions: Actions = {
  async previewOrder({ request, locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    const data = await request.formData();
    const assetType = data.get('asset_type') as string;
    const side = (data.get('side') as string ?? 'BUY').toUpperCase();
    const symbol = (data.get('symbol') as string ?? '').trim().toUpperCase();
    const orderType = (data.get('order_type') as string) ?? 'limit';
    const qty = parseInt(data.get('qty') as string) || 0;
    const price = parseFloat(data.get('price') as string) || 0;
    const optionCode = (data.get('option_code') as string) ?? '';

    if (!symbol) return fail(400, { message: 'Symbol is required' });
    if (qty <= 0) return fail(400, { message: 'Quantity must be at least 1' });

    const orderPayload = {
      symbol: assetType === 'option' ? optionCode : toMoomooSymbol(symbol),
      side: side.toLowerCase(),
      order_type: assetType === 'option' ? 'limit' : orderType,
      quantity: qty,
      price: price > 0 ? price : undefined,
      trade_env: 'SIMULATE',
      acc_id: PAPER_ACC_ID,
      dry_run: true,
    };

    // Call bridge with dry_run
    let bridgeOk = true;
    let bridgeMsg = '';
    try {
      const res = await fetch(`${BRIDGE}/execution/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        bridgeMsg = err.detail ?? `Bridge error ${res.status}`;
        bridgeOk = false;
      }
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }

    if (!bridgeOk) {
      return fail(502, { message: bridgeMsg });
    }

    // Risk guards
    const riskNotes: string[] = [];
    let safetyStatus: 'pass' | 'warn' | 'block' = 'pass';

    if (assetType === 'option') {
      if (side === 'BUY') {
        const maxLoss = price * 100 * qty;
        riskNotes.push(`Max loss on this trade: $${maxLoss.toFixed(2)} (premium paid)`);
      } else {
        // SELL option
        const rawStrike = parseFloat(optionCode.split(/[CP]/i).slice(-1)[0] ?? '0') || 0;
        const strikeFromCode = rawStrike > 1000 ? rawStrike / 1000 : rawStrike;
        const collateral = (strikeFromCode || price * 10) * 100 * qty * 0.20;
        riskNotes.push(`Estimated collateral required: $${collateral.toFixed(2)}.`);
        riskNotes.push('Assignment risk: if exercised, you must buy/deliver 100 shares per contract.');
        safetyStatus = 'warn';
      }
    }

    const estimatedValue = price * (assetType === 'option' ? qty * 100 : qty);

    return {
      symbol, side, qty,
      estimated_value: estimatedValue,
      safety_status: safetyStatus,
      message: safetyStatus === 'warn' ? 'Review risk notes before confirming' : 'Order preview ready',
      risk_notes: riskNotes,
      warnings: [],
      asset_type: assetType,
      order_type: orderType,
      price,
      option_code: optionCode,
    };
  },

  async submitOrder({ request, locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    const data = await request.formData();
    const assetType = data.get('asset_type') as string;
    const side = (data.get('side') as string ?? 'BUY').toLowerCase();
    const symbol = (data.get('symbol') as string ?? '').trim().toUpperCase();
    const orderType = (data.get('order_type') as string) ?? 'limit';
    const qty = parseInt(data.get('qty') as string) || 0;
    const price = parseFloat(data.get('price') as string) || 0;
    const optionCode = (data.get('option_code') as string) ?? '';

    const orderPayload = {
      symbol: assetType === 'option' ? optionCode : toMoomooSymbol(symbol),
      side,
      order_type: assetType === 'option' ? 'limit' : orderType,
      quantity: qty,
      price: price > 0 ? price : undefined,
      trade_env: 'SIMULATE',
      acc_id: PAPER_ACC_ID,
      dry_run: false,
    };

    const quoteTsRaw = data.get('quote_ts');
    await recordPriceAudit({
      userId: user.id, context: 'paper', symbol: toMoomooSymbol(symbol),
      source: String(data.get('quote_source') ?? 'unknown'),
      price: price > 0 ? price : null, bid: null, ask: null,
      quoteTs: quoteTsRaw ? Number(quoteTsRaw) : Date.now()
    }).catch(() => {});

    try {
      const res = await fetch(`${BRIDGE}/execution/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return fail(502, { message: err.detail ?? `Bridge error ${res.status}` });
      }
      const result = await res.json();
      if (!result.broker_order_id) {
        return fail(502, { message: 'Order accepted but no broker_order_id returned — verify in moomoo app' });
      }
      return {
        submitted: true,
        broker_order_id: result.broker_order_id,
        status: result.status ?? 'submitted',
        symbol,
        side: side.toUpperCase(),
        qty,
        price,
        asset_type: assetType,
      };
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }
  },

  async resetAccount({ locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    try {
      const res = await fetch(`${BRIDGE}/paper/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 501) {
          return fail(501, { message: 'Reset not supported by this bridge version' });
        }
        const err = await res.json().catch(() => ({}));
        return fail(502, { message: (err as any).detail ?? `Bridge error ${res.status}` });
      }
      const result = await res.json() as { cancelled_orders?: number; closed_positions?: number };
      return {
        reset: true,
        cancelled_orders: result.cancelled_orders ?? 0,
        closed_positions: result.closed_positions ?? 0,
      };
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }
  },
};
