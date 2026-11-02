'use client';
import { useState } from 'react';
import { LogoMark } from '../Logo';
import { Btn } from '../ui/ui';
import { friendlyError, resetPassword, signInEmail, signInGoogle, signUpEmail, useAuth } from '../../lib/auth';
import { authEnabled } from '../../lib/firebase';
import s from './signin.module.css';

/** Gate: renders children only when signed in (or when Firebase isn't configured, i.e. local dev). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  if (!authEnabled || user) return <>{children}</>;
  if (!ready) return <div className={s.wrap} aria-busy="true" />;
  return <SignIn />;
}

function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(''); setInfo('');
    try { await fn(); } catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };
  const submit = (e: React.FormEvent) => { e.preventDefault(); run(() => (mode === 'in' ? signInEmail(email, pw) : signUpEmail(name.trim(), email, pw))); };
  const forgot = () => email ? run(async () => { await resetPassword(email); setInfo('Reset link sent. Check your inbox.'); }) : setErr('Type your email first.');

  return (
    <div className={s.wrap}>
      <form className={s.card} onSubmit={submit}>
        <LogoMark size={40} />
        <h1>{mode === 'in' ? 'Welcome back' : 'Create your Loopmates'}</h1>
        <p>{mode === 'in' ? 'Sign in to your workspace.' : 'Your mates, your workspace, one account.'}</p>
        <button type="button" className={s.google} disabled={busy} onClick={() => run(signInGoogle)}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          Continue with Google
        </button>
        <div className={s.or}><span>or</span></div>
        {mode === 'up' && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>Password<input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {err && <div className={s.err} role="alert">{err}</div>}
        {info && <div className={s.info} role="status">{info}</div>}
        <Btn variant="primary" type="submit" disabled={busy}>{busy ? 'One sec…' : mode === 'in' ? 'Sign in' : 'Create account'}</Btn>
        <div className={s.links}>
          {mode === 'in' ? <button type="button" onClick={forgot}>Forgot password?</button> : <span />}
          <button type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); }}>{mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>
        </div>
      </form>
    </div>
  );
}
