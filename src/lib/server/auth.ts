// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { prisma } from '$lib/server/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
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
          try {
            await prisma.account.create({
              data: {
                userId: user.id,
                name: 'Paper Portfolio',
                brokerName: 'paper',
                accountType: 'paper',
                currency: 'USD',
              },
            });
          } catch (err) {
            // Non-fatal: dashboard load will create the paper account if missing
            console.error('[auth] Failed to create paper account for user', user.id, err);
          }
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
