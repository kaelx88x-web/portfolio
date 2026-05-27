// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';

const prisma = new PrismaClient();

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
  account: { modelName: 'betterAuthAccount' },
  plugins: [adminPlugin()],
});

async function main() {
  // Check if demo admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: 'demo@portfolio-ai.local' },
  });

  if (!existing) {
    // Create user via Better Auth so password is bcrypt-hashed
    const ctx = await auth.api.signUpEmail({
      body: {
        name: 'Demo Investor',
        email: 'demo@portfolio-ai.local',
        password: 'demo123456',
      },
    });
    const userId = ctx.user?.id;
    if (userId) {
      // Promote to admin
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'admin', emailVerified: true, onboardingCompleted: true },
      });
      // Create paper portfolio account
      const hasAccount = await prisma.account.findFirst({ where: { userId } });
      if (!hasAccount) {
        await prisma.account.create({
          data: {
            userId,
            name: 'Paper Portfolio',
            brokerName: 'paper',
            accountType: 'paper',
            currency: 'USD',
          },
        });
      }
      console.log('✅ Demo admin created: demo@portfolio-ai.local / demo123456');
    }
  } else {
    // Ensure existing demo user has admin role
    await prisma.user.update({
      where: { email: 'demo@portfolio-ai.local' },
      data: { role: 'admin', emailVerified: true, onboardingCompleted: true },
    });
    console.log('✅ Demo admin already exists — role updated to admin');
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
