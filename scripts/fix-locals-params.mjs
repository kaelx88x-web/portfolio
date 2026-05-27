#!/usr/bin/env node
/**
 * Adds `locals` to destructured handler params in route files that reference `locals.user`.
 *
 * Pattern A: `async () =>` (no destructure)         -> `async ({ locals }) =>`
 * Pattern B: `async ({ a, b }) =>` (destructure)    -> `async ({ a, b, locals }) =>` (only if `locals` missing)
 *
 * Only rewrites handler arrow funcs in files that contain `locals.user`. Skips arrow funcs
 * whose body (between matching braces) does not use `locals.user` — to avoid injecting locals
 * into callbacks like `.then((r) => ...)`.
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

let changedFiles = 0;
let injectedCount = 0;

for (const file of files) {
  const orig = fs.readFileSync(file, 'utf8');
  if (!/locals\.user/.test(orig)) continue;

  let content = orig;

  // Find every `async ( ... )` arrow opening followed by ` => ` and its body.
  // We use a manual scanner because nested braces matter.

  const out = [];
  let i = 0;
  while (i < content.length) {
    // Look for next "async (" occurrence.
    const idx = content.indexOf('async (', i);
    if (idx === -1) {
      out.push(content.slice(i));
      break;
    }
    out.push(content.slice(i, idx));
    // Parse the param list `(...)`.
    let p = idx + 'async '.length;
    if (content[p] !== '(') { // shouldn't happen
      out.push(content.slice(idx, p + 1));
      i = p + 1;
      continue;
    }
    let depth = 0;
    let q = p;
    for (; q < content.length; q++) {
      if (content[q] === '(') depth++;
      else if (content[q] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (q >= content.length) {
      out.push(content.slice(idx));
      break;
    }
    const paramsRaw = content.slice(p, q + 1); // includes ( and )
    // Now find arrow body. Skip whitespace then expect "=>"
    let r = q + 1;
    while (r < content.length && /\s/.test(content[r])) r++;
    if (content[r] !== '=' || content[r + 1] !== '>') {
      // Not an arrow function (might be a regular `async function`). Skip — handle below.
      out.push(content.slice(idx, q + 1));
      i = q + 1;
      continue;
    }
    // Find body extent: skip whitespace then expect { ... } or expression.
    let s = r + 2;
    while (s < content.length && /\s/.test(content[s])) s++;
    let bodyEnd;
    if (content[s] === '{') {
      // Match braces.
      let bd = 0;
      let t = s;
      for (; t < content.length; t++) {
        const ch = content[t];
        if (ch === '{') bd++;
        else if (ch === '}') {
          bd--;
          if (bd === 0) {
            bodyEnd = t;
            break;
          }
        }
      }
      if (bodyEnd === undefined) {
        out.push(content.slice(idx));
        break;
      }
    } else {
      // Expression body: find matching end (semicolon, comma at depth 0, or newline).
      // Simplest: take until next ;\n or end of statement. We just look for first ';' at depth 0.
      let bd = 0;
      let t = s;
      for (; t < content.length; t++) {
        const ch = content[t];
        if (ch === '(' || ch === '{' || ch === '[') bd++;
        else if (ch === ')' || ch === '}' || ch === ']') bd--;
        else if (ch === ';' && bd === 0) {
          bodyEnd = t;
          break;
        }
      }
      if (bodyEnd === undefined) bodyEnd = content.length - 1;
    }

    const body = content.slice(s, bodyEnd + 1);
    let newParams = paramsRaw;
    if (/\blocals\.user\b/.test(body)) {
      // Need locals in params.
      const inner = paramsRaw.slice(1, -1).trim(); // strip parens
      if (inner === '') {
        newParams = '({ locals })';
        injectedCount++;
      } else if (inner.startsWith('{') && inner.endsWith('}')) {
        // Destructured. Check if locals already there.
        const innerBody = inner.slice(1, -1);
        if (/\blocals\b/.test(innerBody)) {
          // already there
        } else {
          // Append `, locals` before the closing brace.
          const trimmed = innerBody.trim();
          // Handle trailing comma already.
          const sep = trimmed.endsWith(',') ? ' ' : ', ';
          newParams = '({ ' + trimmed + sep + 'locals })';
          // Use original spacing approximately.
          if (!innerBody.includes('\n')) {
            newParams = '({ ' + trimmed + sep + 'locals })';
          } else {
            // Multiline: keep style, add `,\n  locals` before final brace.
            // Build by replacing last } in original.
            const lastBrace = paramsRaw.lastIndexOf('}');
            const before = paramsRaw.slice(0, lastBrace);
            const after = paramsRaw.slice(lastBrace);
            // Remove trailing whitespace before adding.
            const trimmedBefore = before.replace(/\s+$/, '');
            const lastChar = trimmedBefore[trimmedBefore.length - 1];
            const insertSep = lastChar === ',' ? '\n  locals\n' : ',\n  locals\n';
            newParams = trimmedBefore + insertSep + after;
          }
          injectedCount++;
        }
      } else {
        // Single identifier like `event` — leave alone (the body would use event.locals, not locals).
      }
    }

    // Emit `async ` + newParams + content between q+1 and bodyEnd inclusive
    out.push('async ');
    out.push(newParams);
    out.push(content.slice(q + 1, bodyEnd + 1));
    i = bodyEnd + 1;
  }

  let newContent = out.join('');

  // Handle regular `async function load()` / `async function load({ ... })`.
  // (Dashboard uses `export async function load()`.)
  newContent = newContent.replace(
    /(\basync\s+function\s+[A-Za-z_$][\w$]*\s*)(\([^)]*\))/g,
    (full, prefix, params) => {
      // Find this function body and check for locals.user.
      const fnStart = newContent.indexOf(full);
      if (fnStart === -1) return full;
      const bodyStart = newContent.indexOf('{', fnStart + full.length);
      if (bodyStart === -1) return full;
      let bd = 0;
      let t = bodyStart;
      for (; t < newContent.length; t++) {
        const ch = newContent[t];
        if (ch === '{') bd++;
        else if (ch === '}') {
          bd--;
          if (bd === 0) break;
        }
      }
      const body = newContent.slice(bodyStart, t + 1);
      if (!/\blocals\.user\b/.test(body)) return full;
      const inner = params.slice(1, -1).trim();
      if (inner === '') return prefix + '({ locals })';
      if (inner.startsWith('{') && inner.endsWith('}')) {
        if (/\blocals\b/.test(inner)) return full;
        const innerBody = inner.slice(1, -1).trim();
        const sep = innerBody.endsWith(',') ? ' ' : ', ';
        return prefix + '({ ' + innerBody + sep + 'locals })';
      }
      return full;
    }
  );

  if (newContent !== orig) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
  }
}

console.log(`Updated ${changedFiles} files; injected locals in ${injectedCount} arrow handlers.`);
