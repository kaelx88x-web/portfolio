export type CostTransaction = {
  type: string;
  quantity: number;
  price: number;
  fee: number;
};

export function calculateCurrentQuantity(transactions: CostTransaction[]) {
  return transactions.reduce((quantity, transaction) => {
    if (transaction.type === 'buy') return quantity + transaction.quantity;
    if (transaction.type === 'sell') return quantity - transaction.quantity;
    return quantity;
  }, 0);
}

export function calculateAverageCost(transactions: CostTransaction[]) {
  const buyTotals = transactions.reduce(
    (totals, transaction) => {
      if (transaction.type !== 'buy') return totals;

      return {
        quantity: totals.quantity + transaction.quantity,
        cost: totals.cost + transaction.quantity * transaction.price + transaction.fee
      };
    },
    { quantity: 0, cost: 0 }
  );

  return buyTotals.quantity > 0 ? buyTotals.cost / buyTotals.quantity : 0;
}
