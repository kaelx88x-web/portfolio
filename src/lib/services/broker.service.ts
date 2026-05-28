import type { BrokerHolding, MoomooStatus, MoomooSyncResult } from '$lib/types/portfolio';
import { execFile, spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function base(): string {
  return process.env.LARAVEL_API_URL ?? 'http://127.0.0.1:8000/api';
}

function bridgeBase(): string {
  return process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

function authHeaders(): HeadersInit {
  return process.env.LARAVEL_API_TOKEN ? { Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}` } : {};
}

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.message ?? body?.detail ?? res.statusText ?? fallback;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export async function launchMoomooOpenD() {
  const bridge = await ensureMoomooBridgeRunning();
  const executablePath = await findMoomooOpenDExecutable();

  if (!executablePath) {
    return {
      success: false,
      message:
        'Could not find moomoo_OpenD.exe. Set MOOMOO_OPEND_PATH in .env to the full GUI OpenD path, then restart the app.'
    };
  }

  if (basename(executablePath).toLowerCase() !== 'moomoo_opend.exe') {
    return {
      success: false,
      message: 'Only the GUI OpenD app can be launched here. Use moomoo_OpenD.exe, not MoomooOpenD.exe.'
    };
  }

  try {
    if (await isMoomooOpenDRunning()) {
      return {
        success: true,
        message: bridge.started
          ? 'Moomoo bridge started and OpenD is already running. Log in inside the existing OpenD window, then sync.'
          : 'Moomoo OpenD is already running. Log in inside the existing OpenD window, then sync.',
        executablePath,
        bridge,
        alreadyRunning: true
      };
    }

    const child = spawn(executablePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();

    return {
      success: true,
      message: `Moomoo OpenD launch requested from ${executablePath}. Log in inside OpenD, then sync.`,
      executablePath,
      bridge
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unable to launch Moomoo OpenD.'
    };
  }
}

export async function reconnectMoomooOpenD() {
  const bridge = await ensureMoomooBridgeRunning();
  const executablePath = await findMoomooOpenDExecutable();

  if (!executablePath) {
    return {
      success: false,
      message:
        'Could not find moomoo_OpenD.exe. Set MOOMOO_OPEND_PATH in .env to the full GUI OpenD path, then restart the app.',
      bridge
    };
  }

  try {
    if (await isMoomooOpenDRunning()) {
      await stopMoomooOpenD();
      await sleep(1500);
    }

    const child = spawn(executablePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    child.unref();

    return {
      success: true,
      message: 'Moomoo bridge is running and OpenD was relaunched. Log in inside OpenD, then sync again.',
      executablePath,
      bridge,
      reconnected: true
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Unable to reconnect Moomoo OpenD.',
      bridge
    };
  }
}

async function ensureMoomooBridgeRunning() {
  const healthUrl = `${bridgeBase()}/health`;

  try {
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      return { running: true, started: false, url: bridgeBase() };
    }
  } catch {
    // Start the local bridge below.
  }

  const uvicorn = await findUvicornExecutable();
  if (!uvicorn) {
    return {
      running: false,
      started: false,
      url: bridgeBase(),
      message: 'Could not find uvicorn. Install moomoo-service requirements or create moomoo-service/venv.'
    };
  }

  const serviceDir = join(process.cwd(), 'moomoo-service');
  const child = spawn(uvicorn, ['main:app', '--host', '127.0.0.1', '--port', '8001'], {
    cwd: serviceDir,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      appdata: join(serviceDir, '.runtime', 'appdata'),
      APPDATA: join(serviceDir, '.runtime', 'appdata')
    }
  });
  child.unref();

  return { running: true, started: true, url: bridgeBase(), executablePath: uvicorn };
}

async function findUvicornExecutable() {
  const candidates =
    process.platform === 'win32'
      ? [
          join(process.cwd(), 'moomoo-service', 'venv', 'Scripts', 'uvicorn.exe'),
          'c:\\Ampps\\www\\az\\backend\\venv\\Scripts\\uvicorn.exe'
        ]
      : [
          join(process.cwd(), 'moomoo-service', 'venv', 'bin', 'uvicorn'),
          join(process.cwd(), '.venv', 'bin', 'uvicorn')
        ];

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep checking candidates.
    }
  }

  return null;
}

async function isMoomooOpenDRunning() {
  if (process.platform !== 'win32') return false;

  try {
    const { stdout } = await execFileAsync('tasklist', [
      '/FI',
      'IMAGENAME eq moomoo_OpenD.exe',
      '/FO',
      'CSV',
      '/NH'
    ]);
    return stdout.toLowerCase().includes('moomoo_opend.exe');
  } catch {
    return false;
  }
}

async function stopMoomooOpenD() {
  if (process.platform !== 'win32') return;

  try {
    await execFileAsync('taskkill', ['/IM', 'moomoo_OpenD.exe', '/T']);
  } catch {
    // It may already be closed by the time reconnect is clicked.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findMoomooOpenDExecutable() {
  for (const candidate of moomooOpenDPathCandidates()) {
    if (!candidate || basename(candidate).toLowerCase() !== 'moomoo_opend.exe') continue;

    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Keep checking the next known install location.
    }
  }

  return null;
}

function moomooOpenDPathCandidates() {
  const candidates = [process.env.MOOMOO_OPEND_PATH?.trim()].filter(Boolean) as string[];

  if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : null
    ].filter(Boolean) as string[];

    for (const root of roots) {
      candidates.push(
        join(root, 'moomoo OpenD', 'moomoo_OpenD.exe'),
        join(root, 'Moomoo OpenD', 'moomoo_OpenD.exe'),
        join(root, 'moomoo', 'OpenD', 'moomoo_OpenD.exe'),
        join(root, 'Moomoo', 'OpenD', 'moomoo_OpenD.exe')
      );
    }
  }

  return [...new Set(candidates)];
}

export async function getMoomooStatus(): Promise<MoomooStatus> {
  const apiUrl = `${base()}/brokers/moomoo/status`;
  const bridgeUrl = `${bridgeBase()}/status`;
  let apiError = '';

  try {
    const res = await fetch(apiUrl, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const body = await res.json();
      return body.data ?? body;
    }
    apiError = `${res.status} ${await readError(res, 'Status check failed')}`;
  } catch (err) {
    apiError = errorMessage(err);
  }

  try {
    const bridgeRes = await fetch(bridgeUrl, { signal: AbortSignal.timeout(5000) });
    if (!bridgeRes.ok) {
      throw new Error(`${bridgeRes.status} ${await readError(bridgeRes, 'Bridge status failed')}`);
    }
    return bridgeRes.json();
  } catch (err) {
    throw new Error(`Moomoo status failed. API ${apiUrl}: ${apiError}. Bridge ${bridgeUrl}: ${errorMessage(err)}.`);
  }
}

export type QuoteSnapshot = {
  code: string;
  name?: string;
  update_time?: string;
  last_price?: number;
  prev_close_price?: number;
  ask_price?: number;
  bid_price?: number;
  volume?: number;
  turnover?: number;
};

export type HistoricalCandle = {
  code: string;
  name?: string;
  time_key: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume?: number;
  turnover?: number;
  change_rate?: number;
  last_close?: number;
};

export type MarketState = {
  code: string;
  name?: string;
  market_state?: string;
};

export async function getQuoteSnapshots(codes: string[]): Promise<QuoteSnapshot[]> {
  const uniqueCodes = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  const res = await fetch(`${bridgeBase()}/quotes/snapshot?codes=${encodeURIComponent(uniqueCodes.join(','))}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    if (uniqueCodes.length > 1) {
      const fallback = await Promise.allSettled(uniqueCodes.map((code) => getQuoteSnapshots([code])));
      const quotes = fallback
        .filter((result): result is PromiseFulfilledResult<QuoteSnapshot[]> => result.status === 'fulfilled')
        .flatMap((result) => result.value);
      if (quotes.length > 0) return quotes;
    }
    throw new Error(`${res.status} ${await readError(res, 'Quote snapshot failed')}`);
  }
  const body = await res.json();
  return body.quotes ?? [];
}

export async function getHistoricalCandles(
  code: string,
  start?: string | null,
  end?: string | null
): Promise<HistoricalCandle[]> {
  const params = new URLSearchParams({ code: code.trim().toUpperCase() });
  if (start) params.set('start', start);
  if (end) params.set('end', end);

  const res = await fetch(`${bridgeBase()}/quotes/history?${params.toString()}`, {
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await readError(res, 'Historical quote failed')}`);
  }
  const body = await res.json();
  return body.candles ?? [];
}

export async function getMarketStates(codes: string[]): Promise<MarketState[]> {
  const uniqueCodes = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  const res = await fetch(`${bridgeBase()}/quotes/market-state?codes=${encodeURIComponent(uniqueCodes.join(','))}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await readError(res, 'Market state failed')}`);
  }
  const body = await res.json();
  return body.states ?? [];
}

export type CapitalFlowItem = {
  code: string;
  in_flow: number | null;
  main_in_flow: number | null;
  super_in_flow: number | null;
  big_in_flow: number | null;
  mid_in_flow: number | null;
  sml_in_flow: number | null;
  update_time: string | null;
  error: string | null;
};

export async function getCapitalFlow(codes: string[]): Promise<CapitalFlowItem[]> {
  const uniqueCodes = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  try {
    const res = await fetch(`${bridgeBase()}/quotes/capital-flow?codes=${encodeURIComponent(uniqueCodes.join(','))}`, {
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) return uniqueCodes.map((code) => ({ code, in_flow: null, main_in_flow: null, super_in_flow: null, big_in_flow: null, mid_in_flow: null, sml_in_flow: null, update_time: null, error: `${res.status}` }));
    const body = await res.json();
    return body.flows ?? [];
  } catch {
    return uniqueCodes.map((code) => ({ code, in_flow: null, main_in_flow: null, super_in_flow: null, big_in_flow: null, mid_in_flow: null, sml_in_flow: null, update_time: null, error: 'unavailable' }));
  }
}

export type CapitalDistributionItem = {
  code: string;
  super_in: number | null;
  super_out: number | null;
  big_in: number | null;
  big_out: number | null;
  mid_in: number | null;
  mid_out: number | null;
  sml_in: number | null;
  sml_out: number | null;
  error: string | null;
};

export async function getCapitalDistribution(codes: string[]): Promise<CapitalDistributionItem[]> {
  const uniqueCodes = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  const nullItem = (code: string, error: string): CapitalDistributionItem => ({
    code, super_in: null, super_out: null, big_in: null, big_out: null,
    mid_in: null, mid_out: null, sml_in: null, sml_out: null, error,
  });

  try {
    const res = await fetch(
      `${bridgeBase()}/quotes/capital-distribution?codes=${encodeURIComponent(uniqueCodes.join(','))}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) return uniqueCodes.map((c) => nullItem(c, `${res.status}`));
    const body = await res.json();
    return body.distributions ?? [];
  } catch {
    return uniqueCodes.map((c) => nullItem(c, 'unavailable'));
  }
}

