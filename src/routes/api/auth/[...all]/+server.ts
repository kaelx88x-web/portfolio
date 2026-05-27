// src/routes/api/auth/[...all]/+server.ts
import { auth } from '$lib/server/auth';
import type { RequestEvent } from '@sveltejs/kit';

export const GET = ({ request }: RequestEvent) => auth.handler(request);
export const POST = ({ request }: RequestEvent) => auth.handler(request);
