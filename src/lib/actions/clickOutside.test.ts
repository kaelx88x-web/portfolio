import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clickOutside } from './clickOutside';

function makeDiv(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function click(target: HTMLElement) {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('clickOutside action', () => {
  let node: HTMLDivElement;
  let outsideEl: HTMLDivElement;
  let excludeEl: HTMLDivElement;
  let handler: ReturnType<typeof vi.fn>;
  let cleanup: () => void;

  beforeEach(() => {
    node = makeDiv();
    outsideEl = makeDiv();
    excludeEl = makeDiv();
    handler = vi.fn();
    node.addEventListener('outclick', handler);
    const action = clickOutside(node, {});
    cleanup = action.destroy;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('fires outclick when clicking outside the node', () => {
    click(outsideEl);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire outclick when clicking inside the node', () => {
    click(node);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does NOT fire outclick when clicking on excluded element', () => {
    cleanup();
    const action = clickOutside(node, { exclude: excludeEl });
    cleanup = action.destroy;
    click(excludeEl);
    expect(handler).not.toHaveBeenCalled();
  });

  it('updates exclude target via update()', () => {
    cleanup(); // Remove the previous listener
    handler.mockClear(); // Clear any previous calls
    const action = clickOutside(node, {});
    action.update({ exclude: outsideEl });
    click(outsideEl);
    expect(handler).not.toHaveBeenCalled();
    action.destroy();
  });

  it('stops listening after destroy()', () => {
    cleanup();
    click(outsideEl);
    expect(handler).not.toHaveBeenCalled();
  });
});
