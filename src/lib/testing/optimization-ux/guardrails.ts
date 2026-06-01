/**
 * Optimization UX — Test 6: Hybrid portfolio cap.
 * The optimizer must never suggest options exposure above the configured cap.
 */
import type { OptionsCapResult } from './types';

/** `tolerance` absorbs display rounding (0.5pp by default). */
export function checkOptionsCap(suggestedPct: number, capPct: number, tolerance = 0.5): OptionsCapResult {
  const breachedBy = Math.max(0, suggestedPct - capPct - tolerance);
  const passed = breachedBy === 0;
  return {
    passed,
    score: passed ? 100 : 0,
    suggestedPct,
    capPct,
    breachedBy: Math.round(breachedBy * 100) / 100,
    failures: passed ? [] : [`Options suggestion ${suggestedPct}% exceeds cap ${capPct}% by ${breachedBy.toFixed(1)}pp`],
  };
}

/** Extracts "Configured Cap: 20%" and "AI Suggested: 28%" style figures from text. */
export function extractCapAndSuggestion(text: string): { capPct: number | null; suggestedPct: number | null } {
  const cap = text.match(/(?:configured\s+)?cap[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  const sug = text.match(/(?:ai\s+)?suggest(?:ed|ion)?[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  return {
    capPct: cap ? parseFloat(cap[1]) : null,
    suggestedPct: sug ? parseFloat(sug[1]) : null,
  };
}
