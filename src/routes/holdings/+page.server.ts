import { getDemoUser } from '$lib/server/demo-user';
import { getCashBalance, getHoldings } from '$lib/services/portfolio.service';

export async function load() {
  const user = await getDemoUser();
  const [holdings, cashBalance] = await Promise.all([getHoldings(user.id), getCashBalance(user.id)]);

  return { holdings, cashBalance };
}