export type CashFlowItem = {
  cashflow_id: string;
  clearing_date: string;
  settlement_date: string;
  currency: string;
  cashflow_type: string;
  cashflow_direction: 'IN' | 'OUT' | string;
  amount: number;
  remark: string;
};

export type MoomooOrderItem = {
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
  submitted_at: string | null;
  updated_broker_at: string | null;
  metadata: Record<string, unknown>;
};

export type MoomooDealItem = {
  broker_deal_id: string;
  broker_order_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  executed_at: string | null;
  metadata: Record<string, unknown>;
};

export type PlateItem = {
  code: string;
  name: string;
  class: string;
};

export type PlateStock = {
  code: string;
  name: string;
  lot_size: number;
  stock_type: string;
  last_price: number | null;
  change: number | null;
  change_pct: number | null;
  market_cap: number | null;
  pe_ttm: number | null;
  volume: number | null;
  turnover: number | null;
};

export async function getPlateList(market = 'US', plateClass = 'INDUSTRY'): Promise<PlateItem[]> {
  try {
    const res = await fetch(
      `${bridgeBase()}/quotes/plates?market=${market}&plate_class=${plateClass}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    const body = await res.json();
    return body.plates ?? [];
  } catch {
    return [];
  }
}

export async function getPlateStocks(plateCode: string): Promise<PlateStock[]> {
  try {
    const res = await fetch(
      `${bridgeBase()}/quotes/plate-stocks?plate_code=${encodeURIComponent(plateCode)}`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) return [];
    const body = await res.json();
    return body.stocks ?? [];
  } catch {
    return [];
  }
}

export type StockBasicInfo = {
  code: string;
  name: string | null;
  lot_size: number | null;
  listing_date: string | null;
  exchange: string | null;
  stock_type: string | null;
  suspension: boolean | null;
  pe_ratio: number | null;
  pe_ttm: number | null;
  pb_ratio: number | null;
  eps: number | null;
  market_cap: number | null;
  high_52wk: number | null;
  low_52wk: number | null;
  error: string | null;
};

export async function getStockBasicInfo(codes: string[]): Promise<StockBasicInfo[]> {
  const uniqueCodes = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return [];

  const nullItem = (code: string, error: string): StockBasicInfo => ({
    code, name: null, lot_size: null, listing_date: null, exchange: null,
    stock_type: null, suspension: null, pe_ratio: null, pe_ttm: null,
    pb_ratio: null, eps: null, market_cap: null, high_52wk: null, low_52wk: null, error,
  });

  try {
    const res = await fetch(
      `${bridgeBase()}/quotes/basic-info?codes=${encodeURIComponent(uniqueCodes.join(','))}`,
      { signal: AbortSignal.timeout(20000) }
    );
    if (!res.ok) return uniqueCodes.map((c) => nullItem(c, `${res.status}`));
    const body = await res.json();
    return body.basics ?? [];
  } catch {
    return uniqueCodes.map((c) => nullItem(c, 'unavailable'));
  }
}

export type MarketIndex = {
  code: string;
  name: string;
  last_price: number | null;
  change: number | null;
  change_pct: number | null;
};

export type GlobalMarket = {
  key: string;
  name: string;
  short: string;
  timezone: string;
  currency: string;
  state: string;
  status: 'open' | 'pre' | 'after' | 'break' | 'closed';
  indices: MarketIndex[];
};

export async function getGlobalMarkets(): Promise<{ fetched_at: string; markets: GlobalMarket[] }> {
  const res = await fetch(`${bridgeBase()}/quotes/global-markets`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function getAccountCashFlow(days = 30): Promise<CashFlowItem[]> {
  try {
    const res = await fetch(`${bridgeBase()}/cashflow?days=${days}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.cashflow ?? [];
  } catch {
    return [];
  }
}

export async function getMoomooOrders(preferReal = true, history = true): Promise<MoomooOrderItem[]> {
  try {
    const res = await fetch(`${bridgeBase()}/orders?prefer_real=${preferReal ? 'true' : 'false'}&history=${history ? 'true' : 'false'}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.orders ?? [];
  } catch {
    return [];
  }
}

export async function getMoomooDeals(preferReal = true, history = true): Promise<MoomooDealItem[]> {
  try {
    const res = await fetch(`${bridgeBase()}/deals?prefer_real=${preferReal ? 'true' : 'false'}&history=${history ? 'true' : 'false'}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.deals ?? [];
  } catch {
    return [];
  }
}

export async function syncMoomoo(preferReal = true, accId?: string): Promise<MoomooSyncResult> {
  const apiUrl = `${base()}/brokers/moomoo/sync${preferReal ? '' : '?prefer_real=false'}`;
  const legacyUrl = `${base()}/brokers/moomoo/sync-portfolio?prefer_real=${preferReal ? 'true' : 'false'}`;
  let apiError = '';
  let legacyError = '';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: authHeaders(),
      signal: AbortSignal.timeout(65000)
    });
    if (res.ok) {
      const body = await res.json();
      return fromLaravelSync(body.data ?? body);
    }
    apiError = `${res.status} ${await readError(res, 'Sync failed')}`;
  } catch (err) {
    apiError = errorMessage(err);
  }

  try {
    const legacyRes = await fetch(legacyUrl, {
      method: 'POST',
      headers: authHeaders(),
      signal: AbortSignal.timeout(65000)
    });
    if (!legacyRes.ok) {
      throw new Error(`${legacyRes.status} ${await readError(legacyRes, 'Legacy sync failed')}`);
    }
    return normalizeSyncResult(await legacyRes.json());
  } catch (err) {
    legacyError = errorMessage(err);
  }

  try {
    return await syncMoomooBridge(preferReal, accId);
  } catch (err) {
    throw new Error(
      `Moomoo sync failed. API ${apiUrl}: ${apiError}. Legacy API ${legacyUrl}: ${legacyError}. Bridge ${bridgeBase()}/sync: ${errorMessage(err)}.`
    );
  }
}

