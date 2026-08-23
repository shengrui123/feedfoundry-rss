import { listFeeds, saveFeed, saveNewFeedItems } from '../../../db';
import { assertPublicUrl, extractArticles, findOfficialFeed, pageTitle, safeFetch } from '../../../lib/rss';

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
      rssUrl: `${origin}/feeds/${feed.id}.xml`,
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
    const page = await safeFetch(source);
    const official = await findOfficialFeed(page.text, page.url);
    if (official) return Response.json({ title: official.title, rssUrl: official.url, sourceUrl: page.url, kind: 'official', itemCount: official.itemCount });
    const articles = extractArticles(page.text, page.url);
    if (!articles.length) throw new Error('來源頁面目前沒有可辨識的文章');
    const title = String(body.title || `${pageTitle(page.text, page.url)} RSS`).trim().slice(0, 120);
    const excludeWords = String(body.excludeWords || '').trim().slice(0, 300);
    const id = await feedId(page.url);
    await saveFeed({ id, source_url: page.url, title, max_items: 0, include_descriptions: body.includeDescriptions === false ? 0 : 1, exclude_words: excludeWords });
    await saveNewFeedItems(id, articles);
    const origin = new URL(request.url).origin;
    return Response.json({ title, rssUrl: `${origin}/feeds/${id}.xml`, sourceUrl: page.url, kind: 'generated', itemCount: articles.length });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法建立 RSS' }, { status: 400 });
  }
}
