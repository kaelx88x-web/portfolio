import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

const OPTION_RE = /\d{6}[CP]\d+$/i;

/** Canonical "MARKET:CODE" key so the same security matches across formats. */
function canonical(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  const prefix = s.match(/^(US|HK|SH|SZ|SG|MY|CN)\.(.+)$/);
  const suffix = s.match(/^(.+)\.(HK|KL|SI|SS|SZ)$/);
  let market: string;
  let code: string;
  if (prefix) { market = prefix[1]; code = prefix[2]; }
  else if (suffix) { code = suffix[1]; market = { HK: 'HK', KL: 'MY', SI: 'SG', SS: 'SH', SZ: 'SZ' }[suffix[2]] ?? suffix[2]; }
  else { market = 'US'; code = s; }
  if (/^\d+$/.test(code)) code = String(parseInt(code, 10));
  return `${market}:${code}`;
}

/** Convert any stored symbol to moomoo code form (e.g. 0005.HK -> HK.00005). */
function toMoomooCode(symbol: string): string {
  const s = (symbol || '').trim().toUpperCase();
  if (/^(US|HK|SH|SZ|SG|MY|CN)\./.test(s)) return s;
  const suffix = s.match(/^(.+)\.(HK|KL|SS|SZ|SI)$/);
  if (suffix) {
    const mk = { HK: 'HK', KL: 'MY', SS: 'SH', SZ: 'SZ', SI: 'SG' }[suffix[2]] ?? suffix[2];
    let code = suffix[1];
    if (mk === 'HK' && /^\d+$/.test(code)) code = code.padStart(5, '0');
    return `${mk}.${code}`;
  }
  return `US.${s}`;
}

function isOption(symbol: string): boolean {
  return OPTION_RE.test(symbol.split('.').pop() ?? '');
}
function countryForMarket(market: string): string {
  return { US: 'US', HK: 'HK', SH: 'CN', SZ: 'CN', MY: 'MY', SG: 'SG' }[market] ?? 'US';
}
function currencyForMarket(market: string): string {
  return { US: 'USD', HK: 'HKD', SH: 'CNY', SZ: 'CNY', MY: 'MYR', SG: 'SGD' }[market] ?? 'USD';
}

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ updated: 0, error: 'Unauthorized' }, { status: 401 });
  const userId = locals.user.id;

  const assets = await prisma.asset.findMany({ select: { id: true, symbol: true, sector: true } });

  // Canonical -> existing asset, so moomoo results write back regardless of the
  // stored symbol format (0005.HK vs HK.00005).
  const canonToAsset = new Map<string, { id: string; sector: string | null }>();
  for (const a of assets) canonToAsset.set(canonical(a.symbol), { id: a.id, sector: a.sector });

  // Only query the GAPS the user actually holds — owner-plate rate-limits and
  // returns null for an entire chunk if any code in it is unsupported, so keep
  // the batch small and clean (just held securities that aren't classified yet).
  const codeSet = new Set<string>();
  const snaps = await prisma.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: 'desc' },
    distinct: ['brokerAccId'],
    select: { brokerAccId: true, holdingsJson: true }
  });
  for (const snap of snaps) {
    let rows: Array<{ symbol?: string }> = [];
    try { rows = JSON.parse(snap.holdingsJson); } catch { rows = []; }
    for (const h of rows) {
      const sym = (h.symbol ?? '').trim();
      if (!sym || isOption(sym)) continue;
      const existing = canonToAsset.get(canonical(sym));
      if (existing?.sector) continue; // already classified
      codeSet.add(toMoomooCode(sym));
    }
  }

  if (codeSet.size === 0) {
    return json({ updated: 0, created: 0, message: 'No assets found.' });
  }

  const codes = [...codeSet];
  // moomoo owner-plate silently returns null for most codes in a large batch,
  // so query in small chunks and merge.
  const CHUNK = 20;
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += CHUNK) chunks.push(codes.slice(i, i + CHUNK));

  const sectorData: { code: string; sector: string | null }[] = [];
  for (const group of chunks) {
    try {
      const res = await fetch(
        `${bridgeBase()}/quotes/owner-plate?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) continue; // skip a bad chunk, keep the rest
      const body = await res.json();
      for (const s of body.sectors ?? []) sectorData.push(s);
    } catch {
      continue;
    }
  }
  if (sectorData.length === 0) {
    return json({ updated: 0, error: 'Moomoo owner-plate returned no data' }, { status: 502 });
  }

  // ETF/Index detection for codes owner-plate can't classify (US ETFs etc.).
  const snapshotTypes: Record<string, string> = {};
  for (const group of chunks) {
    try {
      const snapRes = await fetch(
        `${bridgeBase()}/quotes/snapshot?codes=${encodeURIComponent(group.join(','))}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!snapRes.ok) continue;
      const snapBody = await snapRes.json();
      for (const q of snapBody.quotes ?? []) {
        const c = (q.code as string).toUpperCase();
        if (q.trust_valid) snapshotTypes[c] = 'ETF';
        else if (q.index_valid) snapshotTypes[c] = 'Index';
      }
    } catch { /* sector from owner-plate is enough */ }
  }

  let updated = 0;
  let created = 0;
  for (const item of sectorData) {
    const code = (item.code ?? '').toUpperCase();
    const sector = item.sector || snapshotTypes[code];
    if (!sector) continue; // leave unresolved ones as-is

    const canon = canonical(code);
    const existing = canonToAsset.get(canon);
    if (existing) {
      await prisma.asset.update({ where: { id: existing.id }, data: { sector } });
      updated++;
    } else {
      const market = code.split('.')[0];
      await prisma.asset.upsert({
        where: { symbol: code },
        create: {
          symbol: code,
          name: code,
          assetType: 'stock',
          sector,
          country: countryForMarket(market),
          currency: currencyForMarket(market)
        },
        update: { sector }
      });
      created++;
    }
  }

  // Bust risk-exposure cache so the page reflects new sectors on reload.
  try {
    await prisma.analyticsCache.deleteMany({
      where: { userId, cacheKey: { contains: 'risk_exposure' } }
    });
  } catch { /* cache table may not exist — ignore */ }

  return json({
    updated,
    created,
    total: assets.length,
    message: 'Done. Reload page to see updated sectors.'
  });
};