async function syncMoomooBridge(preferReal: boolean, accId?: string): Promise<MoomooSyncResult> {
  const [syncRes, balanceRes] = await Promise.all([
    fetch(`${bridgeBase()}/sync?prefer_real=${preferReal ? 'true' : 'false'}${accId ? `&acc_id=${encodeURIComponent(accId)}` : ''}`, { method: 'POST' }),
    fetch(`${bridgeBase()}/fund-balance`).catch(() => null)
  ]);
  if (!syncRes.ok) {
    throw new Error(`${syncRes.status} ${await readError(syncRes, 'Bridge sync failed')}`);
  }
  const data = await syncRes.json();
  const normalized = normalizeSyncResult(data);

  // Inject USD cash from fund-balance when sync response doesn't include account_info
  if (normalized.account_info.cash === 0 && balanceRes?.ok) {
    const balanceData = await balanceRes.json().catch(() => null);
    const usdBal = (balanceData?.balances ?? []).find((b: { currency: string }) => b.currency === 'USD');
    if (usdBal) {
      normalized.account_info.cash = Number(usdBal.cash ?? 0);
      normalized.account_info.total_assets = Number(usdBal.total_assets ?? 0);
      normalized.account_info.market_val = Number(usdBal.market_val ?? 0);
    }
  }

  return normalized;
}

