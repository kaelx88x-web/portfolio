export interface BridgeAccount {
  acc_id: string;
  trd_env: string;
  acc_status: string;
  sim_acc_type?: string;
  trdmarket_auth: string[];
  uni_card_num?: string;
  card_num?: string;
}

const SIM_TYPE_LABELS: Record<string, string> = {
  STOCK: 'Paper (Stocks)',
  OPTION: 'Paper (Options)',
  FUTURES: 'Paper (Futures)',
  STOCK_AND_OPTION: 'Paper (Stock & Options)',
};

/**
 * Map a DB account row to the same shape as a live bridge account, so the
 * account switcher can list already-synced accounts when the moomoo bridge /
 * OpenD is offline. Selecting an account is a DB write, so this works without
 * any live connection.
 */
export function mapDbAccount(a: { brokerAccId: string | null; name: string; accountType: string }) {
  const isReal = a.accountType === 'live' || a.accountType === 'brokerage';
  return {
    acc_id: a.brokerAccId ?? '',
    card_num: '',
    trd_env: (isReal ? 'REAL' : 'SIMULATE') as 'REAL' | 'SIMULATE',
    sim_acc_type: '',
    is_real: isReal,
    is_active: true,
    markets: [] as string[],
    name: a.name,
  };
}

export function mapBridgeAccount(a: BridgeAccount) {
  const simLabel = a.sim_acc_type ? (SIM_TYPE_LABELS[a.sim_acc_type] ?? `Paper (${a.sim_acc_type})`) : 'Paper';
  const name = a.trd_env === 'REAL'
    ? `Live Account (${a.acc_id})`
    : `${simLabel} (${a.acc_id})`;
  // card_num matches what user sees in moomoo APP (last 4 digits shown)
  const cardNum = a.uni_card_num || a.card_num || '';
  return {
    acc_id: a.acc_id,
    card_num: cardNum,
    trd_env: a.trd_env as 'REAL' | 'SIMULATE',
    sim_acc_type: a.sim_acc_type ?? '',
    is_real: a.trd_env === 'REAL',
    is_active: a.acc_status === 'ACTIVE',
    markets: a.trdmarket_auth ?? [],
    name,
  };
}
