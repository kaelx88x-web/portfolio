// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { prisma } from '$lib/server/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: { enabled: true },
  // Tell Better Auth to use BetterAuthAccount instead of Account
  // (Account is our broker account model — it has required fields Better Auth can't fill)
  account: {
    modelName: 'betterAuthAccount',
  },
  plugins: [adminPlugin()],
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min cache
  },
});

export type AuthSession = typeof auth.$Infer.Session;
