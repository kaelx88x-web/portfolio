import { describe, it, expect } from 'vitest';

// Pure function extracted from the component
function computeChecklist(params: {
  hasHoldings: boolean;
  hasCash: boolean;
  hasBroker: boolean;
  onboardingCompleted: boolean;
}) {
  return [
    { id: 'account', label: 'Create account', done: true },
    { id: 'stock', label: 'Add first stock', done: params.hasHoldings },
    { id: 'cash', label: 'Set cash balance', done: params.hasCash },
    { id: 'broker', label: 'Connect broker (optional)', done: params.hasBroker, optional: true },
    { id: 'explore', label: 'Explore dashboard', done: params.onboardingCompleted },
  ];
}

describe('computeChecklist', () => {
  it('first item is always done', () => {
    const items = computeChecklist({ hasHoldings: false, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[0].done).toBe(true);
  });

  it('stock item done when holdings exist', () => {
    const items = computeChecklist({ hasHoldings: true, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[1].done).toBe(true);
  });

  it('broker item optional', () => {
    const items = computeChecklist({ hasHoldings: false, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[3].optional).toBe(true);
  });

  it('all done when all params true', () => {
    const items = computeChecklist({ hasHoldings: true, hasCash: true, hasBroker: true, onboardingCompleted: true });
    expect(items.every(i => i.done)).toBe(true);
  });
});
