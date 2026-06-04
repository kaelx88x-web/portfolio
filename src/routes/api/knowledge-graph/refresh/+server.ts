import { json } from '@sveltejs/kit';
import { runKnowledgeGraphPipeline } from '$lib/server/knowledge-graph/pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
  const force = url.searchParams.get('force') === 'true';
  try {
    const result = await runKnowledgeGraphPipeline(locals.user.id, { force });
    if (result.tickers === 0) {
      return json({ ...result, message: 'No positions found to map.' });
    }
    return json({ ...result, message: 'Knowledge graph updated. Reload to view.' });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Knowledge graph build failed' },
      { status: 502 }
    );
  }
};
