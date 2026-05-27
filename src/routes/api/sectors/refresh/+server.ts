import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export const POST: RequestHandler = async ({ locals }) => {
  const assets = await prisma.asset.findMany();

  if (assets.length === 0) {
    return json({ updated: 0, message: 'No assets found.' });
  }

  // Map moomoo-format code -> assetId
  // Symbols stored as "US.AAPL" already have prefix; bare "AAPL" → assume "US.AAPL"
  const codeMap = new Map<string, string>();
  for (const asset of assets) {
    const code = asset.symbol.includes('.') ? asset.symbol : `US.${asset.symbol}`;
    codeMap.set(code, asset.id);
  }

  const codes = [...codeMap.keys()].join(',');

  let sectorData: { code: string; sector: string | null }[] = [];
  try {
    const res = await fetch(
      `${bridgeBase()}/quotes/owner-plate?codes=${encodeURIComponent(codes)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return json({ updated: 0, error: detail?.detail ?? res.statusText }, { status: 502 });
    }
    const body = await res.json();
    sectorData = body.sectors ?? [];
  } catch (err) {
    return json(
      { updated: 0, error: err instanceof Error ? err.message : 'Moomoo service unreachable' },
      { status: 502 }
    );
  }

  // Fetch snapshot to identify ETFs — exclude options (no quote permission)
  const optionPattern = /\d{6}[CP]\d+$/;
  const nonOptionCodes = [...codeMap.keys()].filter(
    (c) => !optionPattern.test(c.split('.').pop() ?? '')
  );

  let snapshotTypes: Record<string, string> = {};
  try {
    const snapRes = await fetch(
      `${bridgeBase()}/quotes/snapshot?codes=${encodeURIComponent(nonOptionCodes.join(','))}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (snapRes.ok) {
      const snapBody = await snapRes.json();
      for (const q of snapBody.quotes ?? []) {
        const c = (q.code as string).toUpperCase();
        // Moomoo uses trust_valid=true for trust/ETF-like instruments on some markets.
        // For US ETFs trust_valid is usually false but equity_valid is true — we check
        // the asset_type returned by the snapshot endpoint (which uses _asset_type heuristic).
        // We use a best-effort: if owner-plate returned no sector AND no trust/index flags,
        // label by the known ETF list or mark as ETF if trust_valid is true.
        if (q.trust_valid) snapshotTypes[c] = 'ETF';
        else if (q.index_valid) snapshotTypes[c] = 'Index';
      }
    }
  } catch { /* ignore — sector from owner-plate is enough */ }

  let updated = 0;
  await Promise.all(
    sectorData.map(async (s) => {
      const assetId = codeMap.get(s.code);
      if (!assetId) return;

      let sector = s.sector;

      // For codes with no sector from Moomoo, apply fallback labels
      if (!sector) {
        const asset = assets.find((a) => a.id === assetId);
        if (!asset) return;
        const sym = asset.symbol;
        // Options — skip, no sector needed
        if (/\d{6}[CP]\d+$/.test(sym.split('.').pop() ?? '')) return;
        // ETF / Trust identified by Moomoo snapshot trust_valid flag
        if (snapshotTypes[s.code]) {
          sector = snapshotTypes[s.code];
        } else {
          return; // Unknown — leave as-is, don't guess
        }
      }

      if (sector) {
        await prisma.asset.update({ where: { id: assetId }, data: { sector } });
        updated++;
      }
    })
  );

  // Bust risk-exposure cache so the page picks up new sectors immediately
  try {
    const user = locals.user!;
    await prisma.analyticsCache.deleteMany({
      where: { userId: user.id, cacheKey: { contains: 'risk_exposure' } }
    });
  } catch { /* cache table may not exist — ignore */ }

  return json({ updated, total: assets.length, message: 'Done. Reload page to see updated sectors.' });
}
