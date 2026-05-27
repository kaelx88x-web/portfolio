// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { prisma } from '$lib/server/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
  plugins: [adminPlugin()],
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min cache
  },
  databaseHooks: {
    user: {
      create: {
        // After successful registration: create paper portfolio account
        after: async (user) => {
          await prisma.account.create({
            data: {
              userId: user.id,
              name: 'Paper Portfolio',
              brokerName: 'paper',
              accountType: 'paper',
              currency: 'USD',
            },
          });
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
