import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export function Footer() {
  const { siteSettings, navigate } = useStore();

  return (
    <footer className="bg-zinc-950 text-zinc-300 border-t border-zinc-900">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-zinc-800/80">
          <div className="md:col-span-4 space-y-4">
            <button
              onClick={() => navigate({ name: 'home' })}
              className="font-display text-2xl font-semibold tracking-[0.16em] text-white cursor-pointer"
            >
              {siteSettings.logoText || 'KOVA ATELIER'}
            </button>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
              {siteSettings.tagline}
            </p>
            <div className="text-xs text-zinc-500 space-y-1 pt-2">
              <p>{siteSettings.contactEmail}</p>
              <p className="font-mono tabular-nums">{siteSettings.contactPhone}</p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
              Shop
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => navigate({ name: 'shop' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  All T-Shirts
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'shop', filter: 'new' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  New Arrivals
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'shop', filter: 'featured' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Featured T-Shirts
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'shop', filter: 'sale' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  On Sale
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
              Client Services
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button
                  onClick={() => navigate({ name: 'account', tab: 'track' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Track Your Order
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'account', tab: 'orders' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Order History & Profile
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'wishlist' })}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Saved Wishlist
                </button>
              </li>
              <li>
                <button
                  onClick={() => navigate({ name: 'admin', section: 'overview' })}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  Admin Dashboard
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-wider uppercase text-zinc-400">
              Connect
            </h3>
            <div className="flex flex-col space-y-2.5 text-sm">
              {siteSettings.instagramUrl && (
                <a
                  href={siteSettings.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
              )}
              {siteSettings.pinterestUrl && (
                <a
                  href={siteSettings.pinterestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Pinterest
                </a>
              )}
              {siteSettings.twitterUrl && (
                <a
                  href={siteSettings.twitterUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  X / Journal
                </a>
              )}
              {siteSettings.whatsappNumber && (
                <a
                  href={`https://wa.me/${siteSettings.whatsappNumber.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  WhatsApp Concierge
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} {siteSettings.storeName}. All rights reserved.</p>
          <p>Complimentary express shipping over ${siteSettings.freeShippingThreshold} · Cash on Delivery & Verified Transfer</p>
        </div>
      </div>
    </footer>
  );
}

export function WhatsAppButton() {
  const { siteSettings, route } = useStore();
  if (route.name === 'admin' || !siteSettings.whatsappNumber) return null;

  const digits = siteSettings.whatsappNumber.replace(/\D/g, '');
  if (!digits) return null;

  return (
    <a
      href={`https://wa.me/${digits}?text=${encodeURIComponent(
        `Hello ${siteSettings.storeName} Concierge, I have a question about your collection.`
      )}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Contact Concierge on WhatsApp"
      className="fixed bottom-5 left-5 z-30 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-950/90 text-white backdrop-blur-md border border-white/15 shadow-lg hover:bg-zinc-800 transition-all duration-200 text-xs font-medium"
    >
      <MessageCircle className="w-4 h-4" />
      <span className="hidden sm:inline">Concierge</span>
    </a>
  );
}
