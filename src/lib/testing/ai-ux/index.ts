/**
 * AI UX Testing Framework — public barrel.
 *
 * Verifies AI responses are Accurate, Explainable, Trustworthy, easy for retail
 * investors to understand, and grounded ONLY in real portfolio data. Pure +
 * deterministic; consumed by Vitest unit/integration tests and Playwright UX
 * specs. See README.md in this directory for the section map.
 */
export * from './types';
export * from './data-integrity'; // Section 1
export * from './scoring'; // Section 2
export * from './readability'; // Section 3
export * from './trust'; // Section 7
export * from './readiness'; // Section 10
