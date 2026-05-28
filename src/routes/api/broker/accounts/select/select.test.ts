import { describe, it, expect } from 'vitest';
import { buildAccountName, buildAccountType } from './+server.js';

describe('account helpers', () => {
  it('builds REAL account name', () => {
    expect(buildAccountName('REAL', '4652657')).toBe('Live Account (4652657)');
  });
  it('builds SIMULATE account name', () => {
    expect(buildAccountName('SIMULATE', '4652658')).toBe('Simulate Account (4652658)');
  });
  it('maps REAL to live type', () => {
    expect(buildAccountType('REAL')).toBe('live');
  });
  it('maps SIMULATE to paper type', () => {
    expect(buildAccountType('SIMULATE')).toBe('paper');
  });
});
