export type PnlTransaction = {
  type: string;
  quantity: number;
  price: number;
  fee: number;
};

/**
 * Compute realized P&L for a single asset using the average cost method.
 * Processes transactions in chronological order (caller must pre-sort).
 */
export function calcRealizedPnl(transactions: PnlTransaction[]): number {
  let avgCost = 0;
  let qty = 0;
  let realizedPnl = 0;

  for (const tx of transactions) {
    if (tx.type === 'buy') {
      const totalCostBefore = avgCost * qty;
      const newCost = tx.quantity * tx.price + tx.fee;
      qty += tx.quantity;
      avgCost = qty > 0 ? (totalCostBefore + newCost) / qty : 0;
    } else if (tx.type === 'sell') {
      const proceeds = tx.quantity * tx.price - tx.fee;
      const costOfSold = avgCost * tx.quantity;
      realizedPnl += proceeds - costOfSold;
      qty -= tx.quantity;
      if (qty <= 0) { qty = 0; avgCost = 0; }
    }
  }

  return realizedPnl;
}

/**
 * Compute total net capital invested (deposits minus withdrawals) and
 * total realized P&L across all transaction history for a user.
 */
export function calcCapitalAndRealized(
  transactions: { type: string; quantity: number; price: number; fee: number; assetId: string | null }[]
): { netInvested: number; realizedPnl: number; dividends: number } {
  let netInvested = 0;
  let dividends = 0;

  // Group buy/sell transactions by asset for realized P&L
  const byAsset = new Map<string, PnlTransaction[]>();
  for (const tx of transactions) {
    if (tx.type === 'deposit')    { netInvested += tx.price; continue; }
    if (tx.type === 'withdrawal') { netInvested -= tx.price + tx.fee; continue; }
    if (tx.type === 'dividend')   { dividends += tx.quantity * tx.price - tx.fee; continue; }
    if ((tx.type === 'buy' || tx.type === 'sell') && tx.assetId) {
      const list = byAsset.get(tx.assetId) ?? [];
      list.push(tx);
      byAsset.set(tx.assetId, list);
    }
  }

  let realizedPnl = 0;
  for (const txs of byAsset.values()) {
    realizedPnl += calcRealizedPnl(txs);
  }

  return { netInvested, realizedPnl, dividends };
}
