/**
 * Section 1 — Data Integrity.
 *
 * An AI response may only talk about tickers and figures that exist in the
 * user's real portfolio. This module extracts the tickers and money figures an
 * AI surface emitted and reconciles them against `KnownPortfolioData`. Invented
 * tickers are a hard failure; money figures that match no known number are
 * surfaced as "unverified" (a softer signal, since the AI legitimately reports
 * derived sums) and dock the integrity score.
 */
import type { AiResponseUnderTest, IntegrityResult, KnownPortfolioData } from './types';

/**
 * All-caps tokens that look like tickers but are domain vocabulary, never
 * symbols. Kept narrow on purpose — real tickers must still be caught.
 */
const TICKER_STOPLIST = new Set([
  'AI', 'P', 'L', 'PL', 'P/L', 'YTD', 'MTD', 'DTE', 'USD', 'HKD', 'SGD', 'MYR',
  'CNY', 'EUR', 'GBP', 'ETF', 'CC', 'CSP', 'IV', 'VIX', 'ROI', 'CAGR', 'NAV',
  'API', 'OK', 'TODO', 'FAQ', 'US', 'HK', 'SG', 'MY', 'CN', 'UK', 'EU',
  'PORTFOLIO', 'HEALTH', 'RISK', 'CASH', 'TODAY', 'WEEK', 'ACTION', 'PLAN',
  'MARKET', 'REGIME', 'BULLISH', 'BEARISH', 'NEUTRAL', 'WATCHLIST', 'AND', 'OR',
  'THE', 'A', 'I', 'NO', 'YES', 'BUY', 'SELL', 'HOLD', 'ROLL', 'CALL', 'PUT',
  // UI chrome / severity / table-header vocabulary that surfaces in page text.
  'TOTAL', 'LIVE', 'PAPER', 'TYPE', 'HIGH', 'LOW', 'MEDIUM', 'PANEL', 'GOOD',
  'WEAK', 'MENU', 'HOME', 'BACK', 'NEXT', 'SAVE', 'EDIT', 'VIEW', 'NEW', 'ALL',
  'TOP', 'NET', 'AVG', 'MIN', 'MAX', 'SUM', 'DAY', 'OPEN', 'CLOSE', 'NONE',
  'STABLE', 'WATCH', 'ELEVATED', 'SHARPE', 'SORTINO', 'ALPHA', 'BETA', 'THETA',
  // Portfolio Assistant section / column / role labels.
  'STORY', 'ROLE', 'VALUE', 'TRUST', 'TARGET', 'INCOME', 'GROWTH', 'HEDGE',
  'CORE', 'SATELLITE', 'INSIGHT', 'TIMELINE', 'DRIFT', 'CONTRIBUTORS',
]);

/** Matches an OCC option symbol, optionally market-prefixed/suffixed. */
const OPTION_RE = /\b([A-Z]{1,6})\d{6}[CP]\d{4,8}\b/;

/**
 * Pulls ticker-like tokens out of free text. Recognises:
 *  - market-prefixed (US.SCHG, HK.00005)
 *  - suffixed (0005.HK, 600519.SS)
 *  - OCC option symbols (NIO260530C00005500)
 *  - bare uppercase symbols (AAPL, NIO) 2–6 chars, not in the stoplist.
 */
export function extractTickers(text: string): string[] {
  const found = new Set<string>();

  // market-prefixed e.g. US.SCHG / HK.00005
  for (const m of text.matchAll(/\b(US|HK|SH|SZ|SG|MY|CN)\.[A-Z0-9]{1,8}\b/g)) {
    found.add(m[0].toUpperCase());
  }
  // suffixed e.g. 0005.HK / 600519.SS
  for (const m of text.matchAll(/\b[A-Z0-9]{1,8}\.(HK|KL|SI|SS|SZ|US)\b/g)) {
    found.add(m[0].toUpperCase());
  }
  // OCC options e.g. NIO260530C00005500 (with optional .US)
  for (const m of text.matchAll(/\b[A-Z]{1,6}\d{6}[CP]\d{4,8}(?:\.[A-Z]{2})?\b/g)) {
    found.add(m[0].toUpperCase());
  }
  // bare uppercase symbols — 3–6 chars. Two-letter all-caps are almost always
  // initials/abbreviations (e.g. avatar "KA"), and real 2-letter tickers are
  // still caught via their market-prefixed / suffixed forms.
  for (const m of text.matchAll(/\b[A-Z]{3,6}\b/g)) {
    const tok = m[0].toUpperCase();
    if (TICKER_STOPLIST.has(tok)) continue;
    found.add(tok);
  }

  return [...found];
}

/** Money figures: $1,719.50 / -$81.00 / RM 1,234.56 / 5.44 USD … */
export function extractMoneyValues(text: string): number[] {
  const values: number[] = [];
  // currency-symbol prefixed (optionally signed)
  for (const m of text.matchAll(/-?(?:US)?\$\s?-?([\d,]+(?:\.\d+)?)/g)) {
    values.push(parseFloat(m[1].replace(/,/g, '')));
  }
  // currency-code suffixed: "5.44 USD"
  for (const m of text.matchAll(/\b([\d,]+\.\d+)\s?(?:USD|HKD|SGD|MYR|CNY)\b/g)) {
    values.push(parseFloat(m[1].replace(/,/g, '')));
  }
  return values.filter((v) => Number.isFinite(v));
}

