import React, { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { subscribeToNewsletter } from '../../lib/firestoreService';
import { ResilientImage } from '../ui/ResilientImage';

const SESSION_DISMISS_KEY = 'kova_newsletter_popup_dismissed';
const SUBSCRIBED_KEY = 'kova_newsletter_subscribed';
const POPUP_DELAY_MS = 4000;

export function NewsletterPopup() {
  const { siteSettings, addToast } = useStore();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    try {
      if (
        localStorage.getItem(SUBSCRIBED_KEY) === 'true' ||
        sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true'
      ) {
        return;
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, POPUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      addToast('error', 'Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await subscribeToNewsletter(trimmed);
      setSubscribed(true);
      try {
        localStorage.setItem(SUBSCRIBED_KEY, 'true');
      } catch {
        // Ignore storage errors
      }
      addToast('success', 'Welcome to the Atelier', 'You are subscribed to private releases.');
    } catch {
      addToast('error', 'Subscription Error', 'Unable to save your email right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText('KOVA15');
      setCopiedCode(true);
      addToast('info', 'Code Copied', 'KOVA15 copied for checkout.');
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      addToast('info', 'Promo Code', 'Use KOVA15 at checkout for 15% off.');
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="newsletter-popup-heading"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white/85 backdrop-blur-2xl border border-white/70 shadow-2xl grid grid-cols-1 sm:grid-cols-12"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close newsletter invitation"
          className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-10 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md border border-zinc-200/80 flex items-center justify-center text-zinc-600 hover:text-zinc-950 hover:bg-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Left Editorial Visual */}
        <div className="hidden sm:block sm:col-span-5 relative bg-zinc-200">
          <ResilientImage
            src={siteSettings.editorialImage}
            alt={`${siteSettings.storeName} seasonal lookbook`}
            fallbackTitle={siteSettings.storeName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </div>

        {/* Right Frosted Glass Form */}
        <div className="sm:col-span-7 p-5 sm:p-9 flex flex-col justify-center">
          <p className="text-[11px] tracking-[0.22em] uppercase text-zinc-500">
            {siteSettings.logoText || 'KOVA ATELIER'} · Private List
          </p>

          {subscribed ? (
            <div className="mt-4 space-y-5">
              <div className="w-10 h-10 rounded-full bg-zinc-950 text-white flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <h2
                  id="newsletter-popup-heading"
                  className="font-display text-3xl font-medium text-zinc-950 leading-tight text-balance"
                >
                  You&apos;re on the List
                </h2>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Enjoy 15% off your first order over $100 with your private welcome code below.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/80 border border-zinc-200">
                <span className="font-mono text-sm font-semibold tracking-wider text-zinc-950">
                  KOVA15
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-950 transition-colors cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-3 px-5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Continue Exploring
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-4 sm:space-y-5">
              <div className="space-y-2 pr-6 sm:pr-0">
                <h2
                  id="newsletter-popup-heading"
                  className="font-display text-2xl sm:text-[34px] font-medium text-zinc-950 leading-[1.12] text-balance"
                >
                  Early Access & 15% Off Your First Order
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                  Join our private list for small-batch men&apos;s T-shirt drops, limited graphic editions, and heavyweight cotton restocks.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="popup-newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="popup-newsletter-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full px-4 py-3 text-base sm:text-sm bg-white/85 border border-zinc-300/90 rounded-lg text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Joining...' : 'Join Private List'}
                </button>
              </form>

              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-zinc-500 hover:text-zinc-900 underline underline-offset-4 transition-colors self-start cursor-pointer"
              >
                No thanks, continue browsing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
