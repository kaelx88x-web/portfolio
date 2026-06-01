import { describe, it, expect } from 'vitest';
import { requiresBrokerGate, BROKER_ONBOARDING_PATHS } from './broker-gate';

const PUBLIC = ['/', '/login', '/register', '/api/auth'];

describe('requiresBrokerGate', () => {
  it('returns false for public paths', () => {
    expect(requiresBrokerGate('/', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/login', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/register', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/auth/session', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
  });

  it('returns false for broker onboarding paths', () => {
    expect(requiresBrokerGate('/onboarding/connect-broker', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/onboarding', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/health/service', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/health/opend', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/accounts', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/accounts/select', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
  });

  it('returns true for protected routes', () => {
    expect(requiresBrokerGate('/dashboard', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/paper-trading', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/analytics', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/holdings', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/api/ai/copilot', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
  });

  it('does not bypass similarly named routes', () => {
    expect(requiresBrokerGate('/login-extra', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/onboarding-extra', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/api/brokerage/accounts', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
  });
});
