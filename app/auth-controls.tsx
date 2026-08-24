'use client';

import { getProviders, signIn, signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type ProviderId = 'github' | 'google' | 'apple';
const providerLabels: Array<{ id: ProviderId; label: string; icon: string }> = [
  { id: 'github', label: 'GitHub', icon: 'GH' },
  { id: 'google', label: 'Google', icon: 'G' },
  { id: 'apple', label: 'Apple', icon: '' },
];

export default function AuthControls() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getProviders().then((providers) => setEnabled(new Set(Object.keys(providers || {}))));
  }, []);

  if (status === 'authenticated') {
    return <div className="account-control">
      <span className={session.user?.image ? 'with-image' : ''} style={session.user?.image ? { backgroundImage: `url(${session.user.image})` } : undefined}>{session.user?.image ? '' : (session.user?.name || session.user?.email || '用').slice(0, 1)}</span>
      <strong>{session.user?.name || session.user?.email || '已登入'}</strong>
      <button type="button" onClick={() => void signOut({ callbackUrl: '/' })}>登出</button>
    </div>;
  }

  return <>
    <div className="auth-entry">
      <button type="button" onClick={() => setOpen(true)}>登入</button>
      <button type="button" className="auth-primary" onClick={() => setOpen(true)}>註冊</button>
    </div>
    {open && <div className="auth-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="auth-close" type="button" onClick={() => setOpen(false)} aria-label="關閉">×</button>
        <span className="kicker">WELCOME TO FEEDFOUNDRY</span>
        <h2 id="auth-title">登入或建立帳號</h2>
        <p>使用你已有的帳號一鍵繼續，無需另設密碼。</p>
        <div className="provider-list">{providerLabels.map((provider) => {
          const available = enabled.has(provider.id);
          return <button key={provider.id} type="button" disabled={!available} onClick={() => void signIn(provider.id, { callbackUrl: window.location.href })}>
            <b>{provider.icon}</b><span>使用 {provider.label} 繼續</span>{!available && <small>待配置</small>}
          </button>;
        })}</div>
        {!enabled.size && <div className="auth-notice">OAuth 憑證完成配置後，這些入口會自動啟用。</div>}
      </section>
    </div>}
  </>;
}
