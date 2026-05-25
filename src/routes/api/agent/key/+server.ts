import { json } from '@sveltejs/kit';
import { getOrCreateAgentRegistration, rotateAgentKey } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const user = await getDemoUser();
	const reg = await getOrCreateAgentRegistration(user.id);
	return json({
		api_key: reg.apiKey,
		label: reg.label,
		status: reg.status,
		last_seen_at: reg.lastSeenAt,
		last_push_at: reg.lastPushAt,
		created_at: reg.createdAt,
	});
};

export const POST: RequestHandler = async () => {
	const user = await getDemoUser();
	const reg = await rotateAgentKey(user.id);
	return json({
		api_key: reg.apiKey,
		label: reg.label,
		status: reg.status,
		last_seen_at: reg.lastSeenAt,
		last_push_at: reg.lastPushAt,
		rotated_at: new Date().toISOString(),
	});
};
