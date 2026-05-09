import { prisma } from '$lib/server/db';

export async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: 'demo@portfolio-ai.local' },
    update: {},
    create: {
      name: 'Demo Investor',
      email: 'demo@portfolio-ai.local',
      passwordHash: 'local-demo-only',
      baseCurrency: 'USD'
    }
  });
}
