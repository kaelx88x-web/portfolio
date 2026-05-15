# Yahoo Finance Price Fetch — Design Spec

**Date:** 2026-05-15
**Status:** Approved

## Problem

Holdings page calculates `unrealizedPnl = marketValue - costBasis` using `asset.latestPrice`. This field is only updated during Moomoo broker sync, which requires OpenD to be running. When OpenD is offline, prices go stale and P&L shows 0 or incorrect values.

## Goal

Add Yahoo Finance as a secondary price source. User triggers a manual "Refresh Prices" action from the Holdings page. Fetched prices are persisted to `asset.latestPrice` in the database so all pages benefit.

## Out of Scope

- Scheduled/automatic price refresh
- TradingView integration
- Crypto price feeds
- Historical price storage

---

## Architecture

### 1. `src/lib/services/market-price.service.ts` (new)

Two exported functions:

**`fetchYahooPrices(symbols: string[]): Promise<Record<string, number>>`**
- Normalizes symbols: strips broker prefixes (`US.NIO` → `NIO`, `HK.700` → `0700.HK`)
- Batch fetches via `https://query1.finance.yahoo.com/v7/finance/quote?symbols=A,B,C`
- Extracts `regularMarketPrice` from each quote result
- Fails silently per-symbol — unknown tickers return no entry in the map
- Returns `{ SYMBOL: price }` map for successfully fetched symbols only

**`refreshHoldingPrices(userId: string): Promise<{ updated: number; failed: number; skipped: number }>`**
- Queries all distinct asset symbols from user's active holdings (quantity > 0)
- Calls `fetchYahooPrices()` with those symbols
- For each symbol with a returned price: updates `asset.latestPrice` and `asset.updatedAt` via Prisma
- Returns count summary

### 2. `src/routes/holdings/+page.server.ts` (modify)

Add `actions.refreshPrices`:
- Calls `refreshHoldingPrices(userId)`
- Returns `{ refreshResult: { updated, failed, skipped, refreshedAt } }`
- No redirect — stays on page, Svelte form action handles the response

### 3. `src/routes/holdings/+page.svelte` (modify)

- Add "Refresh Prices" button in the page header actions area (alongside existing controls)
- Show inline result after action: "Updated 4 prices · 1 skipped · 0 failed"
- Button shows loading state while form submitting (use `$submitting` from `enhance`)

---

## Symbol Normalization

Yahoo Finance uses plain tickers. Moomoo prefixes symbols with market codes:

| Moomoo format | Yahoo format |
|---|---|
| `US.NIO` | `NIO` |
| `US.AAPL` | `AAPL` |
| `HK.700` | `0700.HK` |
| `SCHG` | `SCHG` (no change) |

Normalization logic in `market-price.service.ts` — strips `US.` prefix, converts `HK.` prefix to `.HK` suffix with zero-padding to 4 digits.

---

## Error Handling

- Yahoo Finance rate limit (429): catch, return failed count, do not throw
- Network timeout: 8-second fetch timeout per batch request
- Malformed response: skip symbols with missing `regularMarketPrice`
- All symbols fail: return `{ updated: 0, failed: N, skipped: 0 }` without error banner

---

## Data Flow

```
User clicks "Refresh Prices"
  → POST ?/refreshPrices
  → refreshHoldingPrices(userId)
      → get distinct symbols from holdings
      → normalize symbols
      → fetch https://query1.finance.yahoo.com/v7/finance/quote?symbols=...
      → for each price received: UPDATE asset SET latestPrice = X
  → return { updated, failed, skipped, refreshedAt }
  → Holdings page re-renders with updated prices from DB
```
