#!/usr/bin/env node
/**
 * Task 8 migration script:
 * - Remove `import { getDemoUser } from '$lib/server/demo-user';`
 * - Replace `const user = await getDemoUser();` with locals.user / event.locals.user
 * - Add `locals` to destructured handler params if missing
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src/routes');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /[\\/](\+page\.server\.ts|\+server\.ts)$/.test(f));

let pageCount = 0;
let serverCount = 0;
const touched = [];

for (const file of files) {
  const orig = fs.readFileSync(file, 'utf8');
  if (!/getDemoUser/.test(orig)) continue;

  const isServer = file.endsWith('+server.ts');
  let content = orig;

  // 1. Remove the import line (handle both LF and CRLF).
  content = content.replace(
    /^\s*import\s*\{\s*getDemoUser\s*\}\s*from\s*['"]\$lib\/server\/demo-user['"];\s*\r?\n/gm,
    ''
  );

  // 2. Replace `const user = await getDemoUser();` with appropriate locals reference.
  // For +server.ts we use locals.user! (since handlers are typically destructured `({ url, ... })`).
  // For +page.server.ts we also use locals.user!.
  content = content.replace(
    /const\s+user\s*=\s*await\s+getDemoUser\(\);/g,
    'const user = locals.user!;'
  );

  // Also handle `const user = await getDemoUser()` without semicolon (rare but defensive).
  content = content.replace(
    /(?<!\;)\s*const\s+user\s*=\s*await\s+getDemoUser\(\)(?!\s*;)/g,
    (m) => m.replace(/await\s+getDemoUser\(\)/, 'locals.user!')
  );

  // 3. Ensure `locals` appears in each handler/load/action destructured param object that needs it.
  // We'll fix this in a follow-up pass; rely on tsc to flag missing `locals` instead of trying to
  // rewrite every arrow signature here (too risky for multi-line braces).

  if (content !== orig) {
    fs.writeFileSync(file, content, 'utf8');
    touched.push(file);
    if (isServer) serverCount++;
    else pageCount++;
  }
}

console.log(`Migrated ${touched.length} files (${pageCount} +page.server.ts, ${serverCount} +server.ts).`);
for (const f of touched) console.log('  - ' + path.relative('.', f));
