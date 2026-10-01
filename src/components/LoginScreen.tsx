import { FormEvent, useState } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { auth } from '../lib/firebase';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (e: any) { setError(e.code === 'auth/invalid-credential' ? 'The email or password is incorrect.' : 'Sign-in failed. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  async function forgotPassword() {
    const address=email.trim();setError('');setNotice('');
    if(!address){setError('Enter your work email first, then choose Forgot password.');return}
    setBusy(true);
    try{await sendPasswordResetEmail(auth,address);setNotice(`A password reset link was sent to ${address}.`)}
    catch(e:any){setError(e.code==='auth/invalid-email'?'Enter a valid work email address.':'The reset email could not be sent. Check the address and try again.')}
    finally{setBusy(false)}
  }
  return <main className="login-page secure-login">
    <section className="login-brand">
      <img className="login-logo" src="/securetrack-logo.png" alt="SecureTrack"/>
      <div className="login-message"><span className="eyebrow">FIELD OPERATIONS · UAE</span><h1>Precision.<br/>Protection.<br/>Positioning.</h1><p>Assignments, attendance, inventory and completion records in one secure workspace.</p></div>
    </section>
    <section className="login-orbit"><div className="login-ring"><div className="login-card">
      <div className="login-icon"><LockKeyhole size={22}/></div><span className="eyebrow">SECURE ACCESS</span><h2>Welcome back</h2><p className="muted">Use your SecureTrack work account.</p>
      <form onSubmit={submit} autoComplete="off">
        <label>Email address<input name="securetrack-login-email" type="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com"/></label>
        <label>Password<div className={'password-input '+(showPassword?'visible':'')}><input name="securetrack-login-password" type={showPassword?'text':'password'} required minLength={6} autoComplete="current-password" data-lpignore="true" data-1p-ignore="true" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" className="password-eye" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff/>:<Eye/>}</button></div><button type="button" className="forgot-password" disabled={busy} onClick={()=>void forgotPassword()}><Mail/>Forgot password?</button></label>
        {error&&<div className="notice error" role="alert">{error}</div>}
        {notice&&<div className="notice success" role="status">{notice}</div>}
        <button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in securely'}<ArrowRight size={18}/></button>
      </form><p className="fine-print">Accounts are issued by your master administrator.</p>
    </div></div></section>
  </main>;
}
