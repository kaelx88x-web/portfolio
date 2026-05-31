export const BROKER_ONBOARDING_PATHS = [
  '/onboarding',
  '/api/broker/health',
  '/api/broker/accounts',
];

/**
 * Returns true if the request requires a connected broker to proceed.
 * Exempt: public auth paths and all broker-onboarding API paths so the
 * wizard can call health checks and account selection before setup is done.
 */
export function requiresBrokerGate(
  pathname: string,
  publicPaths: string[],
  onboardingPaths: string[],
): boolean {
  if (publicPaths.some((p) => pathname.startsWith(p))) return false;
  if (onboardingPaths.some((p) => pathname.startsWith(p))) return false;
  return true;
}
