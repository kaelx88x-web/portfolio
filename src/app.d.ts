import type { auth } from '$lib/server/auth';
import type { Session } from 'better-auth';
import type { RecommendedStrategy } from '$lib/services/behavioral-profile.service';

declare global {
  namespace App {
    interface Locals {
      user: typeof auth.$Infer.Session['user'] | null;
      session: Session | null;
      recommendedStrategy?: RecommendedStrategy;
    }
  }
}

export {};
