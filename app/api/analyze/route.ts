import { resolveWebsite } from '../../../lib/rss';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const resolved = await resolveWebsite(String(body.url || ''));
    return Response.json({
      sourceUrl: resolved.sourceUrl,
      title: resolved.title,
      official: resolved.feed ? { title: resolved.feed.title, rssUrl: resolved.feed.url, itemCount: resolved.feed.itemCount, latestItemDate: resolved.feed.latestItemDate, kind: resolved.feed.kind } : null,
      articles: resolved.articles.slice(0, 12),
      totalDetected: resolved.articles.length,
    });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法分析此網址' }, { status: 400 });
  }
}
