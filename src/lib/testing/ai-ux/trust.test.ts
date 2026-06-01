import { describe, it, expect } from 'vitest';
import { checkTraceability } from './trust';
import { KNOWN, GOOD_RESPONSE_TEXT } from './fixtures';
import type { AiResponseUnderTest } from './types';

describe('Section 7 — checkTraceability (structured)', () => {
  it('passes a fully traceable recommendation grounded in known data', () => {
    const response: AiResponseUnderTest = {
      id: 'r',
      surface: 'risk-advisor',
      text: 'Roll the NIO covered call.',
      recommendations: [
        {
          recommendation: 'Roll NIO Covered Call',
          reason: 'Current price near strike',
          data: ['NIO = $5.44', 'Strike = $5.50', 'DTE = 3'],
          source: 'Broker Position Data',
        },
      ],
    };
    const r = checkTraceability(response, KNOWN);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.traces[0].traceable).toBe(true);
  });

  it('fails a recommendation missing its source', () => {
    const response: AiResponseUnderTest = {
      id: 'r',
      surface: 'risk-advisor',
      text: 'Roll the call.',
      recommendations: [
        { recommendation: 'Roll NIO Covered Call', reason: 'Near strike', data: ['NIO = $5.44'], source: '' },
      ],
    };
    const r = checkTraceability(response, KNOWN);
    expect(r.passed).toBe(false);
    expect(r.traces[0].hasSource).toBe(false);
  });

  it('fails when cited data is not grounded in known portfolio data', () => {
    const response: AiResponseUnderTest = {
      id: 'r',
      surface: 'risk-advisor',
      text: 'Buy more.',
      recommendations: [
        { recommendation: 'Buy TSLA', reason: 'Momentum', data: ['TSLA = $999.00'], source: 'Broker Position Data' },
      ],
    };
    const r = checkTraceability(response, KNOWN);
    expect(r.passed).toBe(false);
    expect(r.traces[0].dataGroundedInKnown).toBe(false);
  });
});

describe('Section 7 — checkTraceability (free-text)', () => {
  it('passes free text that has reason + data + source markers', () => {
    const response: AiResponseUnderTest = {
      id: 'f',
      surface: 'copilot',
      text: GOOD_RESPONSE_TEXT + ' Source: broker position data.',
      sourceContexts: ['portfolio:abc123'],
    };
    const r = checkTraceability(response, KNOWN);
    expect(r.passed).toBe(true);
  });

  it('fails free text with no reasoning or source', () => {
    const r = checkTraceability({ id: 'f', surface: 'copilot', text: 'Looks fine.' }, KNOWN);
    expect(r.passed).toBe(false);
  });
});
