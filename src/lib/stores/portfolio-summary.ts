import { writable } from 'svelte/store';

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePct: number;
  accountName: string;
  accountMode: 'LIVE' | 'SANDBOX';
}

export const portfolioSummary = writable<PortfolioSummary>({
  totalValue: 0,
  dayChange: 0,
  dayChangePct: 0,
  accountName: 'Portfolio',
  accountMode: 'LIVE',
});
