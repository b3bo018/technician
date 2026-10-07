import { FormEvent, useState } from 'react';
import { confirmPasswordReset, sendPasswordResetEmail, signInWithEmailAndPassword } from '../lib/cloud/auth';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { auth } from '../lib/aws';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (e: any) { setError(e.code === 'NotAuthorizedException' || e.code === 'auth/invalid-credential' ? 'The email or password is incorrect.' : 'Sign-in failed. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  async function forgotPassword() {
    const address = email.trim(); setError(''); setNotice('');
    if (!address) { setError('Enter your work email first, then choose Forgot password.'); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, address);
      setResetMode(true);
      setNotice('If this account can receive recovery email, Cognito has sent a reset code. Check your inbox, spam, and quarantine folders.');
    } catch { setError('The reset request could not be processed. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await confirmPasswordReset(auth, email.trim(), resetCode.trim(), newPassword);
      setResetMode(false); setResetCode(''); setNewPassword(''); setPassword('');
      setNotice('Your password has been updated. Sign in with your new password.');
    } catch (e: any) { setError(e.message || 'The password could not be reset. Check the code and try again.'); }
    finally { setBusy(false); }
  }

  return <main className="login-page secure-login">
    <section className="login-brand">
      <img className="login-logo" src="/securetrack-logo-clean.png" alt="SecureTrack" />
      <div className="login-message"><span className="eyebrow">FIELD OPERATIONS · UAE</span><h1>Precision.<br />Protection.<br />Positioning.</h1><p>Assignments, attendance, inventory and completion records in one secure workspace.</p></div>
    </section>
    <section className="login-orbit"><div className={"login-ring " + (resetMode ? "reset-open" : "")}><div className={"login-card " + (resetMode ? "reset-mode" : "")}>
      <div className="login-icon"><LockKeyhole size={22} /></div><span className="eyebrow">SECURE ACCESS</span><h2>{resetMode ? 'Reset password' : 'Welcome back'}</h2><p className="muted">Use your SecureTrack work account.</p>
      {resetMode ? <form onSubmit={submitReset} autoComplete="off">
        <label>Email address<input name="securetrack-reset-email" type="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label>Reset code<input name="securetrack-reset-code" type="text" required autoComplete="one-time-code" inputMode="numeric" value={resetCode} onChange={e => setResetCode(e.target.value)} placeholder="Enter the code sent to your email" /></label>
        <label>New password<input name="securetrack-new-password" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Choose a new password" /></label>
        <p className="fine-print">Use at least 8 characters with an uppercase letter, lowercase letter, number, and symbol.</p>
        <button type="button" className="secondary secondary-action" disabled={busy} onClick={() => { setResetMode(false); setResetCode(''); setNewPassword(''); setError(''); setNotice(''); }}>Back to sign in</button>
        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Updating password…' : 'Update password'}<ArrowRight size={18} /></button>
      </form> : <form onSubmit={submit} autoComplete="off">
        <label>Email address<input name="securetrack-login-email" type="email" required autoComplete="off" autoCapitalize="none" spellCheck={false} data-lpignore="true" data-1p-ignore="true" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label>Password<div className={'password-input ' + (showPassword ? 'visible' : '')}><input name="securetrack-login-password" type={showPassword ? 'text' : 'password'} required minLength={6} autoComplete="current-password" data-lpignore="true" data-1p-ignore="true" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" /><button type="button" className="password-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff /> : <Eye />}</button></div><button type="button" className="forgot-password" disabled={busy} onClick={() => void forgotPassword()}><Mail />Forgot password?</button></label>
        {error && <div className="notice error" role="alert">{error}</div>}
        {notice && <div className="notice success" role="status">{notice}</div>}
        <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}<ArrowRight size={18} /></button>
      </form>}
      <p className="fine-print">Accounts are issued by your master administrator.</p>
    </div></div></section>
  </main>;
}
