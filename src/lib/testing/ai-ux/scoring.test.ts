import { describe, it, expect } from 'vitest';
import { scoreResponse, scoreExplainability, scoreActionability } from './scoring';
import { KNOWN, GOOD_RESPONSE_TEXT, HALLUCINATED_RESPONSE_TEXT } from './fixtures';
import { PASS_THRESHOLD } from './types';
import type { AiResponseUnderTest } from './types';

const goodResponse: AiResponseUnderTest = {
  id: 'good',
  surface: 'risk-advisor',
  text: GOOD_RESPONSE_TEXT,
  sourceContexts: ['portfolio:abc123'],
  recommendations: [
    {
      recommendation: 'Roll NIO Covered Call',
      reason: 'Current price near strike',
      data: ['NIO = $5.44', 'Strike = $5.50', 'DTE = 3'],
      source: 'Broker Position Data',
    },
  ],
};

describe('Section 2 — scoreExplainability / scoreActionability', () => {
  it('rewards reasoning markers and figures', () => {
    expect(scoreExplainability(goodResponse)).toBeGreaterThanOrEqual(80);
  });

  it('rewards an action verb plus a timeframe', () => {
    expect(scoreActionability(goodResponse)).toBeGreaterThanOrEqual(80);
  });
});

describe('Section 2 — scoreResponse', () => {
  it('a grounded, clear, traceable response passes the 80 threshold', () => {
    const s = scoreResponse(goodResponse, KNOWN);
    expect(s.accuracy).toBe(100);
    expect(s.overall).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(s.passed).toBe(true);
  });

  it('a hallucinated response fails', () => {
    const s = scoreResponse({ id: 'bad', surface: 'risk-advisor', text: HALLUCINATED_RESPONSE_TEXT }, KNOWN);
    expect(s.accuracy).toBeLessThan(50);
    expect(s.passed).toBe(false);
  });

  it('reports all five scores in 0–100', () => {
    const s = scoreResponse(goodResponse, KNOWN);
    for (const key of ['accuracy', 'explainability', 'clarity', 'trust', 'actionability'] as const) {
      expect(s[key]).toBeGreaterThanOrEqual(0);
      expect(s[key]).toBeLessThanOrEqual(100);
    }
  });
});
