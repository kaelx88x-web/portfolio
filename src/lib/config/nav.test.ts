import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, getActiveSectionId } from './nav';

describe('NAV_SECTIONS', () => {
  it('has 9 sections', () => {
    expect(NAV_SECTIONS).toHaveLength(9);
  });

  it('dashboard has no children', () => {
    const d = NAV_SECTIONS.find(s => s.id === 'dashboard')!;
    expect(d.children).toBeUndefined();
    expect(d.href).toBe('/dashboard');
  });

  it('ai section has green colour', () => {
    const ai = NAV_SECTIONS.find(s => s.id === 'ai')!;
    expect(ai.color).toBe('#3fb950');
  });

  it('all sections with children have at least 2 sub-pages', () => {
    for (const s of NAV_SECTIONS) {
      if (s.children) expect(s.children.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('getActiveSectionId', () => {
  it('matches dashboard exact path', () => {
    expect(getActiveSectionId('/dashboard')).toBe('dashboard');
  });

  it('matches root / to dashboard', () => {
    expect(getActiveSectionId('/')).toBe('dashboard');
  });

  it('matches ai sub-path via prefix', () => {
    expect(getActiveSectionId('/ai/copilot')).toBe('ai');
    expect(getActiveSectionId('/ai/memory')).toBe('ai');
  });

  it('matches portfolio root-level paths exactly', () => {
    expect(getActiveSectionId('/holdings')).toBe('portfolio');
    expect(getActiveSectionId('/transactions')).toBe('portfolio');
    expect(getActiveSectionId('/watchlist')).toBe('portfolio');
  });

  it('matches optimization prefix routes', () => {
    expect(getActiveSectionId('/optimization/rebalance')).toBe('optimize');
    expect(getActiveSectionId('/optimization/stress-test')).toBe('optimize');
  });

  it('matches trades mix of prefix and exact paths', () => {
    expect(getActiveSectionId('/trades')).toBe('trades');
    expect(getActiveSectionId('/trades/tickets')).toBe('trades');
    expect(getActiveSectionId('/orders')).toBe('trades');
    expect(getActiveSectionId('/paper-trading')).toBe('trades');
  });

  it('returns null for unknown paths', () => {
    expect(getActiveSectionId('/unknown')).toBeNull();
  });
});
