import type { User, Session } from 'better-auth';
import type { RecommendedStrategy } from '$lib/services/behavioral-profile.service';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      recommendedStrategy?: RecommendedStrategy;
    }
  }
}

export {};
