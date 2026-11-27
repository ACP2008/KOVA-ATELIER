import React, { useEffect, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { saveSiteSettingsToFirestore } from '../../lib/firestoreService';
import { uploadImageToStorage } from '../../lib/firebase';
import { STUDIO_MEDIA_LIBRARY } from '../../data/seedCatalog';
import { SiteSettings } from '../../types';
import { ResilientImage } from '../ui/ResilientImage';

export function AdminWebsite() {
  const { siteSettings, addToast } = useStore();
  const [form, setForm] = useState<SiteSettings>(siteSettings);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<'heroImage' | 'editorialImage' | null>(null);

  useEffect(() => {
    setForm(siteSettings);
  }, [siteSettings]);

  const handleUploadBanner = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'heroImage' | 'editorialImage'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const url = await uploadImageToStorage(file, 'banners');
      setForm((prev) => ({ ...prev, [field]: url }));
      addToast('success', 'Banner Uploaded', 'Image saved to Firebase Storage.');
    } catch {
      addToast(
        'error',
        'Storage Upload Unavailable',
        'Pick from the Studio Media presets or paste an image URL.'
      );
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSiteSettingsToFirestore(form);
      addToast('success', 'Storefront Updated', 'Homepage banners, branding, and contact settings are live.');
    } catch {
      addToast('error', 'Save Failed', 'Ensure all fields meet validation constraints.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white tracking-tight">
            Website Management
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Update brand identity, homepage banners, shipping thresholds, and concierge channels in real time.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Publishing...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Brand Identity & Announcement */}
      <section className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-5 text-xs">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Brand Identity & Promo Bar</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Store Name</label>
            <input
              type="text"
              required
              maxLength={80}
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Logo Wordmark</label>
            <input
              type="text"
              required
              maxLength={40}
              value={form.logoText}
              onChange={(e) => setForm({ ...form, logoText: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Brand Tagline</label>
            <input
              type="text"
              maxLength={160}
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-zinc-700 dark:text-zinc-300">Top Announcement Banner</label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.promoBannerActive}
                  onChange={(e) => setForm({ ...form, promoBannerActive: e.target.checked })}
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              maxLength={180}
              value={form.promoBannerText}
              onChange={(e) => setForm({ ...form, promoBannerText: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
        </div>
      </section>

      {/* Homepage Hero Banner */}
      <section className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-5 text-xs">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Homepage Hero Campaign</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Hero Headline</label>
            <input
              type="text"
              required
              maxLength={120}
              value={form.heroTitle}
              onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Hero Subtitle</label>
            <textarea
              rows={2}
              maxLength={300}
              value={form.heroSubtitle}
              onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Primary CTA Label</label>
            <input
              type="text"
              required
              maxLength={40}
              value={form.heroCtaText}
              onChange={(e) => setForm({ ...form, heroCtaText: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Hero Banner URL</label>
            <input
              type="text"
              required
              maxLength={500}
              value={form.heroImage}
              onChange={(e) => setForm({ ...form, heroImage: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="w-40 aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <ResilientImage src={form.heroImage} alt="Hero preview" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{uploadingField === 'heroImage' ? 'Uploading...' : 'Upload Hero Banner'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleUploadBanner(e, 'heroImage')}
                className="hidden"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {STUDIO_MEDIA_LIBRARY.slice(0, 2).map((m) => (
                <button
                  type="button"
                  key={m.url}
                  onClick={() => setForm({ ...form, heroImage: m.url })}
                  className="text-[11px] underline text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  Use {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact, Social & Shipping */}
      <section className="glass-panel border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-5 text-xs">
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
          Contact Channels, Social Links & Shipping Rules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Contact Email *</label>
            <input
              type="email"
              required
              maxLength={120}
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Phone Number</label>
            <input
              type="text"
              maxLength={30}
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              WhatsApp Number (international digits)
            </label>
            <input
              type="text"
              maxLength={30}
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Instagram URL</label>
            <input
              type="url"
              maxLength={200}
              value={form.instagramUrl}
              onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Pinterest URL</label>
            <input
              type="url"
              maxLength={200}
              value={form.pinterestUrl}
              onChange={(e) => setForm({ ...form, pinterestUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">X / Twitter URL</label>
            <input
              type="url"
              maxLength={200}
              value={form.twitterUrl}
              onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Free Shipping Threshold (USD)
            </label>
            <input
              type="number"
              min={0}
              max={10000}
              value={form.freeShippingThreshold}
              onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Standard Shipping Cost (USD)
            </label>
            <input
              type="number"
              min={0}
              max={500}
              value={form.standardShippingCost}
              onChange={(e) => setForm({ ...form, standardShippingCost: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Low-Stock Badge Threshold (units)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.lowStockThreshold ?? 5}
              onChange={(e) =>
                setForm({
                  ...form,
                  lowStockThreshold: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))),
                })
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent font-mono text-sm"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Automatically shows the LOW STOCK badge on products at or below this quantity.
            </p>
          </div>
        </div>
      </section>
    </form>
  );
}
