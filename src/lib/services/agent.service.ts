// src/lib/services/agent.service.ts
// Manages agent API keys and push log storage/retrieval.
// All functions are server-only (call prisma directly).

import { randomBytes } from 'node:crypto';
import { prisma } from '$lib/server/db';

const DEFAULT_AGENT_LABEL = 'My PC';

/** Generate a cryptographically random agent API key. */
export function generateAgentKey(): string {
  return 'agent_' + randomBytes(24).toString('hex');
}

/**
 * Get or create an AgentRegistration for the user.
 * Returns the existing one if already registered.
 */
export async function getOrCreateAgentRegistration(userId: string) {
  return prisma.agentRegistration.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      apiKey: generateAgentKey(),
      label: DEFAULT_AGENT_LABEL,
      status: 'pending',
    },
  });
}

/**
 * Rotate the agent API key for a user.
 * Creates a new registration if one does not exist yet.
 * The old key is immediately invalidated.
 */
export async function rotateAgentKey(userId: string) {
  const apiKey = generateAgentKey();
  return prisma.agentRegistration.upsert({
    where: { userId },
    update: { apiKey },
    create: {
      userId,
      apiKey,
      label: DEFAULT_AGENT_LABEL,
      status: 'pending',
    },
  });
}

/**
 * Verify an API key from the Authorization header.
 * Returns the AgentRegistration or null if invalid.
 * NOTE: Callers should implement rate limiting to prevent brute-force attacks.
 */
export async function verifyAgentKey(
  authHeader: string | null
): Promise<{ id: string; userId: string; label: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith('agent_')) return null;

  const reg = await prisma.agentRegistration.findUnique({
    where: { apiKey: key },
    select: { id: true, userId: true, label: true },
  });
  return reg ?? null;
}

export type AgentPushPayload = {
  push_type: string;           // 'broker_status' | 'paper_dashboard' | 'full'
  agent_version?: string;
  status?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
  account_info?: Record<string, unknown> | null;
  positions?: unknown[];
  orders?: unknown[];
  deals?: unknown[];
  synced_at?: string;
};

/**
 * Store an agent push and update last_push_at / last_seen_at.
 */
export async function storeAgentPush(
  agentId: string,
  userId: string,
  payload: AgentPushPayload
): Promise<void> {
  const recordCount =
    (payload.positions?.length ?? 0) +
    (payload.orders?.length ?? 0) +
    (payload.deals?.length ?? 0);

  await prisma.$transaction([
    prisma.agentPushLog.create({
      data: {
        agentId,
        userId,
        pushType: payload.push_type ?? 'full',
        dataJson: JSON.stringify(payload),
        recordCount,
        agentVersion: payload.agent_version ?? '1.0.0',
      },
    }),
    prisma.agentRegistration.update({
      where: { id: agentId },
      data: {
        lastPushAt: new Date(),
        lastSeenAt: new Date(),
        status: 'active',
      },
    }),
  ]);
}

/**
 * Get the most recent agent push for a user.
 * Returns null if no push exists yet.
 */
export async function getLatestAgentPush(
  userId: string
): Promise<AgentPushPayload & { pushedAt: Date } | null> {
  const log = await prisma.agentPushLog.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!log) return null;

  try {
    return { ...JSON.parse(log.dataJson), pushedAt: log.createdAt };
  } catch (err) {
    console.error('[agent.service] Failed to parse dataJson for push log', log.id, err);
    return null;
  }
}

/**
 * Get agent registration status for a user (no key in result).
 */
export async function getAgentStatus(userId: string) {
  const reg = await prisma.agentRegistration.findUnique({
    where: { userId },
    select: {
      id: true,
      label: true,
      status: true,
      lastSeenAt: true,
      lastPushAt: true,
      createdAt: true,
    },
  });
  return reg;
}
