import { describe, it, expect } from 'vitest';
import { computeReadiness, verdictFor, formatReadinessReport } from './readiness';

describe('Section 10 — verdictFor', () => {
  it('maps score bands to verdicts', () => {
    expect(verdictFor(85)).toBe('Production Ready');
    expect(verdictFor(70)).toBe('Beta Ready');
    expect(verdictFor(40)).toBe('Not Ready');
  });
});

describe('Section 10 — computeReadiness', () => {
  it('produces a production-ready verdict when all pillars are strong', () => {
    const r = computeReadiness({
      dataIntegrity: 100,
      aiAccuracy: 90,
      uxReadability: 85,
      trustworthiness: 95,
      performance: 88,
    });
    expect(r.overall).toBeGreaterThanOrEqual(80);
    expect(r.verdict).toBe('Production Ready');
    expect(r.badge).toContain('✅');
  });

  it('weights data integrity heavily — fabrication tanks the verdict', () => {
    const r = computeReadiness({
      dataIntegrity: 10,
      aiAccuracy: 90,
      uxReadability: 90,
      trustworthiness: 40,
      performance: 90,
    });
    expect(r.verdict).not.toBe('Production Ready');
  });

  it('clamps out-of-range inputs', () => {
    const r = computeReadiness({
      dataIntegrity: 150,
      aiAccuracy: -20,
      uxReadability: 80,
      trustworthiness: 80,
      performance: 80,
    });
    expect(r.dataIntegrity).toBe(100);
    expect(r.aiAccuracy).toBe(0);
  });

  it('formats a human-readable scorecard', () => {
    const report = formatReadinessReport(
      computeReadiness({ dataIntegrity: 100, aiAccuracy: 90, uxReadability: 85, trustworthiness: 95, performance: 88 }),
    );
    expect(report).toContain('PRODUCTION READINESS SCORE');
    expect(report).toContain('Overall:');
    expect(report).toContain('Verdict:');
  });
});
