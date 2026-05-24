import { env } from '$env/dynamic/private';

export type InsiderTransaction = {
  name: string;
  share: number;
  value: number;
  change: number;
  transactionDate: string;
  transactionCode: string;
  filingDate: string;
  symbol: string;
  currency: string;
};

export type InsiderResult = {
  symbol: string;
  transactions: InsiderTransaction[];
  error?: string;
};

const CODE_LABEL: Record<string, string> = {
  P: 'Purchase',
  S: 'Sale',
  A: 'Award',
  D: 'Disposition',
  F: 'Tax Withholding',
  G: 'Gift',
  M: 'Option Exercise',
  X: 'Derivative Exercise',
  Z: 'Rule 10b5-1',
  C: 'Conversion',
  E: 'Expiration',
};

export function codeLabel(code: string): string {
  return CODE_LABEL[code?.toUpperCase()] ?? code ?? '—';
}

export type PeerCompany = {
  symbol: string;
  name: string;
  country: string;
  currency: string;
  exchange: string;
  industry: string;
  marketCap: number | null;
  logo: string;
  weburl: string;
  ipo: string;
};

export type PeersResult = {
  symbol: string;
  peers: PeerCompany[];
  error?: string;
};

async function finnhubGet(path: string, key: string): Promise<unknown> {
  const res = await fetch(`https://finnhub.io/api/v1${path}&token=${key}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getPeers(symbol: string): Promise<PeersResult> {
  const key = env.FINNHUB_API_KEY;
  if (!key) return { symbol, peers: [], error: 'FINNHUB_API_KEY not configured' };

  const s = symbol.toUpperCase();
  try {
    const peerSymbols = (await finnhubGet(`/stock/peers?symbol=${encodeURIComponent(s)}`, key)) as string[];
    if (!Array.isArray(peerSymbols) || peerSymbols.length === 0) return { symbol: s, peers: [] };

    // Fetch profiles in parallel (cap at 10 peers to stay within rate limits)
    const targets = peerSymbols.filter(p => p !== s).slice(0, 10);
    const profiles = await Promise.all(
      targets.map(async (sym) => {
        try {
          const p = (await finnhubGet(`/stock/profile2?symbol=${encodeURIComponent(sym)}`, key)) as Record<string, unknown>;
          return {
            symbol: sym,
            name: String(p.name ?? sym),
            country: String(p.country ?? ''),
            currency: String(p.currency ?? ''),
            exchange: String(p.exchange ?? ''),
            industry: String(p.finnhubIndustry ?? ''),
            marketCap: typeof p.marketCapitalization === 'number' ? p.marketCapitalization : null,
            logo: String(p.logo ?? ''),
            weburl: String(p.weburl ?? ''),
            ipo: String(p.ipo ?? ''),
          } as PeerCompany;
        } catch {
          return { symbol: sym, name: sym, country: '', currency: '', exchange: '', industry: '', marketCap: null, logo: '', weburl: '', ipo: '' } as PeerCompany;
        }
      })
    );

    profiles.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return { symbol: s, peers: profiles };
  } catch (err) {
    return { symbol: s, peers: [], error: String(err) };
  }
}

export async function getInsiderTransactions(symbol: string): Promise<InsiderResult> {
  const key = env.FINNHUB_API_KEY;
  if (!key) return { symbol, transactions: [], error: 'FINNHUB_API_KEY not configured' };

  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { symbol, transactions: [], error: `Finnhub HTTP ${res.status}` };
    const body = await res.json();
    const raw: InsiderTransaction[] = Array.isArray(body?.data) ? body.data : [];
    const transactions = raw
      .filter(t => t.transactionDate)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return { symbol: body.symbol ?? symbol, transactions };
  } catch (err) {
    return { symbol, transactions: [], error: String(err) };
  }
}
