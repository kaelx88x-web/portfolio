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
  asset_type: string;
  quantity: number;
  average_cost: number;
  total_cost: number;
  market_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_percent: number;
  currency: string;
};

export type MoomooSyncResult = {
  account_label: string;
  trade_environment: string;
  security_firm: string;
  synced_at: string;
  holdings_count: number;
  holdings: BrokerHolding[];
  account_info: Record<string, number>;
};

export type SnapshotHolding = {
  symbol: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
};
