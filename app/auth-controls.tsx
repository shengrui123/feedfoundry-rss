'use client';

import { FormEvent, useState } from 'react';
import { authClient } from '../lib/auth-client';

type ProviderId = 'github' | 'google' | 'apple';
const providerLabels: Array<{ id: ProviderId; label: string; icon: string }> = [
  { id: 'github', label: 'GitHub', icon: 'GH' },
  { id: 'google', label: 'Google', icon: 'G' },
  { id: 'apple', label: 'Apple', icon: '' },
];

export default function AuthControls() {
  const { data: session, isPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function show(nextMode: 'login' | 'register') {
    setMode(nextMode); setError(''); setOpen(true);
  }

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode); setError('');
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      if (mode === 'register') {
        const result = await authClient.signUp.email({
          name: name.trim() || email.split('@')[0] || 'User',
          email,
          password,
        });
        if (result.error) throw new Error(result.error.message || '無法建立帳號');
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error('電子郵箱或密碼不正確');
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '暫時無法登入');
      setSubmitting(false);
    }
  }

  if (session) {
    return <div className="account-control">
      <span className={session.user?.image ? 'with-image' : ''} style={session.user?.image ? { backgroundImage: `url(${session.user.image})` } : undefined}>{session.user?.image ? '' : (session.user?.name || session.user?.email || '用').slice(0, 1)}</span>
      <strong>{session.user?.name || session.user?.email || '已登入'}</strong>
      <button type="button" onClick={() => void authClient.signOut().then(() => { window.location.href = '/'; })}>登出</button>
    </div>;
  }

  if (isPending) return <div className="auth-entry" aria-busy="true" />;

  return <>
    <div className="auth-entry">
      <button type="button" onClick={() => show('login')}>登入</button>
      <button type="button" className="auth-primary" onClick={() => show('register')}>註冊</button>
    </div>
    {open && <div className="auth-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="auth-close" type="button" onClick={() => setOpen(false)} aria-label="關閉">×</button>
        <span className="kicker">WELCOME TO FEEDFOUNDRY</span>
        <h2 id="auth-title">{mode === 'login' ? '登入帳號' : '建立帳號'}</h2>
        <p>{mode === 'login' ? '使用電子郵箱與密碼登入，繼續管理你的 RSS。' : '使用電子郵箱建立 FeedFoundry 帳號。'}</p>
        <form className="email-auth-form" onSubmit={submitEmail}>
          {mode === 'register' && <label>顯示名稱（選填）<input type="text" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>}
          <label>電子郵箱<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>密碼<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {mode === 'register' && <small>至少 8 個字元</small>}
          {error && <div className="auth-form-error" role="alert">{error}</div>}
          <button className="email-auth-submit" type="submit" disabled={submitting}>{submitting ? '請稍候…' : mode === 'login' ? '使用郵箱登入' : '註冊並登入'}</button>
        </form>
        <button className="auth-switch" type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '還沒有帳號？立即註冊' : '已經有帳號？直接登入'}</button>
        <div className="auth-divider"><span>或使用其他帳號</span></div>
        <div className="provider-list">{providerLabels.map((provider) => {
          return <button key={provider.id} type="button" onClick={() => void authClient.signIn.social({ provider: provider.id, callbackURL: window.location.href }).then((result) => {
            if (result.error) setError(`${provider.label} 登入尚未配置或暫時無法使用`);
          })}>
            <b>{provider.icon}</b><span>使用 {provider.label} 繼續</span>
          </button>;
        })}</div>
        <div className="auth-notice">GitHub、Google、Apple 入口需要對應的 OAuth 憑證。</div>
      </section>
    </div>}
  </>;
}
