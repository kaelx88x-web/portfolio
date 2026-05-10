# PortfolioAI Multi-Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-state dark/light toggle with a six-theme system (Midnight, Aurora, Ember, Forest, Arctic, Rose) driven by a CSS class on `<html>`, persisted to `localStorage`, and switched via a new `ThemeDropdown` component in the app header.

**Architecture:** Each theme is a CSS class selector (`.theme-midnight`, etc.) in `src/index.css` that defines 8 CSS custom properties. A `ThemeDropdown` component in `src/components/ThemeDropdown.tsx` exports the `Theme` type and `isLightTheme` helper used by `App.tsx` to apply the class, persist to localStorage, and pass the correct dark/light value to TradingView charts.

**Tech Stack:** React 19, Vite 6, Tailwind CSS v4, TypeScript, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/index.css` | Modify | Replace 2 theme variable blocks with 6; fix `btn-primary` glow |
| `src/components/ThemeDropdown.tsx` | Create | Dropdown component; exports `Theme` type and `isLightTheme` |
| `src/App.tsx` | Modify | Update type/state/effect; wire dropdown; update TradingView checks |

> **Note:** This project has no test framework configured. TDD steps are replaced with dev-server visual verification.

---

## Task 1: Update `src/index.css` — 6 theme variable blocks

**Files:**
- Modify: `doc/portfolioai/src/index.css`

- [ ] **Step 1: Replace the `:root` and `:root.light` blocks with 6 theme classes**

Open `doc/portfolioai/src/index.css`. The file currently has two blocks starting at lines 17 and 29. Delete both blocks entirely and replace them with the following six blocks. Everything else in the file (the `@import`, `@theme`, `@layer base`, `.glass`, `.glass-card`, `.btn-primary`, etc.) stays untouched.

```css
.theme-midnight {
  --brand-color: #00f2fe;
  --bg-color: #0a0b14;
  --surface-color: #111420;
  --surface-color-light: #1c2131;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: rgba(255, 255, 255, 0.07);
  --glass-bg: rgba(17, 20, 32, 0.7);
}

.theme-aurora {
  --brand-color: #a855f7;
  --bg-color: #0d0a1e;
  --surface-color: #150e2e;
  --surface-color-light: #1f1545;
  --text-primary: #f1f5f9;
  --text-secondary: #c4b5fd;
  --border-color: rgba(168, 85, 247, 0.12);
  --glass-bg: rgba(21, 14, 46, 0.7);
}

.theme-ember {
  --brand-color: #f97316;
  --bg-color: #150b05;
  --surface-color: #1e1008;
  --surface-color-light: #2d1810;
  --text-primary: #f1f5f9;
  --text-secondary: #fdba74;
  --border-color: rgba(249, 115, 22, 0.12);
  --glass-bg: rgba(30, 16, 8, 0.7);
}

.theme-forest {
  --brand-color: #84cc16;
  --bg-color: #050f08;
  --surface-color: #0a1a0e;
  --surface-color-light: #122518;
  --text-primary: #f1f5f9;
  --text-secondary: #bef264;
  --border-color: rgba(132, 204, 22, 0.12);
  --glass-bg: rgba(10, 26, 14, 0.7);
}

.theme-arctic {
  --brand-color: #0d9488;
  --bg-color: #f0f9ff;
  --surface-color: #ffffff;
  --surface-color-light: #e0f2fe;
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --border-color: rgba(15, 23, 42, 0.08);
  --glass-bg: rgba(255, 255, 255, 0.85);
}

.theme-rose {
  --brand-color: #e11d48;
  --bg-color: #fff1f2;
  --surface-color: #ffffff;
  --surface-color-light: #ffe4e6;
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --border-color: rgba(225, 29, 72, 0.10);
  --glass-bg: rgba(255, 255, 255, 0.85);
}
```

- [ ] **Step 2: Fix the `btn-primary` glow so it follows the active accent**

Find the `.btn-primary` rule in `index.css`. It currently has:

```css
box-shadow: 0 10px 15px -3px rgba(0, 242, 254, 0.2);
```

Replace that one line with:

```css
box-shadow: 0 10px 15px -3px color-mix(in srgb, var(--brand-color) 20%, transparent);
```

- [ ] **Step 3: Commit**

```bash
cd doc/portfolioai
git add src/index.css
git commit -m "feat: add 6 theme CSS variable blocks to index.css"
```

---

## Task 2: Create `src/components/ThemeDropdown.tsx`

**Files:**
- Create: `doc/portfolioai/src/components/ThemeDropdown.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export type Theme = 'midnight' | 'aurora' | 'ember' | 'forest' | 'arctic' | 'rose';

export const LIGHT_THEMES: Theme[] = ['arctic', 'rose'];

export function isLightTheme(t: Theme): boolean {
  return LIGHT_THEMES.includes(t);
}

const THEMES: { id: Theme; name: string; accent: string; type: 'dark' | 'light' }[] = [
  { id: 'midnight', name: 'Midnight', accent: '#00f2fe', type: 'dark' },
  { id: 'aurora',   name: 'Aurora',   accent: '#a855f7', type: 'dark' },
  { id: 'ember',    name: 'Ember',    accent: '#f97316', type: 'dark' },
  { id: 'forest',   name: 'Forest',   accent: '#84cc16', type: 'dark' },
  { id: 'arctic',   name: 'Arctic',   accent: '#0d9488', type: 'light' },
  { id: 'rose',     name: 'Rose',     accent: '#e11d48', type: 'light' },
];

const DARK_THEMES = THEMES.filter(t => t.type === 'dark');
const LIGHT_THEME_LIST = THEMES.filter(t => t.type === 'light');

