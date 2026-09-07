import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Lock, 
  Mail, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Shield,
  HelpCircle,
  ExternalLink,
  Zap
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { SecureTrackLogo } from './SecureTrackLogo';

interface LoginScreenProps {
  onLocalSessionLogin?: (email: string, role: 'admin' | 'technician') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLocalSessionLogin }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialStock, setInitialStock] = useState<number>(25);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [operationNotAllowed, setOperationNotAllowed] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Setup user document in 'users' collection
  const ensureUserProfile = async (uid: string, userEmail: string, startingStock = 25) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const isAdmin = userEmail.toLowerCase() === 'itsecuretrack@gmail.com' || userEmail.toLowerCase().includes('admin');
        await setDoc(userRef, {
          uid: uid,
          email: userEmail,
          role: isAdmin ? 'admin' : 'technician',
          inventory_count: startingStock,
          inventory_breakdown: {
            fmc920: Math.floor(startingStock / 2),
            fmc130: Math.ceil(startingStock / 2),
            sim_cards: startingStock + 10,
            relays: 20
          },
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('Could not auto-create user document (offline/permission fallback):', e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setOperationNotAllowed(false);

    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(cred.user.uid, cred.user.email || email.trim(), initialStock);
        setInfoMsg('Account created successfully!');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(cred.user.uid, cred.user.email || email.trim(), 20);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('operation-not-allowed') || (err as { code?: string }).code === 'auth/operation-not-allowed') {
        setOperationNotAllowed(true);
        setErrorMsg('Firebase Error (auth/operation-not-allowed): Email/Password authentication provider is not yet enabled in your Firebase console.');
      } else if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        setErrorMsg('Invalid email or password. You can also switch to "Register" or use the quick offline bypass below.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Please sign in instead.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // One-click bypass / session mode for immediate testing even when Firebase Auth provider is not yet enabled
  const handleBypassLogin = (role: 'admin' | 'technician') => {
    const selectedEmail = role === 'admin' ? 'itsecuretrack@gmail.com' : 'tech.lead@securetrack.com';
    if (onLocalSessionLogin) {
      onLocalSessionLogin(selectedEmail, role);
    } else {
      localStorage.setItem('securetrack_local_session', JSON.stringify({
        uid: role === 'admin' ? 'admin_itsecuretrack' : 'tech_sample_01',
        email: selectedEmail,
        role: role,
        inventory_count: 30
      }));
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-center items-center px-4 py-8 bg-slate-950">
      {/* Mobile-first card with SECURETROCK theme */}
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl backdrop-blur-md">
        {/* Brand Header */}
        <div className="mb-6">
          <SecureTrackLogo size="lg" showTagline={true} />
        </div>

        {/* Operation Not Allowed Firebase Guidance Callout */}
        {operationNotAllowed && (
          <div className="mb-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 p-3.5 text-xs text-amber-200 animate-fadeIn space-y-2">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Email/Password Sign-In Disabled in Firebase</p>
                <p className="text-[11px] text-amber-200/90 mt-1">
                  In Firebase Console $\rightarrow$ Authentication $\rightarrow$ Sign-in method, toggle <strong>Email/Password</strong> to <strong>Enabled</strong>.
                </p>
              </div>
            </div>

            {/* Instant Bypass Button */}
            <div className="pt-2 border-t border-amber-600/30 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => handleBypassLogin('admin')}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Instant Sign In as Admin (itsecuretrack@gmail.com)</span>
              </button>
              <button
                type="button"
                onClick={() => handleBypassLogin('technician')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-700"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Continue as Technician (Offline Mode)</span>
              </button>
            </div>
          </div>
        )}

        {/* General Error Alert */}
        {errorMsg && !operationNotAllowed && (
          <div className="mb-4 flex items-start space-x-2 rounded-xl bg-red-950/70 border border-red-500/40 p-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 flex items-center space-x-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="flex-1">{infoMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center">
              <Mail className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              placeholder="technician@securetrack.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center">
              <Lock className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Starting Van Inventory (Units)
              </label>
              <input
                id="register-stock"
                type="number"
                min="1"
                max="500"
                value={initialStock}
                onChange={(e) => setInitialStock(parseInt(e.target.value, 10) || 20)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : isRegisterMode ? (
              <span>Register Account</span>
            ) : (
              <span>Sign In to SECURETROCK</span>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-3.5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMsg(null);
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            {isRegisterMode
              ? 'Already registered? Sign in'
              : 'Need a technician account? Register'}
          </button>
        </div>

        {/* Instant Access Options */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-2 text-[10px] uppercase tracking-wider text-slate-500 absolute">
            One-Click Instant Access
          </span>
        </div>

        <div className="space-y-2">
          {/* Quick Admin Access */}
          <button
            id="admin-quick-login-btn"
            type="button"
            onClick={() => handleBypassLogin('admin')}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-xs font-semibold text-emerald-200 flex items-center justify-center space-x-2 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sign In as Admin (itsecuretrack@gmail.com)</span>
          </button>

          {/* Quick Field Technician Access */}
          <button
            id="tech-quick-login-btn"
            type="button"
            onClick={() => handleBypassLogin('technician')}
            className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs text-slate-300 flex items-center justify-center space-x-2 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Field Technician Demo Session</span>
          </button>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-center space-x-1 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
          <Shield className="w-3 h-3 text-emerald-500" />
          <span>Role-Based Security & Offline Sync</span>
        </div>
      </div>
    </div>
  );
};
