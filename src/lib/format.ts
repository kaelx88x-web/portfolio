export function money(value: number, currency = 'USD') {
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  } catch {
    // Invalid ISO currency code → fall back to USD.
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  }
}

/**
 * Pick a single display currency for an aggregate (portfolio total, cards) from
 * a set of per-holding currency codes. Returns the shared code when all holdings
 * agree, otherwise the fallback (the account's base currency, or USD). This
 * avoids labelling an all-HKD portfolio total with a USD "$".
 */
export function uniformCurrency(
  currencies: (string | null | undefined)[],
  fallback = 'USD'
) {
  const set = new Set(
    currencies.filter((c): c is string => !!c).map((c) => c.toUpperCase())
  );
  return set.size === 1 ? [...set][0] : fallback || 'USD';
}

export function number(value: number, maximumFractionDigits = 4) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits
  }).format(value || 0);
}

export function percent(value: number) {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2
  }).format(value || 0)}%`;
}

export function date(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(new Date(value));
}
