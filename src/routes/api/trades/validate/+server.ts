// src/routes/api/trades/validate/+server.ts
import { json } from '@sveltejs/kit';
import {
  parseTradeOrderType, parseTradeTicketType, validateTradeTicket
} from '$lib/services/trade-layer.service';
import { assessQuoteFreshness } from '$lib/trading/freshness';
import { recordPriceAudit } from '$lib/services/price-audit.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));

  // Server-side staleness enforcement on the client-supplied quote snapshot.
  // Only enforce when a quote IS provided — legacy callers that omit quote are not blocked.
  const quote = body.quote ?? null;
  const ageMs = quote && typeof quote.ts === 'number' ? Date.now() - quote.ts : null;
  const freshness = quote ? assessQuoteFreshness(ageMs) : 'fresh';

  const validation = await validateTradeTicket(user.id, {
    sourceType: String(body.sourceType ?? 'manual'),
    sourceId: body.sourceId ? String(body.sourceId) : null,
    ticketType: parseTradeTicketType(body.ticketType),
    symbol: String(body.symbol ?? ''),
    side: body.side,
    quantity: Number(body.quantity ?? 0),
    orderType: parseTradeOrderType(body.orderType),
    limitPrice: body.limitPrice === null || body.limitPrice === undefined ? null : Number(body.limitPrice),
    thesis: body.thesis ? String(body.thesis) : undefined,
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {}
  });

  // Record what price the user is validating against.
  if (quote) {
    await recordPriceAudit({
      userId: user.id, context: 'trade', symbol: String(body.symbol ?? ''),
      source: String(quote.source ?? 'unknown'), price: quote.price ?? null,
      bid: quote.bid ?? null, ask: quote.ask ?? null, quoteTs: Number(quote.ts ?? Date.now())
    }).catch(() => {});
  }

  // A block overrides ok; a warn is surfaced but non-blocking.
  const ok = (validation as { ok?: boolean }).ok !== false && freshness !== 'block';
  const warnings = [
    ...((validation as { warnings?: string[] }).warnings ?? []),
    ...(freshness === 'warn' ? ['Quote may be stale (>60s) — refresh before confirming.'] : []),
    ...(freshness === 'block' ? ['Quote too old (>5min) — refresh required before placing a live order.'] : [])
  ];

  return json({ status: 'validated', validation: { ...validation, ok, freshness, warnings } });
};
