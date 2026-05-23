// src/lib/server/queues.ts
import { Queue } from 'bullmq';
import { getRedis } from './redis.js';

// ─── Queue Names ────────────────────────────────────────────────────────────
export const QUEUE_OPTIONS_SCAN   = 'options-scan';
export const QUEUE_OPTION_ALERTS  = 'option-alerts';

// ─── Job Data Types ─────────────────────────────────────────────────────────
export type ScanOptionsJobData = {
  userId: string;
  triggeredBy: 'moomoo-sync' | 'schedule' | 'manual';
};

export type OptionType = 'covered_call' | 'cash_secured_put' | 'long_call' | 'long_put';
export type AlertSeverity = 'urgent' | 'profitable' | 'info';

export type OptionPosition = {
  symbol: string;
  name: string;
  optionType: OptionType;
  strike: number;
  expiry: string;       // ISO date string e.g. "2026-05-29"
  dte: number;          // days to expiry, ≥ 0
  quantity: number;
  premiumCollected: number;  // premium received per share (positive)
  currentValue: number;      // current option price per share
  unrealizedPnl: number;
  profitPct: number;    // % of max premium already captured, 0–100
  currentPrice: number; // underlying stock price
  costBasis?: number;   // avg cost of underlying shares (for covered calls)
};

export type OptionAlert = {
  id: string;
  userId: string;
  symbol: string;
  optionType: OptionType;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
  position: OptionPosition;
  detectedAt: string;   // ISO timestamp
  acknowledged: boolean;
};

export type ProcessAlertJobData = {
  userId: string;
  alert: OptionAlert;
};

// ─── Queue Singletons ────────────────────────────────────────────────────────
let _optionScanQueue: Queue<ScanOptionsJobData> | null = null;
let _optionAlertsQueue: Queue<ProcessAlertJobData> | null = null;

export function getOptionScanQueue(): Queue<ScanOptionsJobData> {
  if (!_optionScanQueue) {
    _optionScanQueue = new Queue<ScanOptionsJobData>(QUEUE_OPTIONS_SCAN, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });
  }
  return _optionScanQueue;
}

export function getOptionAlertsQueue(): Queue<ProcessAlertJobData> {
  if (!_optionAlertsQueue) {
    _optionAlertsQueue = new Queue<ProcessAlertJobData>(QUEUE_OPTION_ALERTS, {
      connection: getRedis(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });
  }
  return _optionAlertsQueue;
}

// ─── Redis Keys ──────────────────────────────────────────────────────────────
export const redisKey = {
  positions: (userId: string) => `option:positions:${userId}`,
  activeAlerts: (userId: string) => `option:alerts:active:${userId}`,
  lastScan: (userId: string) => `option:scan:last:${userId}`,
};

export const redisTTL = {
  positions: 900,    // 15 minutes
  activeAlerts: 3600, // 1 hour
  lastScan: 86400,   // 24 hours
};
