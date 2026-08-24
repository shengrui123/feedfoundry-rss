'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AuthControls from '../auth-controls';

type SavedFeed = { id: string; title: string; sourceUrl: string; rssUrl: string; kind: 'official' | 'search' | 'generated'; itemCount: number };

export default function AllFeedsPage() {
  const [feeds, setFeeds] = useState<SavedFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadFeeds = useCallback(async () => {
    try {
      const response = await fetch('/api/feeds', { cache: 'no-store' });
      const data = await response.json() as { feeds?: SavedFeed[]; error?: string };
      if (!response.ok) throw new Error(data.error || '無法載入 RSS');
      setFeeds(data.feeds || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '無法載入 RSS'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFeeds(), 0);
    return () => window.clearTimeout(timer);
  }, [loadFeeds]);

  async function copy(feed: SavedFeed) {
    await navigator.clipboard.writeText(feed.rssUrl);
    setCopiedId(feed.id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  async function remove(feed: SavedFeed) {
    if (!window.confirm(`確定要刪除「${feed.title}」嗎？${feed.kind === 'generated' ? '\n已保存的文章也會一併刪除。' : ''}`)) return;
    let token = window.sessionStorage.getItem('feed-delete-token') || '';
    if (!token) {
      token = window.prompt('請輸入刪除密碼')?.trim() || '';
      if (!token) return;
      window.sessionStorage.setItem('feed-delete-token', token);
    }
    setDeletingId(feed.id); setError('');
    try {
      const response = await fetch(`/api/feeds?id=${encodeURIComponent(feed.id)}`, { method: 'DELETE', headers: { 'x-feed-delete-token': token } });
      const data = await response.json() as { error?: string };
      if (response.status === 401) window.sessionStorage.removeItem('feed-delete-token');
      if (!response.ok) throw new Error(data.error || '無法刪除 RSS');
      setFeeds((current) => current.filter((item) => item.id !== feed.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '無法刪除 RSS'); }
    finally { setDeletingId(null); }
  }

  return <main className="feeds-page">
    <header className="topbar">
      <Link className="logo" href="/"><span>◔</span> FeedFoundry</Link>
      <div className="top-actions"><AuthControls /><div className="top-status"><i /> Feed engine online</div></div>
    </header>
    <section className="feeds-library">
      <Link className="back-home" href="/">← 返回首頁</Link>
      <div className="library-head"><div><span className="kicker">RSS LIBRARY</span><h1>全部 RSS</h1><p>管理已保存的官方、公開索引與自動生成 RSS。</p></div><Link href="/">＋ 建立新 Feed</Link></div>
      {loading ? <div className="library-empty">正在載入…</div> : feeds.length ? <div className="feed-grid">{feeds.map((feed) => {
        let hostname = feed.sourceUrl;
        try { hostname = new URL(feed.sourceUrl).hostname.replace(/^www\./, ''); } catch { /* Keep source URL. */ }
        const kind = feed.kind === 'official' ? '官方 RSS' : feed.kind === 'search' ? '公開索引' : '自動生成';
        return <article className="feed-card" key={feed.id}>
          <div className="feed-card-top"><span>{feed.title.slice(0, 1).toUpperCase()}</span><em>{kind}</em></div>
          <h2>{feed.title}</h2><p>{hostname}</p>
          <div className="feed-card-meta"><b>{feed.itemCount}</b><span>篇文章</span></div>
          <label>RSS FEED URL</label><div className="card-url" title={feed.rssUrl}>{feed.rssUrl}</div>
          <div className="feed-card-actions"><button type="button" onClick={() => void copy(feed)}>{copiedId === feed.id ? '已複製 ✓' : '複製 RSS'}</button><a href={feed.rssUrl} target="_blank" rel="noreferrer">打開 ↗</a><button className="danger" type="button" disabled={deletingId === feed.id} onClick={() => void remove(feed)}>{deletingId === feed.id ? '刪除中…' : '刪除'}</button></div>
        </article>;
      })}</div> : <div className="library-empty"><b>還沒有 RSS</b><p>建立第一個 Feed 後會出現在這裡。</p><Link href="/">建立 RSS</Link></div>}
    </section>
    {error && <div className="error-toast" role="alert"><b>無法完成</b><span>{error}</span><button type="button" onClick={() => setError('')}>×</button></div>}
  </main>;
}