function normalizeSyncResult(data: any): MoomooSyncResult {
  const accountInfo = data.account_info ?? {};

  return {
    account_label: data.account_label ?? 'Moomoo Account',
    account_number: data.account_number ?? '',
    acc_role: data.acc_role ?? '',
    trade_environment: data.trade_environment ?? '',
    security_firm: data.security_firm ?? '',
    trdmarket_auth: data.trdmarket_auth ?? [],
    synced_at: data.synced_at ?? new Date().toISOString(),
    holdings_count: Number(data.holdings_count ?? data.holdings?.length ?? 0),
    holdings: data.holdings ?? [],
    deals: data.deals ?? [],
    account_info: {
      total_assets: Number(accountInfo.total_assets ?? 0),
      securities_assets: Number(accountInfo.securities_assets ?? 0),
      cash: Number(accountInfo.cash ?? 0),
      market_val: Number(accountInfo.market_val ?? 0),
      unrealized_pl: Number(accountInfo.unrealized_pl ?? 0),
      realized_pl: Number(accountInfo.realized_pl ?? 0),
      power: Number(accountInfo.power ?? 0),
      avl_withdrawal_cash: Number(accountInfo.avl_withdrawal_cash ?? 0),
      is_pdt: Boolean(accountInfo.is_pdt ?? false),
      pdt_seq: String(accountInfo.pdt_seq ?? '')
    }
  };
}

