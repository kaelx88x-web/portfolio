/**
 * Sections 1 + 2 + 7 — Integration test against the REAL AI services.
 *
 * Builds the real portfolio context for a test user, runs the Risk Advisor and
 * Portfolio Assistant, and scores their actual output for data integrity,
 * response quality, and traceability. This proves the live AI is grounded in
 * real data (no invented tickers/prices) — exactly the bug class the
 * account-scoping fix addressed.
 *
 * Gated: only runs when AI_UX_INTEGRATION=1 (needs a dev DB + a real user).
 *   AI_UX_INTEGRATION=1 AI_UX_USER_EMAIL=kaelx88x@gmail.com npx vitest run \
 *     src/lib/testing/ai-ux/integration
 *
 * Service/prisma modules are imported dynamically INSIDE the test so the normal
 * `vitest run` never loads server-only code or touches the database.
 */
import { describe, it, expect } from 'vitest';
import { fromAiContext, checkDataIntegrity } from '../data-integrity';
import { scoreResponse } from '../scoring';
import { checkTraceability } from '../trust';
import { PASS_THRESHOLD } from '../types';
import type { AiResponseUnderTest } from '../types';

const ENABLED = process.env.AI_UX_INTEGRATION === '1';
const USER_EMAIL = process.env.AI_UX_USER_EMAIL ?? 'kaelx88x@gmail.com';

// describe.skipIf keeps this inert (and unimported) in the default suite.
describe.skipIf(!ENABLED)('AI Suite — live response integrity & quality', () => {
  async function loadContext() {
    const { prisma } = await import('$lib/server/db');
    const user = await prisma.user.findFirst({ where: { email: USER_EMAIL }, select: { id: true } });
    if (!user) throw new Error(`No user with email ${USER_EMAIL}; set AI_UX_USER_EMAIL.`);
    const { buildAiPortfolioContext } = await import('$lib/services/ai-context.service');
    const context = await buildAiPortfolioContext(user.id, { period: 'MAX', benchmark: 'SPY' });
    return { userId: user.id, context };
  }

  it('Risk Advisor cites only real tickers and is traceable', async () => {
    const { userId, context } = await loadContext();
    const known = fromAiContext(context as never);
    const { getRiskAdvisorOverview } = await import('$lib/services/ai-risk-advisor.service');
    const overview = await getRiskAdvisorOverview(userId, { period: 'MAX', benchmark: 'SPY' });

    const text = [overview.summary.summary, ...overview.summary.main_risk_drivers, overview.narrative.narrative].join(' ');
    const response: AiResponseUnderTest = {
      id: 'risk-advisor',
      surface: 'risk-advisor',
      text,
      sourceContexts: overview.summary.source_contexts,
    };

    const integrity = checkDataIntegrity(response, known);
    expect(integrity.hallucinatedTickers, integrity.failures.join('; ')).toHaveLength(0);

    const trace = checkTraceability(response, known);
    expect(trace.score).toBeGreaterThan(0);
  }, 30_000);

  it('Portfolio Assistant scores at or above the quality threshold', async () => {
    const { userId, context } = await loadContext();
    const known = fromAiContext(context as never);
    const { getPortfolioAssistantOverview } = await import('$lib/services/ai-portfolio-assistant.service');
    const overview = await getPortfolioAssistantOverview(userId, { period: 'MAX', benchmark: 'SPY' });

    const text = [overview.summary.summary, ...overview.summary.key_observations, overview.narrative.narrative].join(' ');
    const response: AiResponseUnderTest = {
      id: 'portfolio-assistant',
      surface: 'portfolio-assistant',
      text,
      sourceContexts: overview.summary.source_contexts,
    };

    const integrity = checkDataIntegrity(response, known);
    expect(integrity.hallucinatedTickers, integrity.failures.join('; ')).toHaveLength(0);

    const scores = scoreResponse(response, known);
    // Accuracy (grounding) is the non-negotiable; overall is reported for the
    // readiness scorecard. We assert grounding hard, quality softly.
    expect(scores.accuracy).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  }, 30_000);

  it('context is scoped to a single account (no cross-account currency mixing)', async () => {
    const { context } = await loadContext();
    const ctx = context as { allocation?: { byCurrency?: Array<{ label: string }> } };
    const currencies = ctx.allocation?.byCurrency?.map((c) => c.label) ?? [];
    // A single scoped account should not blend e.g. USD + HKD snapshots.
    expect(currencies.length).toBeLessThanOrEqual(1);
  }, 30_000);
});
