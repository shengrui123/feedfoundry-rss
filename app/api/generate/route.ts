import { assertPublicUrl, encodeSource, extractArticles, findOfficialFeed, pageTitle, safeFetch } from '../../../lib/rss';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: unknown };
    const source = assertPublicUrl(body.url).href;
    const page = await safeFetch(source);
    if (!/html/i.test(page.contentType) && !/<html\b/i.test(page.text)) throw new Error('輸入網址不是 HTML 網頁');
    const official = await findOfficialFeed(page.text, page.url);
    if (official) return Response.json({ title: official.title, rssUrl: official.url, sourceUrl: page.url, kind: 'official', itemCount: official.itemCount });
    const articles = extractArticles(page.text, page.url);
    if (!articles.length) throw new Error('找不到官方 RSS，頁面內也沒有可辨識的新聞文章');
    const origin = new URL(request.url).origin;
    return Response.json({ title: `${pageTitle(page.text, page.url)}－生成 RSS`, rssUrl: `${origin}/feed?s=${encodeURIComponent(encodeSource(page.url))}`, sourceUrl: page.url, kind: 'generated', itemCount: articles.length });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '無法處理此網址';
    return Response.json({ error: message }, { status: 400 });
  }
}
