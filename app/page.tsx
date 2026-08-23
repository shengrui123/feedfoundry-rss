'use client';

import { FormEvent, useState } from 'react';

type FeedResult = { title: string; rssUrl: string; sourceUrl: string; kind: 'official' | 'generated'; itemCount: number };

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FeedResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setResult(null); setCopied(false); setLoading(true);
    try {
      const response = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '無法生成 RSS');
      setResult(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '發生未知錯誤'); }
    finally { setLoading(false); }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.rssUrl); setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="site-shell">
      <nav className="nav">
        <a className="brand" href="#top" aria-label="FeedFoundry 首頁"><span className="brand-mark" aria-hidden="true">◔</span>FeedFoundry</a>
        <span className="nav-note">一條網址，變成可訂閱的新聞流</span>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> RSS GENERATOR</div>
        <h1>把新聞網站，<br />鑄造成一條 RSS。</h1>
        <p className="lede">貼上網站網址。我們先尋找並驗證官方訂閱源；沒有官方 RSS，就從頁面內容生成一條由本站持續提供的 RSS。</p>

        <form className="generator" onSubmit={submit}>
          <label htmlFor="source-url">新聞網站網址</label>
          <div className="input-row">
            <input id="source-url" type="url" inputMode="url" autoComplete="url" placeholder="https://www.example.com/news" value={url} onChange={(event) => setUrl(event.target.value)} required />
            <button type="submit" disabled={loading}>{loading ? '正在檢查…' : '生成 RSS'}<span aria-hidden="true">→</span></button>
          </div>
          <p className="form-hint">只接受公開的 HTTP／HTTPS 網頁，不會繞過登入或付費牆。</p>
        </form>

        {error && <div className="message error" role="alert">{error}</div>}
        {result && (
          <section className="result" aria-live="polite">
            <div className="result-head"><div><span className={`badge ${result.kind}`}>{result.kind === 'official' ? '官方 RSS' : '本站生成'}</span><h2>{result.title}</h2></div><span className="verified">● 已驗證 · {result.itemCount} 篇</span></div>
            <label htmlFor="rss-result">可訂閱 RSS 連結</label>
            <div className="result-row"><input id="rss-result" readOnly value={result.rssUrl} onFocus={(e) => e.currentTarget.select()} /><button type="button" onClick={copy}>{copied ? '已複製' : '複製'}</button><a href={result.rssUrl} target="_blank" rel="noreferrer">打開</a></div>
            <p>閱讀器每次存取此連結時，本站都會重新取得來源內容並輸出最新 RSS。</p>
          </section>
        )}
      </section>

      <section className="steps" aria-label="工作方式">
        <article><span>01</span><h2>尋找官方來源</h2><p>檢查網頁聲明與常見路徑，實際下載解析後才採用。</p></article>
        <article><span>02</span><h2>必要時自行生成</h2><p>讀取結構化資料與新聞標題，整理成標準 RSS 2.0。</p></article>
        <article><span>03</span><h2>持續提供訂閱</h2><p>得到真正的 HTTPS 網址，可直接加入任何 RSS 閱讀器。</p></article>
      </section>
      <footer><span>FeedFoundry</span><p>只處理公開頁面 · 來源內容版權歸原網站所有</p></footer>
    </main>
  );
}
