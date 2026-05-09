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
