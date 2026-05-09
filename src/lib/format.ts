export function money(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value || 0);
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