function fromLaravelSync(data: any): MoomooSyncResult {
  if (Array.isArray(data?.holdings)) {
    return normalizeSyncResult(data);
  }

  const account = data.account ?? {};
  const metadata = account.metadata ?? {};
  const accountInfo = metadata.account_info ?? {};
  const positions = account.positions ?? [];
  const holdings: BrokerHolding[] = positions.map((position: any) => ({
    symbol: position.symbol,
    name: position.name ?? '',
    asset_type: position.metadata?.asset_type ?? 'stock',
    quantity: Number(position.quantity ?? 0),
    average_cost: Number(position.average_cost ?? 0),
    total_cost: Number(position.quantity ?? 0) * Number(position.average_cost ?? 0),
    market_price: Number(position.last_price ?? 0),
    market_value: Number(position.market_value ?? 0),
    unrealized_pl: Number(position.unrealized_pnl ?? 0),
    unrealized_pl_percent: Number(position.metadata?.unrealized_pl_percent ?? 0),
    today_pl: Number(position.metadata?.today_pl ?? 0),
    currency: position.currency ?? 'USD'
  }));

  return {
    account_label: account.account_name ?? 'Moomoo Account',
    account_number: metadata.account_number ?? '',
    acc_role: metadata.acc_role ?? '',
    trade_environment: metadata.trade_environment ?? '',
    security_firm: metadata.security_firm ?? '',
    trdmarket_auth: metadata.trdmarket_auth ?? [],
    synced_at: account.last_synced_at ?? new Date().toISOString(),
    holdings_count: holdings.length,
    holdings,
    deals: [],
    account_info: {
      total_assets: Number(account.net_liquidation_value ?? accountInfo.total_assets ?? 0),
      securities_assets: Number(accountInfo.securities_assets ?? 0),
      cash: Number(account.cash_balance ?? accountInfo.cash ?? 0),
      market_val: Number(accountInfo.market_val ?? 0),
      unrealized_pl: Number(accountInfo.unrealized_pl ?? 0),
      realized_pl: Number(accountInfo.realized_pl ?? 0),
      power: Number(account.buying_power ?? accountInfo.power ?? 0),
      avl_withdrawal_cash: Number(accountInfo.avl_withdrawal_cash ?? 0),
      is_pdt: Boolean(accountInfo.is_pdt ?? false),
      pdt_seq: String(accountInfo.pdt_seq ?? '')
    }
  };
}

