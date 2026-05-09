import { getDemoUser } from '$lib/server/demo-user';
import { getDashboard } from '$lib/services/portfolio.service';

export async function load() {
  const user = await getDemoUser();
  const dashboard = await getDashboard(user.id);

  return { user, ...dashboard };
}
