import type { Account, Asset, Transaction } from '@prisma/client';

export type TransactionWithRelations = Transaction & {
  account: Account;
  asset: Asset | null;
};

export type Holding = {
  accountId: string;
  accountName: string;
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  sector: string | null;
  country: string | null;
  currency: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  allocationPercentage: number;
};

export type AllocationSlice = {
  label: string;
  value: number;
  percentage: number;
};

export type DashboardSummary = {
  totalPortfolioValue: number;
  totalGainLoss: number;
  totalCostBasis: number;
  cashBalance: number;
  todayChange: number;
};

export type MoomooStatus = {
  connected: boolean;
  quote_logged_in: boolean;
  trade_logged_in: boolean;
  host: string;
  port: number;
  message: string;
  server_version?: string;
  markets?: Record<string, string>;
};

export type BrokerHolding = {
  symbol: string;
  name: string;
  asset_type: string;
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

export type AccountInfo = {
  total_assets: number;
  securities_assets: number;
  cash: number;
  market_val: number;
  unrealized_pl: number;
  realized_pl: number;
  power: number;
  avl_withdrawal_cash: number;
  is_pdt: boolean;
  pdt_seq: string;
};

export type MoomooDealItem = {
  deal_id: string;
  code: string;
  side: string;
  qty: number;
  price: number;
  create_time: string;
  fee?: number;
};

export type MoomooSyncResult = {
  account_label: string;
  account_number: string;
  acc_role: string;
  trade_environment: string;
  security_firm: string;
  trdmarket_auth: string[];
  synced_at: string;
  holdings_count: number;
  holdings: BrokerHolding[];
  deals: MoomooDealItem[];
  account_info: AccountInfo;
};

export type SnapshotHolding = {
  accountName?: string;
  brokerName?: string;
  symbol: string;
  name: string;
  assetType: string;
  sector?: string | null;
  country?: string | null;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  todayPl: number;
  currency: string;
};