export function ThemeDropdown({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find(t => t.id === theme)!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-[var(--border-color)] rounded-xl px-2.5 py-1.5 text-main text-sm font-semibold transition-all"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: current.accent }}
        />
        {current.name}
        <ChevronDown
          size={13}
          className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-surface-navy-light border border-[var(--border-color)] rounded-xl shadow-2xl z-[100] overflow-hidden py-1.5">
          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted/60">Dark</p>
          {DARK_THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-main hover:bg-white/5 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.accent }} />
              {t.name}
              {theme === t.id && (
                <span className="ml-auto text-xs" style={{ color: t.accent }}>✓</span>
              )}
            </button>
          ))}

          <div className="my-1.5 border-t border-[var(--border-color)]" />

          <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted/60">Light</p>
          {LIGHT_THEME_LIST.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-semibold text-main hover:bg-white/5 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.accent }} />
              {t.name}
              {theme === t.id && (
                <span className="ml-auto text-xs" style={{ color: t.accent }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd doc/portfolioai
git add src/components/ThemeDropdown.tsx
git commit -m "feat: add ThemeDropdown component with 6 theme definitions"
```

---

## Task 3: Update `src/App.tsx`

**Files:**
- Modify: `doc/portfolioai/src/App.tsx`

All changes are in `App.tsx`. Make them in the order below to avoid merge confusion.

- [ ] **Step 1: Update imports at the top of the file**

Find the lucide-react import block (starts around line 1). Remove `Sun` and `Moon` from it — they're only used in the button being replaced. Then add the ThemeDropdown imports directly below the lucide-react block:

```ts
import { ThemeDropdown, isLightTheme } from './components/ThemeDropdown';
import type { Theme } from './components/ThemeDropdown';
```

- [ ] **Step 2: Update `AppShell`'s prop types (line 144)**

Find:
```ts
const AppShell = ({ children, theme, setTheme }: { children: ReactNode, theme: string, setTheme: (t: any) => void }) => {
```

Replace with:
```ts
const AppShell = ({ children, theme, setTheme }: { children: ReactNode, theme: Theme, setTheme: (t: Theme) => void }) => {
```

- [ ] **Step 3: Replace the sun/moon toggle button with `ThemeDropdown` (lines 260–266)**

Find the button block:
```tsx
<button 
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  className="p-2 text-muted hover:text-main rounded-xl hover:bg-main/5 transition-all"
  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
>
  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
</button>
```

Replace with:
```tsx
<ThemeDropdown theme={theme} setTheme={setTheme} />
```

- [ ] **Step 4: Update the three TradingView theme checks**

There are three identical expressions `theme === 'dark' ? 'dark' : 'light'` in the file (lines ~551, ~1091, ~1172). Replace all three with:

```ts
isLightTheme(theme) ? 'light' : 'dark'
```

The three locations are:
- Inside `Dashboard` component: `<TradingViewChart theme={theme === 'dark' ? 'dark' : 'light'} />`
- Inside `ComparisonDashboard`: `theme={theme === 'dark' ? 'dark' : 'light'}`
- Inside `WatchlistPage`: `theme={theme === 'dark' ? 'dark' : 'light'}`

- [ ] **Step 5: Update the main `App` component (lines 1698–1707)**

Find:
```ts
export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);
```

Replace with:
```ts
const ALL_THEMES: Theme[] = ['midnight', 'aurora', 'ember', 'forest', 'arctic', 'rose'];

export default function App() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'midnight'
  );

  useEffect(() => {
    const root = document.documentElement;
    ALL_THEMES.forEach(t => root.classList.remove(`theme-${t}`));
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('theme', theme);
  }, [theme]);
```

- [ ] **Step 6: Commit**

```bash
cd doc/portfolioai
git add src/App.tsx
git commit -m "feat: wire ThemeDropdown into App, update theme state and effect"
```

---

## Task 4: Visual Verification

**Files:** none (read-only verification)

- [ ] **Step 1: Start the dev server**

```bash
cd doc/portfolioai
npm run dev
```

Open the URL printed to the terminal (typically `http://localhost:5173`).

- [ ] **Step 2: Verify each theme switches correctly**

Open the ThemeDropdown in the header. Click through all 6 themes. For each one, confirm:
- Page background, card surfaces, and text all change
- The accent color updates on buttons and highlights
- The dropdown button dot updates to the new accent color
- The checkmark appears on the active theme

- [ ] **Step 3: Verify light themes**

Switch to Arctic and Rose. Confirm:
- Text is dark (not white-on-white)
- Card surfaces are white/light
- The TradingView chart switches to its light skin

- [ ] **Step 4: Verify `localStorage` persistence**

Switch to Aurora. Hard-refresh the page (`Ctrl+Shift+R`). Confirm the page loads in Aurora, not Midnight.

Open DevTools → Application → Local Storage → confirm `theme: "aurora"` is present.

- [ ] **Step 5: Verify dropdown closes on outside click**

Open the dropdown. Click anywhere outside it. Confirm it closes without switching theme.

- [ ] **Step 6: Final commit (if any fixes were needed)**

If you made any fixes during verification, commit them:

```bash
cd doc/portfolioai
git add -p
git commit -m "fix: theme system visual corrections"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| 6 themes with correct hex values | Task 1, Step 1 |
| `btn-primary` glow follows accent | Task 1, Step 2 |
| `ThemeDropdown` component with dot + name + chevron | Task 2 |
| Dark/Light groups with divider | Task 2 |
| Active checkmark in accent color | Task 2 |
| Close on outside click | Task 2 |
| `Theme` type as union of 6 names | Task 2 (exported), Task 3 |
| Init from `localStorage` | Task 3, Step 5 |
| `useEffect` applies class, persists | Task 3, Step 5 |
| TradingView light check updated in 3 places | Task 3, Step 4 |
| Replaces sun/moon button | Task 3, Step 3 |
