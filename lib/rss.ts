const MAX_BYTES = 2_000_000;
const COMMON_FEED_PATHS = ['/feed', '/feed/', '/rss', '/rss/', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml'];

export type Article = { title: string; url: string; description?: string; date?: string };
export type FeedInfo = { title: string; itemCount: number; url: string };
export type SourcePage = { text: string; url: string; contentType: string; kind: 'html' | 'sitemap' };

export function assertPublicUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('請輸入有效網址');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('網址格式不正確'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('只接受公開的 HTTP／HTTPS 網址');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('不接受非標準連接埠');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('不接受本機或內部網址');
  if (/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host)) throw new Error('不接受私有 IP 網址');
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb')) throw new Error('不接受私有 IPv6 網址');
  url.hash = '';
  return url;
}

async function readLimited(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('來源內容過大');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('來源內容過大'); }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

export async function safeFetch(input: string, accept = 'text/html,application/xhtml+xml'): Promise<{ text: string; url: string; contentType: string }> {
  let url = assertPublicUrl(input);
  for (let redirect = 0; redirect <= 5; redirect += 1) {
    const response = await fetch(url, { redirect: 'manual', headers: { accept, 'user-agent': 'FeedFoundry/1.0 (+RSS generator)' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('來源重新導向無效');
      url = assertPublicUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`來源回應 HTTP ${response.status}`);
    return { text: await readLimited(response), url: response.url || url.href, contentType: response.headers.get('content-type') || '' };
  }
  throw new Error('來源重新導向次數過多');
}

function sitemapCandidates(source: URL): string[] {
  const candidates: string[] = [];
  if (source.hostname === 'reuters.com' || source.hostname.endsWith('.reuters.com')) {
    candidates.push(new URL('/arc/outboundfeeds/news-sitemap/?outputType=xml', source.origin).href);
  }
  for (const path of ['/news-sitemap.xml', '/sitemap-news.xml', '/sitemap_news.xml', '/sitemap.xml']) {
    candidates.push(new URL(path, source.origin).href);
  }
  return [...new Set(candidates)];
}

export async function fetchSource(input: string): Promise<SourcePage> {
  const source = assertPublicUrl(input);
  let pageError: unknown;
  try {
    const page = await safeFetch(source.href);
    if (/html/i.test(page.contentType) || /<html\b/i.test(page.text)) return { ...page, kind: 'html' };
    pageError = new Error('輸入網址不是 HTML 網頁');
  } catch (cause) {
    pageError = cause;
  }

  for (const candidate of sitemapCandidates(source)) {
    try {
      const sitemap = await safeFetch(candidate, 'application/xml,text/xml,application/rss+xml');
      if (extractSitemapArticles(sitemap.text, source.href).length) {
        return { text: sitemap.text, url: source.href, contentType: sitemap.contentType, kind: 'sitemap' };
      }
    } catch { /* Try the next public sitemap. */ }
  }

  throw pageError instanceof Error ? pageError : new Error('無法讀取來源網站');
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x?[\da-f]+|[a-z]+);/gi, (_, code: string) => {
    if (code[0] === '#') {
      const hex = code[1]?.toLowerCase() === 'x';
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : '';
    }
    return named[code.toLowerCase()] ?? `&${code};`;
  });
}

function stripHtml(value: string): string { return decodeEntities(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }
function attr(tag: string, name: string): string { return decodeEntities(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] || ''); }
function xmlText(value: string): string { return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').trim(); }
function xmlEscape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }

export function inspectFeed(xml: string, url = ''): FeedInfo | null {
  if (!/<(?:rss|feed|rdf:RDF)\b/i.test(xml)) return null;
  const isAtom = /<feed\b/i.test(xml);
  const blocks = [...xml.matchAll(isAtom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const valid = blocks.filter((block) => {
    const title = block.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const link = isAtom ? block.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1] : block.match(/<link\b[^>]*>([\s\S]*?)<\/link>/i)?.[1];
    return Boolean(title && link);
  });
  if (!valid.length) return null;
  const channel = xml.match(/<(?:channel|feed)\b[\s\S]*?<\/(?:channel|feed)>/i)?.[0] || xml;
  const title = xmlText(channel.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || 'RSS 訂閱');
  return { title: decodeEntities(title), itemCount: valid.length, url };
}

export async function findOfficialFeed(html: string, pageUrl: string): Promise<FeedInfo | null> {
  const base = new URL(pageUrl);
  const candidates = new Set<string>();
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = attr(tag, 'rel'); const type = attr(tag, 'type'); const href = attr(tag, 'href');
    if (/alternate/i.test(rel) && (/(rss|atom|feed|xml|json)/i.test(type) || /(?:rss|atom|feed)/i.test(href))) {
      try { candidates.add(new URL(href, base).href); } catch { /* ignore */ }
    }
  }
  for (const path of COMMON_FEED_PATHS) candidates.add(new URL(path, base.origin).href);
  for (const candidate of [...candidates].slice(0, 16)) {
    try {
      const response = await safeFetch(candidate, 'application/rss+xml,application/atom+xml,application/xml,text/xml');
      const info = inspectFeed(response.text, response.url);
      if (info) return info;
    } catch { /* Try the next declared candidate. */ }
  }
  return null;
}

