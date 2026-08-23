'use client';

import { FormEvent, useState } from 'react';

type Article = { title: string; url: string; description?: string; date?: string };
type Analysis = { sourceUrl: string; title: string; official: null | { title: string; rssUrl: string; itemCount: number }; articles: Article[]; totalDetected: number };
type Result = { title: string; rssUrl: string; sourceUrl: string; kind: 'official' | 'generated'; itemCount: number };

export default function Home() {
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [feedTitle, setFeedTitle] = useState('');
  const [maxItems, setMaxItems] = useState(25);
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [excludeWords, setExcludeWords] = useState('');
  const [loading, setLoading] = useState<'analyze' | 'create' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setResult(null); setLoading('analyze');
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法載入網站');
      setAnalysis(data); setFeedTitle(`${data.title} RSS`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '無法分析網站'); }
    finally { setLoading(null); }
  }

  async function createFeed() {
    if (!analysis) return;
    setError(''); setLoading('create');
    try {
      const response = await fetch('/api/feeds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceUrl: analysis.sourceUrl, title: feedTitle, maxItems, includeDescriptions, excludeWords }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法建立 Feed');
      setResult(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '無法建立 Feed'); }
    finally { setLoading(null); }
  }

  async function copyFeed() {
    if (!result) return;
    await navigator.clipboard.writeText(result.rssUrl); setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function reset() { setAnalysis(null); setResult(null); setError(''); setUrl(''); }
  const activeStep = result ? 3 : analysis ? 2 : 1;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="logo" type="button" onClick={reset}><span>◔</span> FeedFoundry</button>
        <div className="top-status"><i /> Feed engine online</div>
      </header>

      <div className="workspace">
        <aside className="rail">
          <p className="rail-label">NEW FEED</p>
          {[
            ['1', '輸入來源', '貼上公開網站網址'],
            ['2', '預覽與設定', '確認擷取內容'],
            ['3', '取得 Feed', '複製永久連結'],
          ].map(([number, title, caption], index) => (
            <div className={`rail-step ${activeStep === index + 1 ? 'active' : ''} ${activeStep > index + 1 ? 'done' : ''}`} key={number}>
              <span>{activeStep > index + 1 ? '✓' : number}</span><div><strong>{title}</strong><small>{caption}</small></div>
            </div>
          ))}
          <div className="rail-help"><strong>如何運作？</strong><p>優先返回官方 RSS。只有找不到官方來源時，才根據頁面文章結構建立新的 Feed。</p></div>
        </aside>

        <section className="builder">
          {!analysis && (
            <div className="start-panel">
              <span className="kicker">WEBSITE TO RSS</span>
              <h1>建立新的<br />RSS Feed</h1>
              <p>輸入新聞、部落格或公告頁網址。我們會載入頁面、自動辨識重複文章區塊，並先讓你預覽結果。</p>
              <form onSubmit={analyze} className="url-form">
                <label htmlFor="website-url">網站網址</label>
                <div><input id="website-url" type="url" placeholder="https://example.com/news" value={url} onChange={(event) => setUrl(event.target.value)} autoFocus required /><button disabled={loading === 'analyze'}>{loading === 'analyze' ? '正在載入…' : '載入網站'} <b>→</b></button></div>
              </form>
              <div className="trust-row"><span>✓ 官方 RSS 即時驗證</span><span>✓ 自動文章辨識</span><span>✓ 固定 HTTPS Feed</span></div>
            </div>
          )}

          {analysis && !result && (
            <div className="preview-layout">
              <div className="preview-main">
                <button className="back" onClick={() => setAnalysis(null)} type="button">← 更換網址</button>
                <div className="source-head"><div className="site-icon">{analysis.title.slice(0, 1).toUpperCase()}</div><div><span>來源網站</span><h1>{analysis.title}</h1><a href={analysis.sourceUrl} target="_blank" rel="noreferrer">{analysis.sourceUrl}</a></div></div>

                {analysis.official ? (
                  <div className="official-card"><span className="official-icon">✓</span><div><b>找到官方 RSS</b><h2>{analysis.official.title}</h2><p>已下載並解析驗證，共 {analysis.official.itemCount} 篇文章。將直接使用官方來源，不重複生成。</p></div></div>
                ) : (
                  <>
                    <div className="match-head"><div><span className="pulse" /> 自動模式</div><b>找到 {analysis.totalDetected} 篇匹配文章</b></div>
                    <div className="article-list">
                      {analysis.articles.map((article, index) => <article key={article.url}><span className="article-index">{String(index + 1).padStart(2, '0')}</span><div><h3>{article.title}</h3>{article.description && <p>{article.description}</p>}<small>{article.url}</small></div><span className="matched">MATCHED</span></article>)}
                    </div>
                  </>
                )}
              </div>

              <aside className="settings">
                <span className="kicker">FEED SETTINGS</span>
                <h2>{analysis.official ? '確認官方來源' : '設定輸出內容'}</h2>
                {!analysis.official && <>
                  <label>Feed 名稱<input value={feedTitle} onChange={(event) => setFeedTitle(event.target.value)} maxLength={120} /></label>
                  <label>最多文章數<select value={maxItems} onChange={(event) => setMaxItems(Number(event.target.value))}><option value="10">10 篇</option><option value="25">25 篇</option><option value="40">40 篇</option><option value="60">60 篇</option></select></label>
                  <label>排除標題關鍵字<textarea value={excludeWords} onChange={(event) => setExcludeWords(event.target.value)} placeholder="廣告, 贊助, 直播" rows={3} /></label>
                  <label className="switch"><input type="checkbox" checked={includeDescriptions} onChange={(event) => setIncludeDescriptions(event.target.checked)} /><span />包含文章摘要</label>
                </>}
                <button className="create-button" onClick={createFeed} disabled={loading === 'create'}>{loading === 'create' ? '正在建立…' : analysis.official ? '確認使用官方 RSS' : '建立 RSS Feed'} <b>→</b></button>
                <p className="settings-note">建立前會再次抓取來源並驗證，失敗時不會產生空白 Feed。</p>
              </aside>
            </div>
          )}

          {result && (
            <div className="success-panel">
              <div className="success-mark">✓</div><span className="kicker">FEED READY</span><h1>你的 RSS 已經可以訂閱。</h1><p>{result.kind === 'official' ? '此網站提供了有效的官方 RSS，我們直接保留原始來源。' : '設定已保存。每次閱讀器存取時，都會重新抓取來源並套用你的規則。'}</p>
              <div className="feed-output"><label>RSS FEED URL</label><div><input readOnly value={result.rssUrl} onFocus={(event) => event.currentTarget.select()} /><button onClick={copyFeed} type="button">{copied ? '已複製 ✓' : '複製連結'}</button></div></div>
              <div className="success-actions"><a href={result.rssUrl} target="_blank" rel="noreferrer">打開 XML ↗</a><button type="button" onClick={reset}>＋ 建立另一個 Feed</button></div>
              <div className="feed-facts"><span><b>{result.itemCount}</b>目前項目</span><span><b>{result.kind === 'official' ? '官方' : '15 min'}</b>來源更新</span><span><b>RSS 2.0</b>輸出格式</span></div>
            </div>
          )}
          {error && <div className="error-toast" role="alert"><b>無法完成</b><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}
        </section>
      </div>
    </main>
  );
}
