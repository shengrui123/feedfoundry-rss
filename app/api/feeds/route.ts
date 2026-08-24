import { listFeeds, saveFeed, saveNewFeedItems } from '../../../db';
import { assertPublicUrl, resolveWebsite } from '../../../lib/rss';

async function feedId(sourceUrl: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceUrl));
  return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const feeds = await listFeeds();
    return Response.json({ feeds: feeds.map((feed) => ({
      id: feed.id,
      title: feed.title,
      sourceUrl: feed.source_url,
      rssUrl: feed.feed_kind === 'generated' ? `${origin}/feeds/${feed.id}.xml` : feed.feed_url,
      kind: feed.feed_kind,
      itemCount: Number(feed.item_count),
    })) }, { headers: { 'cache-control': 'no-store' } });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法載入 RSS 列表' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sourceUrl?: unknown; title?: unknown; includeDescriptions?: unknown; excludeWords?: unknown };
    const source = assertPublicUrl(body.sourceUrl).href;
    const resolved = await resolveWebsite(source);
    if (resolved.feed) {
      const id = await feedId(`${resolved.feed.kind}:${resolved.sourceUrl}:${resolved.feed.url}`);
      await saveFeed({
        id,
        source_url: resolved.sourceUrl,
        title: resolved.feed.title,
        max_items: 0,
        include_descriptions: 1,
        exclude_words: '',
        feed_kind: resolved.feed.kind,
        feed_url: resolved.feed.url,
        item_count: resolved.feed.itemCount,
      });
      return Response.json({ title: resolved.feed.title, rssUrl: resolved.feed.url, sourceUrl: resolved.sourceUrl, kind: resolved.feed.kind, itemCount: resolved.feed.itemCount });
    }
    const articles = resolved.articles;
    if (!articles.length) throw new Error('來源頁面目前沒有可辨識的文章');
    const title = String(body.title || `${resolved.title} RSS`).trim().slice(0, 120);
    const excludeWords = String(body.excludeWords || '').trim().slice(0, 300);
    const id = await feedId(resolved.sourceUrl);
    await saveFeed({
      id,
      source_url: resolved.sourceUrl,
      title,
      max_items: 0,
      include_descriptions: body.includeDescriptions === false ? 0 : 1,
      exclude_words: excludeWords,
      feed_kind: 'generated',
      feed_url: '',
      item_count: articles.length,
    });
    await saveNewFeedItems(id, articles);
    const origin = new URL(request.url).origin;
    return Response.json({ title, rssUrl: `${origin}/feeds/${id}.xml`, sourceUrl: resolved.sourceUrl, kind: 'generated', itemCount: articles.length });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法建立 RSS' }, { status: 400 });
  }
}
