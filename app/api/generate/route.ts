import { encodeSource, resolveWebsite } from '../../../lib/rss';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const resolved = await resolveWebsite(String(body.url || ''));
    if (resolved.feed) return Response.json({ title: resolved.feed.title, rssUrl: resolved.feed.url, sourceUrl: resolved.sourceUrl, kind: resolved.feed.kind, itemCount: resolved.feed.itemCount });
    const articles = resolved.articles;
    if (!articles.length) throw new Error('找不到官方 RSS，頁面內也沒有可辨識的新聞文章');
    const origin = new URL(request.url).origin;
    return Response.json({ title: `${resolved.title}－生成 RSS`, rssUrl: `${origin}/feed?s=${encodeURIComponent(encodeSource(resolved.sourceUrl))}`, sourceUrl: resolved.sourceUrl, kind: 'generated', itemCount: articles.length });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '無法處理此網址';
    return Response.json({ error: message }, { status: 400 });
  }
}
