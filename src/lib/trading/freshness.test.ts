import { describe, it, expect } from 'vitest';
import { assessQuoteFreshness } from './freshness';

describe('assessQuoteFreshness', () => {
  it('fresh when <= 60s', () => {
    expect(assessQuoteFreshness(0)).toBe('fresh');
    expect(assessQuoteFreshness(60_000)).toBe('fresh');
  });
  it('warns between 60s and 5min', () => {
    expect(assessQuoteFreshness(60_001)).toBe('warn');
    expect(assessQuoteFreshness(5 * 60_000)).toBe('warn');
  });
  it('blocks beyond 5min', () => {
    expect(assessQuoteFreshness(5 * 60_000 + 1)).toBe('block');
  });
  it('blocks when age is null/unknown', () => {
    expect(assessQuoteFreshness(null)).toBe('block');
  });
});
