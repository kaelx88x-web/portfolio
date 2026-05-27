#!/usr/bin/env node
/**
 * Patch route files that call lib/server helpers with the old (no-userId) signature.
 *
 * For each known helper, inject `locals.user!.id` as the new first argument and ensure
 * `locals` is in the destructured handler params.
 *
 * Also fixes `const { ..., user } = await loadAnalyticsFromUrl(url)` → drops `user` from
 * the destructure (helper no longer returns user) — caller should use `locals.user` instead,
 * which we replace inline (`user.id` → `locals.user!.id`) on the same line and immediately
 * following lines until the next blank line.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src/routes');

// Helpers and where userId goes in the arg list (always at index 0).
const HELPERS = [
  'aiMemoryOverviewJson',
  'latestAiMemoryJson',
  'aiMemoryHistoryJson',
  'aiMemoryTimelineJson',
  'aiHistoricalInsightsJson',
  'refreshAiMemoryJson',
  'compressAiMemoryJson',
  'loadAiContextFromUrl',
  'aiContextJson',
  'loadAnalyticsFromUrl',
  'recalculateAnalyticsSnapshot',
  'loadPortfolioMetricsFromUrl',
  'refreshPortfolioMetricsFromUrl',
  'generatePromptJson',
  'compressPromptJson',
  'refreshPromptCacheJson',
  'loadRiskExposureFromUrl',
  'refreshRiskExposureFromUrl'
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /[\\/](\+page\.server\.ts|\+server\.ts)$/.test(f));

let touched = 0;

for (const file of files) {
  const orig = fs.readFileSync(file, 'utf8');
  // Detect whether file uses any of the helpers.
  if (!HELPERS.some((h) => new RegExp('\\b' + h + '\\s*\\(').test(orig))) continue;

  let content = orig;
  let modifiedSomething = false;

  // For each helper, insert `locals.user!.id` as first arg, IF the call doesn't already have
  // `locals.user` as a prefix.
  for (const h of HELPERS) {
    // Find calls `helperName(`. Match the args until matching `)`.
    const re = new RegExp('\\b' + h + '\\s*\\(', 'g');
    let m;
    const replacements = [];
    while ((m = re.exec(content))) {
      const start = m.index + m[0].length; // index right after `(`
      // Find matching `)`
      let depth = 1;
      let i = start;
      while (i < content.length && depth > 0) {
        const ch = content[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (depth === 0) break;
        i++;
      }
      if (i >= content.length) break;
      const argsRaw = content.slice(start, i); // string inside parens
      const trimmed = argsRaw.trim();
      // Skip if first arg already looks like a user id.
      if (/^locals\.user!?\.id\b/.test(trimmed) || /^event\.locals\.user!?\.id\b/.test(trimmed) || /^user\.id\b/.test(trimmed)) continue;
      const newArgs = trimmed.length === 0 ? 'locals.user!.id' : 'locals.user!.id, ' + argsRaw;
      replacements.push({ start, end: i, newArgs });
    }
    // Apply in reverse so indices stay valid.
    for (const r of replacements.reverse()) {
      content = content.slice(0, r.start) + r.newArgs + content.slice(r.end);
      modifiedSomething = true;
    }
  }

  // Strip `, user` or `user, ` from destructures of `await loadAnalyticsFromUrl(...)`,
  // `await loadPortfolioMetricsFromUrl(...)`, etc. (Helpers that previously returned user.)
  // Pattern: `const { ..., user } = await <helper>(...)`
  content = content.replace(
    /const\s*\{\s*([^}]*)\}\s*=\s*await\s+(loadAnalyticsFromUrl|loadPortfolioMetricsFromUrl|loadRiskExposureFromUrl|loadAiContextFromUrl)\s*\(/g,
    (full, inside, helper) => {
      // Remove `user` token from `inside`.
      const cleaned = inside
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s !== 'user')
        .join(', ');
      modifiedSomething = true;
      return `const { ${cleaned} } = await ${helper}(`;
    }
  );

  // Where the function body still references `user.id` (from the destructure we just modified),
  // replace `user.id` with `locals.user!.id`. We are conservative: only swap `user.id` (not other
  // members) and only within the same arrow/function block scope. To be safe, do it everywhere
  // — `user` is no longer destructured so any remaining `user.id` would be a TS error.
  if (modifiedSomething) {
    // But careful — files that DO declare `const user = locals.user!` use `user.id` legitimately.
    // We must only replace when there's no preceding `const user =` in the file (for the simple
    // helper-style files this is fine since they're one-liner expression bodies).
    if (!/\bconst\s+user\s*=/.test(content)) {
      content = content.replace(/\buser\.id\b/g, 'locals.user!.id');
      // And `user.` properties more broadly — only if no `const user =` declaration anywhere.
      content = content.replace(/\b(?<!locals\.)(?<!event\.locals\.)user\b(?!\.id)/g, (m, off, full) => {
        // Skip if part of identifier like `userId`, `userName`, etc.
        const before = full[off - 1];
        const after = full[off + m.length];
        if (before && /[A-Za-z0-9_$]/.test(before)) return m;
        if (after && /[A-Za-z0-9_$]/.test(after)) return m;
        return 'locals.user!';
      });
    }
  }

  // Inject `locals` into destructured params if missing & body uses locals.user.
  // We rely on the prior pass (fix-locals-params) but rerun a simple version here:
  if (modifiedSomething && /\blocals\.user\b/.test(content)) {
    // For each `async ({ ... }) =>` whose destructure lacks `locals`, add it.
    content = content.replace(/async\s*\(\s*\{([^}]*)\}\s*\)\s*=>/g, (full, inside) => {
      if (/\blocals\b/.test(inside)) return full;
      const trimmed = inside.trim();
      const sep = trimmed.endsWith(',') || trimmed === '' ? ' ' : ', ';
      return `async ({ ${trimmed === '' ? 'locals' : trimmed + sep + 'locals'} }) =>`;
    });
    // Also handle `async () =>` (empty params)
    content = content.replace(/async\s*\(\s*\)\s*=>/g, (full) => {
      // Only convert if locals.user is used in body — we already check at the outer if.
      return 'async ({ locals }) =>';
    });
  }

  if (content !== orig) {
    fs.writeFileSync(file, content, 'utf8');
    touched++;
  }
}

console.log(`Updated ${touched} files.`);
