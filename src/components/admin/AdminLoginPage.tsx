import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { sendPasswordReset, signInWithEmailPassword } from '../../lib/firebase';
import { verifyAdminBackendAccess } from '../../lib/firestoreService';

function formatAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your admin credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Please wait a few minutes or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console. Enable it under Authentication -> Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Firebase Authentication. Please check your connection.';
    default:
      return 'Authentication failed. Please check your credentials and try again.';
  }
}

export function AdminLoginPage() {
  const {
    user,
    authReady,
    isAdmin,
    adminCheckLoading,
    siteSettings,
    navigate,
    loginWithGoogle,
    logoutAdmin,
    addToast,
  } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password inline mode
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Automatically redirect authenticated admins to /admin/dashboard
  useEffect(() => {
    if (authReady && !adminCheckLoading && user && isAdmin) {
      navigate({ name: 'admin', section: 'overview' });
    }
  }, [authReady, adminCheckLoading, user, isAdmin, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both your admin email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const credential = await signInWithEmailPassword(trimmedEmail, password, rememberMe);
      const signedInUser = credential.user;

      const verified = await verifyAdminBackendAccess(
        signedInUser.uid,
        signedInUser.email,
        signedInUser.emailVerified
      );

      if (!verified) {
        setErrorMessage(
          'Unauthorized access: This account does not have administrator privileges in Firestore.'
        );
        return;
      }

      addToast('success', 'Welcome Back, Admin', 'Signed in to the KOVA ATELIER dashboard.');
      navigate({ name: 'admin', section: 'overview' });
    } catch (err) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccess(null);

    const targetEmail = resetEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setErrorMessage('Please enter a valid admin email address.');
      return;
    }

    setResetSending(true);
    try {
      await sendPasswordReset(targetEmail);
      setResetSuccess(
        `If an admin account exists for ${targetEmail}, a password reset link has been sent.`
      );
      addToast('info', 'Reset Email Sent', 'Check your inbox for the Firebase password reset link.');
    } catch (err) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setResetSending(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#070709] text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Subtle Architectural Monochrome Ambient Backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[780px] h-[420px] rounded-full bg-zinc-400/10 blur-[120px]" />
        <div className="absolute -bottom-48 -right-24 w-[520px] h-[520px] rounded-full bg-zinc-500/10 blur-[130px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      {/* Main Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="rounded-2xl bg-zinc-900/65 backdrop-blur-2xl border border-white/12 shadow-[0_24px_80px_rgba(0,0,0,0.65)] p-7 sm:p-9 space-y-7">
          {/* Brand Logo */}
          <div className="text-center space-y-4">
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="inline-flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <span className="font-display text-2xl font-semibold tracking-[0.22em] text-white uppercase">
                {siteSettings.logoText || 'KOVA ATELIER'}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-400 group-hover:text-zinc-200 transition-colors">
                Menswear Administration
              </span>
            </button>

            <div className="pt-2 space-y-1.5">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {resetMode ? 'Reset Admin Password' : 'Welcome Back, Admin'}
              </h1>
              <p className="text-sm text-zinc-400">
                {resetMode
                  ? 'Enter your administrator email to receive a reset link.'
                  : 'Sign in to manage your store.'}
              </p>
            </div>
          </div>

          {/* Signed-in non-admin customer warning */}
          {authReady && !adminCheckLoading && user && !isAdmin && !errorMessage && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2.5 text-xs"
            >
              <div className="flex items-start gap-2.5 text-red-300">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-200">Unauthorized Account</p>
                  <p className="text-red-200/80 leading-relaxed">
                    Signed in as <span className="font-mono text-white">{user.email}</span>, which
                    does not have administrator privileges. Sign out or log in with an authorized
                    admin account.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logoutAdmin}
                className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors cursor-pointer"
              >
                Sign Out Current Account
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl bg-red-500/12 border border-red-500/30 px-4 py-3 text-xs text-red-200 leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Password Reset Success Banner */}
          {resetSuccess && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl bg-emerald-500/12 border border-emerald-500/30 px-4 py-3 text-xs text-emerald-200 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{resetSuccess}</span>
            </div>
          )}

          {resetMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-reset-email"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="admin@domain.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.05] border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 focus:bg-white/[0.08] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetSending}
                className="w-full h-12 rounded-xl bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {resetSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  <span>Send Password Reset Email</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setErrorMessage(null);
                  setResetSuccess(null);
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Admin Login</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-5" noValidate>
              {/* Email Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your admin email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.05] border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 focus:bg-white/[0.08] transition-colors"
                  />
                </div>
              </div>

              {/* Password Input with Show/Hide toggle */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-zinc-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/[0.05] border border-white/12 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 focus:bg-white/[0.08] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <label className="inline-flex items-center gap-2 text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/25 bg-white/10 accent-white cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setErrorMessage(null);
                    setResetSuccess(null);
                    setResetMode(true);
                  }}
                  className="text-zinc-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary Login Button */}
              <button
                type="submit"
                disabled={submitting || adminCheckLoading}
                className="w-full h-12 rounded-xl bg-white text-zinc-950 text-sm font-semibold tracking-wide hover:bg-zinc-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-black/25"
              >
                {submitting || adminCheckLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </button>

              {/* Divider + Google Admin Option */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-widest">
                  <span className="bg-[#121216] px-3 text-zinc-500">or</span>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting || adminCheckLoading}
                onClick={handleGoogleAdminLogin}
                className="w-full h-11 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/12 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
              >
                Continue with Authorized Google Account
              </button>
            </form>
          )}

          {/* Footer Link back to Storefront */}
          <div className="pt-4 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to {siteSettings.storeName || 'KOVA ATELIER'} Storefront</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
