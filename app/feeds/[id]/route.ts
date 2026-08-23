import { getFeed, touchFeed } from '../../../db';
import { buildRss, extractArticles, inspectFeed, safeFetch } from '../../../lib/rss';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await context.params;
    const id = rawId.replace(/\.xml$/i, '');
    if (!/^[a-f0-9]{20}$/.test(id)) throw new Error('Feed ID 不正確');
    const feed = await getFeed(id);
    if (!feed) return new Response('Feed not found', { status: 404 });
    const page = await safeFetch(feed.source_url);
    const excluded = feed.exclude_words.toLowerCase().split(/[,，\n]/).map((word) => word.trim()).filter(Boolean);
    let articles = extractArticles(page.text, page.url).filter((article) => !excluded.some((word) => article.title.toLowerCase().includes(word)));
    articles = articles.slice(0, feed.max_items).map((article) => feed.include_descriptions ? article : { ...article, description: '' });
    if (!articles.length) throw new Error('來源目前沒有符合規則的文章');
    const xml = buildRss(feed.title, page.url, articles);
    if (!inspectFeed(xml)) throw new Error('生成結果未通過 RSS 驗證');
    await touchFeed(id);
    return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900', 'x-content-type-options': 'nosniff' } });
  } catch (cause) {
    return new Response(`RSS generation failed: ${cause instanceof Error ? cause.message : 'unknown error'}`, { status: 400, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}
