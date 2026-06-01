export function buildAccountName(trd_env: string, acc_id: string): string {
  return trd_env === 'REAL' ? `Live Account (${acc_id})` : `Simulate Account (${acc_id})`;
}

export function buildAccountType(trd_env: string): string {
  return trd_env === 'REAL' ? 'live' : 'paper';
}