// ─── Options Discovery ───────────────────────────────────────────────────────

export type OptionExpiryResult = {
  symbol: string;
  expiry_dates: string[];
  count: number;
};

export type OptionChainRow = {
  code: string | null;
  symbol: string;
  expiry: string;
  option_type: string;
  strike: number | null;
  last_price: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  volume: number | null;
  open_interest: number | null;
  implied_volatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
};

export type OptionChainResult = {
  symbol: string;
  expiry: string;
  option_type: string;
  count: number;
  chain: OptionChainRow[];
};

export type OptionCandidate = {
  underlying: string;
  underlying_price: number | null;
  strategy: 'covered_call' | 'cash_secured_put';
  option_type: 'call' | 'put';
  expiry: string;
  strike: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  collateral_per_contract: number | null;
  premium_yield_pct: number | null;
  implied_volatility: number | null;
  delta: number | null;
  theta: number | null;
  open_interest: number | null;
  option_code: string | null;
};

export type OptionCandidatesResult = {
  symbols: string[];
  mode: string;
  count: number;
  candidates: OptionCandidate[];
};

export async function getOptionExpiry(symbol: string): Promise<OptionExpiryResult> {
  const res = await fetch(`${bridgeBase()}/options/expiry?symbol=${encodeURIComponent(symbol)}`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`Options expiry fetch failed: ${res.status}`);
  return res.json();
}

export async function getOptionChain(
  symbol: string,
  expiry: string,
  optionType: 'call' | 'put' | 'all' = 'all'
): Promise<OptionChainResult> {
  const params = new URLSearchParams({ symbol, expiry, option_type: optionType });
  const res = await fetch(`${bridgeBase()}/options/chain?${params}`, {
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Options chain fetch failed: ${res.status}`);
  return res.json();
}

export async function getOptionCandidates(
  symbols: string[],
  mode: 'cc' | 'csp' | 'both' = 'both'
): Promise<OptionCandidatesResult> {
  const params = new URLSearchParams({ symbols: symbols.join(','), mode });
  const res = await fetch(`${bridgeBase()}/options/candidates?${params}`, {
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`Options candidates fetch failed: ${res.status}`);
  return res.json();
}