function addArticle(items: Map<string, Article>, pageUrl: URL, article: Article) {
  const title = stripHtml(article.title).slice(0, 240);
  if (title.length < 6) return;
  let url: URL;
  try { url = new URL(article.url, pageUrl); } catch { return; }
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== pageUrl.hostname) return;
  url.hash = '';
  if (!items.has(url.href)) items.set(url.href, { title, url: url.href, description: stripHtml(article.description || '').slice(0, 1000), date: article.date });
}

function visitJsonLd(value: unknown, items: Map<string, Article>, pageUrl: URL) {
  if (Array.isArray(value)) { value.forEach((item) => visitJsonLd(item, items, pageUrl)); return; }
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (data['@graph']) visitJsonLd(data['@graph'], items, pageUrl);
  const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
  if (!types.some((type) => /^(NewsArticle|Article|ReportageNewsArticle|BlogPosting)$/i.test(String(type || '')))) return;
  const rawUrl = data.url || data.mainEntityOfPage || data['@id'] || pageUrl.href;
  const articleUrl = typeof rawUrl === 'object' && rawUrl ? String((rawUrl as Record<string, unknown>)['@id'] || (rawUrl as Record<string, unknown>).url || '') : String(rawUrl);
  addArticle(items, pageUrl, { title: String(data.headline || data.name || ''), url: articleUrl, description: String(data.description || ''), date: String(data.datePublished || data.dateModified || '') });
}

export function extractArticles(html: string, pageUrlString: string): Article[] {
  if (/<urlset\b/i.test(html)) return extractSitemapArticles(html, pageUrlString);
  const pageUrl = new URL(pageUrlString);
  const items = new Map<string, Article>();
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visitJsonLd(JSON.parse(match[1]), items, pageUrl); } catch { /* ignore malformed JSON-LD */ }
  }
  const regions = [...html.matchAll(/<(?:article|h1|h2|h3)\b[^>]*>([\s\S]*?)<\/(?:article|h1|h2|h3)>/gi)].map((m) => m[1]);
  for (const region of regions) {
    for (const link of region.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = attr(`<a ${link[1]}>`, 'href');
      if (href) addArticle(items, pageUrl, { title: link[2], url: href, description: stripHtml(region.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '') });
    }
  }
  return [...items.values()];
}

export function extractSitemapArticles(xml: string, pageUrlString: string): Article[] {
  const pageUrl = new URL(pageUrlString);
  const items = new Map<string, Article>();
  for (const match of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const url = decodeEntities(xmlText(block.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i)?.[1] || ''));
    const title = decodeEntities(xmlText(block.match(/<(?:news:)?title\b[^>]*>([\s\S]*?)<\/(?:news:)?title>/i)?.[1] || ''));
    const date = decodeEntities(xmlText(block.match(/<(?:news:publication_date|lastmod)\b[^>]*>([\s\S]*?)<\/(?:news:publication_date|lastmod)>/i)?.[1] || ''));
    if (url && title) addArticle(items, pageUrl, { title, url, date });
  }
  return [...items.values()];
}

export function buildRss(title: string, sourceUrl: string, articles: Article[]): string {
  const items = articles.map((article) => `\n    <item><title>${xmlEscape(article.title)}</title><link>${xmlEscape(article.url)}</link><guid isPermaLink="true">${xmlEscape(article.url)}</guid>${article.date && !Number.isNaN(Date.parse(article.date)) ? `<pubDate>${new Date(article.date).toUTCString()}</pubDate>` : ''}${article.description ? `<description>${xmlEscape(article.description)}</description>` : ''}</item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlEscape(title)}</title><link>${xmlEscape(sourceUrl)}</link><description>${xmlEscape(`FeedFoundry 從 ${new URL(sourceUrl).hostname} 公開頁面生成`)}</description><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}\n</channel></rss>`;
}

export function pageTitle(html: string, fallbackUrl: string): string {
  const og = html.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*>/i)?.[0];
  const sitemapName = decodeEntities(xmlText(html.match(/<news:name\b[^>]*>([\s\S]*?)<\/news:name>/i)?.[1] || ''));
  const title = og ? attr(og, 'content') : stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') || sitemapName;
  return title || new URL(fallbackUrl).hostname;
}

export function encodeSource(url: string): string { return btoa(unescape(encodeURIComponent(url))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
export function decodeSource(value: string): string { const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='); return decodeURIComponent(escape(atob(base64))); }
