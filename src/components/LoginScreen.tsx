import { FormEvent, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { auth } from '../lib/firebase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (e: any) { setError(e.code === 'auth/invalid-credential' ? 'The email or password is incorrect.' : 'Sign-in failed. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <main className="login-page secure-login">
    <section className="login-brand">
      <img className="login-logo" src="/securetrack-logo.png" alt="SecureTrack"/>
      <div className="login-message"><span className="eyebrow">FIELD OPERATIONS · UAE</span><h1>Precision.<br/>Protection.<br/>Positioning.</h1><p>Assignments, attendance, inventory and completion records in one secure workspace.</p></div>
    </section>
    <section className="login-orbit"><div className="login-ring"><div className="login-card">
      <div className="login-icon"><LockKeyhole size={22}/></div><span className="eyebrow">SECURE ACCESS</span><h2>Welcome back</h2><p className="muted">Use your SecureTrack work account.</p>
      <form onSubmit={submit}>
        <label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label>
        <label>Password<input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label>
        {error&&<div className="notice error" role="alert">{error}</div>}
        <button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in securely'}<ArrowRight size={18}/></button>
      </form><p className="fine-print">Accounts are issued by your master administrator.</p>
    </div></div></section>
  </main>;
}
