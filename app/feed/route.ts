import { buildRss, decodeSource, extractArticles, inspectFeed, pageTitle, safeFetch } from '../../lib/rss';

export async function GET(request: Request) {
  try {
    const encoded = new URL(request.url).searchParams.get('s');
    if (!encoded || encoded.length > 3000) throw new Error('缺少來源網址');
    const source = decodeSource(encoded);
    const page = await safeFetch(source);
    const articles = extractArticles(page.text, page.url);
    if (!articles.length) throw new Error('來源頁面目前沒有可辨識的文章');
    const xml = buildRss(`${pageTitle(page.text, page.url)}－FeedFoundry`, page.url, articles);
    if (!inspectFeed(xml)) throw new Error('生成結果未通過 RSS 驗證');
    return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900', 'x-content-type-options': 'nosniff' } });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '無法生成 RSS';
    return new Response(`RSS generation failed: ${message}`, { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
