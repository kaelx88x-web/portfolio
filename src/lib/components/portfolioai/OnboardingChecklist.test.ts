import { describe, it, expect } from 'vitest';

// Pure function extracted from the component
function computeChecklist(params: {
  hasCash: boolean;
  hasBroker: boolean;
  onboardingCompleted: boolean;
}) {
  return [
    { id: 'account', label: 'Create account',    done: true },
    { id: 'cash',    label: 'Set cash balance',  done: params.hasCash },
    { id: 'broker',  label: 'Connect broker',    done: params.hasBroker, optional: true },
    { id: 'explore', label: 'Explore dashboard', done: params.onboardingCompleted },
  ];
}

describe('computeChecklist', () => {
  it('first item is always done', () => {
    const items = computeChecklist({ hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[0].done).toBe(true);
  });

  it('cash item done when cash is set', () => {
    const items = computeChecklist({ hasCash: true, hasBroker: false, onboardingCompleted: false });
    expect(items[1].done).toBe(true);
  });

  it('broker item is optional', () => {
    const items = computeChecklist({ hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[2].optional).toBe(true);
  });

  it('all done when all params true', () => {
    const items = computeChecklist({ hasCash: true, hasBroker: true, onboardingCompleted: true });
    expect(items.every(i => i.done)).toBe(true);
  });
});