/** Canonical "MARKET:CODE" so the same security matches across formats. */
export function canonicalTicker(symbol: string): string {
  let s = (symbol || '').trim().toUpperCase();
  // Strip a market suffix/prefix wrapper so options reduce consistently whether
  // stored as "US.PATH260612P10500" or surfaced bare as "PATH260612P10500".
  const prefix = s.match(/^(US|HK|SH|SZ|SG|MY|CN)\.(.+)$/);
  const suffix = s.match(/^(.+)\.(HK|KL|SI|SS|SZ|US)$/);
  let market = 'US';
  let body = s;
  if (prefix) {
    market = prefix[1];
    body = prefix[2];
  } else if (suffix) {
    body = suffix[1];
    market = { HK: 'HK', KL: 'MY', SI: 'SG', SS: 'SH', SZ: 'SZ', US: 'US' }[suffix[2]] ?? suffix[2];
  }
  // An OCC option always reduces to its underlying, so an option in the text
  // matches the underlying-or-option that the portfolio actually holds.
  const occ = body.match(OPTION_RE);
  let code = occ ? occ[1] : body;
  if (/^\d+$/.test(code)) code = String(parseInt(code, 10));
  return `${market}:${code}`;
}

function isKnownTicker(ticker: string, known: KnownPortfolioData): boolean {
  const allowed = new Set(known.allowedTickers.map(canonicalTicker));
  // An option symbol is allowed if its underlying is held.
  return allowed.has(canonicalTicker(ticker));
}

/** Recursively collect every finite number found anywhere in a value. */
export function collectNumbers(value: unknown, acc: number[] = [], depth = 0): number[] {
  if (depth > 8 || value == null) return acc;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectNumbers(item, acc, depth + 1);
  } else if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectNumbers(v, acc, depth + 1);
  }
  return acc;
}

/** Does `value` match a known number within tolerance (handles rounding)? */
export function matchesKnownNumber(value: number, known: KnownPortfolioData, tol = 0.02): boolean {
  const abs = Math.abs(value);
  if (abs === 0) return true; // $0.00 is never an invention
  return known.knownNumbers.some((n) => {
    const k = Math.abs(n);
    if (k === 0) return false;
    return Math.abs(k - abs) <= Math.max(tol, k * tol);
  });
}

/**
 * Build the ground-truth set from an AI portfolio context payload (the camelCase
 * `AiPortfolioContext` from ai-context.service). Tolerant of partial shapes so
 * it can also be fed hand-built fixtures in unit tests.
 */
export function fromAiContext(ctx: {
  metadata?: { baseCurrency?: string };
  portfolio?: {
    value?: number;
    cashBalance?: number;
    holdings?: Array<{
      symbol: string;
      name?: string;
      marketPrice?: number;
      marketValue?: number;
      unrealizedPnl?: number;
    }>;
  };
  benchmark?: { benchmark?: string };
}): KnownPortfolioData {
  const holdings = ctx.portfolio?.holdings ?? [];
  const currency = ctx.metadata?.baseCurrency ?? 'USD';
  const cashBalance = ctx.portfolio?.cashBalance ?? 0;

  // Words from a holding's display name are legitimately mentionable (e.g. an
  // ETF's issuer "Tidal" in "SPYT"), so allow capitalised name tokens too —
  // otherwise they read as invented tickers.
  const nameTokens = holdings.flatMap((h) =>
    (h.name ?? '').toUpperCase().match(/\b[A-Z]{3,}\b/g) ?? [],
  );

  const allowedTickers = [
    ...holdings.map((h) => h.symbol),
    ...nameTokens,
    ...(ctx.benchmark?.benchmark ? [ctx.benchmark.benchmark] : []),
    currency,
  ];

  // Every figure the AI shows is derived FROM the context, so the full set of
  // known numbers is every finite number anywhere in the context payload
  // (values, P&L, ratios, percentages, drift, contributors …). A money figure
  // that matches none of these is a genuine invention.
  const knownNumbers = collectNumbers(ctx);
  // Add rounded (2dp) forms so display rounding still reconciles.
  const rounded = knownNumbers.map((n) => Math.round(n * 100) / 100);

  return {
    currency,
    allowedTickers,
    knownNumbers: [...new Set([...knownNumbers, ...rounded])],
    cashBalance,
    buyingPower: ctx.portfolio?.cashBalance ?? 0,
    hasOptions: holdings.some((h) => OPTION_RE.test(canonicalTicker(h.symbol)) || /[CP]\d{4,8}/.test(h.symbol)),
  };
}

/**
 * Core Section 1 check. Hard-fails on invented tickers; docks the score for
 * money figures that reconcile against no known number.
 */
export function checkDataIntegrity(
  response: AiResponseUnderTest,
  known: KnownPortfolioData,
): IntegrityResult {
  const tickersFound = extractTickers(response.text);
  const hallucinatedTickers = tickersFound.filter((t) => !isKnownTicker(t, known));

  const moneyValuesFound = extractMoneyValues(response.text);
  const unverifiedMoneyValues = moneyValuesFound.filter((v) => !matchesKnownNumber(v, known));

  const failures: string[] = [];
  if (hallucinatedTickers.length > 0) {
    failures.push(`Invented ticker(s): ${hallucinatedTickers.join(', ')}`);
  }
  if (unverifiedMoneyValues.length > 0) {
    failures.push(
      `Money figure(s) not found in portfolio data: ${unverifiedMoneyValues
        .map((v) => v.toFixed(2))
        .join(', ')}`,
    );
  }

  // Invented tickers are disqualifying; unverified numbers each cost 15 pts.
  let score = 100;
  if (hallucinatedTickers.length > 0) score -= 40 + (hallucinatedTickers.length - 1) * 20;
  score -= unverifiedMoneyValues.length * 15;
  score = Math.max(0, Math.min(100, score));

  return {
    passed: hallucinatedTickers.length === 0 && unverifiedMoneyValues.length === 0,
    score,
    tickersFound,
    hallucinatedTickers,
    moneyValuesFound,
    unverifiedMoneyValues,
    failures,
  };
}
