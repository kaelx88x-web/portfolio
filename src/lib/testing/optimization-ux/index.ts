/**
 * Optimization UX Testing Framework — public barrel.
 *
 * Ensures Optimization Engine recommendations are Understandable, Explainable,
 * Trustworthy, and Actionable. Pure + deterministic; consumed by Vitest unit
 * tests and Playwright UX specs. Retail readability (Test 5) reuses
 * `$lib/testing/ai-ux` (analyzeReadability). See README.md.
 */
export * from './types';
export * from './text-checks'; // Tests 1, 2, 3, 4, 7, 8, 10
export * from './guardrails'; // Test 6
export * from './trust'; // Test 9
export * from './report-card'; // Test 12
export { analyzeReadability } from '../ai-ux/readability'; // Test 5
