// src/lib/services/moomoo-paper.service.ts
// Fetches live paper (simulate) account data from the moomoo bridge.

function bridgeBase(): string {
  return process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export type PaperAccountInfo = {
  total_assets: number;
  securities_assets: number;
  cash: number;
  market_val: number;
  unrealized_pl: number;
  realized_pl: number;
  power: number;
  avl_withdrawal_cash: number;
};

export type PaperPosition = {
  symbol: string;
  name: string;
  asset_type: string;
  market: string;
  quantity: number;
  average_cost: number;
  total_cost: number;
  market_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_percent: number;
  today_pl: number;
  currency: string;
};

export type PaperOrder = {
  broker_order_id: string;
  symbol: string;
  side: string;
  order_type: string;
  status: string;
  quantity: number;
  filled_quantity: number;
  price: number;
  average_filled_price: number;
  currency: string;
  submitted_at: string;
  updated_broker_at: string;
};

export type PaperDeal = {
  broker_deal_id: string;
  broker_order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  executed_at: string;
};

export type PaperDashboardData = {
  account: {
    account_label: string;
    broker_account_id: string;
    trade_environment: string;
    trdmarket_auth: string[];
  };
  account_info: PaperAccountInfo;
  positions: PaperPosition[];
  orders: PaperOrder[];
  deals: PaperDeal[];
  synced_at: string;
  error?: string;
};

export async function getMoomooPaperDashboard(): Promise<PaperDashboardData> {
  try {
    const res = await fetch(`${bridgeBase()}/paper/dashboard`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail ?? `Bridge error ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Moomoo bridge unreachable';
    return {
      account: {
        account_label: 'Moomoo Simulate',
        broker_account_id: '',
        trade_environment: 'SIMULATE',
        trdmarket_auth: [],
      },
      account_info: {
        total_assets: 0,
        securities_assets: 0,
        cash: 0,
        market_val: 0,
        unrealized_pl: 0,
        realized_pl: 0,
        power: 0,
        avl_withdrawal_cash: 0,
      },
      positions: [],
      orders: [],
      deals: [],
      synced_at: new Date().toISOString(),
      error: message,
    };
  }
}
