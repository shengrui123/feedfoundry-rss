import { saveFeed } from '../../../db';
import { assertPublicUrl, extractArticles, findOfficialFeed, pageTitle, safeFetch } from '../../../lib/rss';

async function feedId(sourceUrl: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sourceUrl));
  return [...new Uint8Array(digest)].slice(0, 10).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sourceUrl?: unknown; title?: unknown; maxItems?: unknown; includeDescriptions?: unknown; excludeWords?: unknown };
    const source = assertPublicUrl(body.sourceUrl).href;
    const page = await safeFetch(source);
    const official = await findOfficialFeed(page.text, page.url);
    if (official) return Response.json({ title: official.title, rssUrl: official.url, sourceUrl: page.url, kind: 'official', itemCount: official.itemCount });
    const articles = extractArticles(page.text, page.url);
    if (!articles.length) throw new Error('來源頁面目前沒有可辨識的文章');
    const title = String(body.title || `${pageTitle(page.text, page.url)} RSS`).trim().slice(0, 120);
    const maxItems = Math.min(60, Math.max(5, Number(body.maxItems) || 25));
    const excludeWords = String(body.excludeWords || '').trim().slice(0, 300);
    const id = await feedId(page.url);
    await saveFeed({ id, source_url: page.url, title, max_items: maxItems, include_descriptions: body.includeDescriptions === false ? 0 : 1, exclude_words: excludeWords });
    const origin = new URL(request.url).origin;
    return Response.json({ title, rssUrl: `${origin}/feeds/${id}.xml`, sourceUrl: page.url, kind: 'generated', itemCount: Math.min(maxItems, articles.length) });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法建立 RSS' }, { status: 400 });
  }
}
