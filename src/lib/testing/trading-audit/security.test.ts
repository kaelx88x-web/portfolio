/**
 * Trading Audit — Section 14 (Security)
 *
 * Static guardrails that fail the build if a secret could reach the browser.
 * SvelteKit ships everything in a `.svelte` component (and any module it can
 * reach from client code) to the browser bundle, so:
 *
 *   • No `.svelte` file may read a private secret env var or import a private
 *     `$env` module.
 *   • No source file may hardcode a Bearer token / JWT / long secret literal.
 *   • No client code may log account numbers or tokens.
 *
 * Server-only service modules (which import `$lib/server/db` and are never
 * imported by client code) are allowed to read secrets from `process.env`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.svelte-kit') continue;
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const svelteFiles = walk(SRC, ['.svelte']);
const allSource = walk(SRC, ['.ts', '.svelte']).filter((f) => !f.endsWith('.test.ts'));

const PRIVATE_SECRET = /process\.env\.[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|PWD|API_KEY|PRIVATE|UNLOCK)/;
const PRIVATE_ENV_IMPORT = /\$env\/(static|dynamic)\/private/;

describe('[SECTION 14] no secret can reach the browser bundle', () => {
  it('no .svelte component reads a private secret from process.env', () => {
    const offenders = svelteFiles.filter((f) => PRIVATE_SECRET.test(readFileSync(f, 'utf8')));
    expect(offenders, `secret env read inside client components:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no .svelte component imports a private $env module', () => {
    const offenders = svelteFiles.filter((f) => PRIVATE_ENV_IMPORT.test(readFileSync(f, 'utf8')));
    expect(offenders, `private $env import inside client components:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('[SECTION 14] no hardcoded secrets in source', () => {
  // A JWT (three base64url segments) or a long hex/base64 blob assigned to a
  // token/secret-looking identifier.
  const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
  const HARDCODED_BEARER = /Bearer\s+[A-Za-z0-9_\-]{24,}/;

  it('no JWT literal is committed in source', () => {
    const offenders = allSource.filter((f) => JWT.test(readFileSync(f, 'utf8')));
    expect(offenders, `JWT literal found:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('no hardcoded Bearer token literal is committed in source', () => {
    const offenders = allSource.filter((f) => HARDCODED_BEARER.test(readFileSync(f, 'utf8')));
    expect(offenders, `hardcoded Bearer token found:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('[SECTION 14] client code does not log sensitive identifiers', () => {
  const LOG_SECRET = /console\.(log|debug|info|warn)\s*\([^)]*\b(token|secret|password|account_?number)\b/i;

  it('no .svelte component console-logs tokens / account numbers', () => {
    const offenders = svelteFiles.filter((f) => LOG_SECRET.test(readFileSync(f, 'utf8')));
    expect(offenders, `sensitive console log in client component:\n${offenders.join('\n')}`).toEqual([]);
  });
});

describe('[SECTION 14] secret-bearing services stay server-only', () => {
  it('any module reading a secret env also imports a server-only dependency', () => {
    // If a module reads process.env secrets it must be unreachable from client
    // code. Our convention: such modules import `$lib/server/*` (e.g. the db),
    // which Vite refuses to bundle for the browser.
    const secretModules = allSource
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.svelte'))
      .filter((f) => PRIVATE_SECRET.test(readFileSync(f, 'utf8')));

    const leaky = secretModules.filter((f) => {
      const src = readFileSync(f, 'utf8');
      const serverOnly =
        /\$lib\/server\//.test(src) ||
        /\$env\/(static|dynamic)\/private/.test(src) ||
        // Importing a Node builtin makes the module impossible to bundle for the
        // browser — Vite errors rather than shipping it to the client.
        /from\s+['"]node:/.test(src) ||
        f.endsWith('.server.ts') ||
        f.includes(join('routes', 'api')) ||
        f.includes(`${'server'}`);
      return !serverOnly;
    });

    expect(leaky, `secret-reading modules not provably server-only:\n${leaky.join('\n')}`).toEqual([]);
  });
});
