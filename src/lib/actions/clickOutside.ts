// src/lib/actions/clickOutside.ts
// Svelte action that fires a custom 'outclick' event when a click lands
// outside the node AND outside an optional exclude element.
// Uses capture phase to fire before other click handlers (prevents
// rail icon click from simultaneously triggering close + reopen).

export interface ClickOutsideOptions {
  exclude?: HTMLElement | null | undefined;
}

export function clickOutside(node: HTMLElement, options: ClickOutsideOptions = {}) {
  let currentOptions = options;

  function handleClick(event: MouseEvent) {
    const target = event.target as Node | null;
    if (!target) return;
    if (node.contains(target)) return;
    if (currentOptions.exclude && currentOptions.exclude.contains(target)) return;
    node.dispatchEvent(new CustomEvent('outclick'));
  }

  document.addEventListener('click', handleClick, true);

  return {
    update(newOptions: ClickOutsideOptions) {
      currentOptions = newOptions;
    },
    destroy() {
      document.removeEventListener('click', handleClick, true);
    },
  };
}
