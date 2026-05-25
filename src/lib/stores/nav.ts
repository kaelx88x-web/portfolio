// src/lib/stores/nav.ts
import { writable } from 'svelte/store';

/** ID of the section whose fly-out is pinned open (persists during navigation within section). */
export const pinnedSection = writable<string | null>(null);

/** ID of the section currently being hovered on the rail (not pinned). */
export const hoveredSection = writable<string | null>(null);

/** True while the mouse is inside the fly-out panel (used to cancel close timer in Sidebar). */
export const flyoutActive = writable<boolean>(false);
