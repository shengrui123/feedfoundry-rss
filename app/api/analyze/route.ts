import { assertPublicUrl, extractArticles, fetchSource, findOfficialFeed, pageTitle } from '../../../lib/rss';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const source = assertPublicUrl(body.url).href;
    const page = await fetchSource(source);
    const official = page.kind === 'html' ? await findOfficialFeed(page.text, page.url) : null;
    const articles = official ? [] : extractArticles(page.text, page.url);
    if (!official && !articles.length) throw new Error('找不到官方 RSS，頁面內也沒有可辨識的文章');
    return Response.json({
      sourceUrl: page.url,
      title: pageTitle(page.text, page.url),
      official: official ? { title: official.title, rssUrl: official.url, itemCount: official.itemCount } : null,
      articles: articles.slice(0, 12),
      totalDetected: articles.length,
    });
  } catch (cause) {
    return Response.json({ error: cause instanceof Error ? cause.message : '無法分析此網址' }, { status: 400 });
  }
}
