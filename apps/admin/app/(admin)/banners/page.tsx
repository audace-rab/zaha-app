'use client';

import { useCallback, useEffect, useState } from 'react';

interface BannerRow {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  is_active: boolean;
  created_at: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/banners');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBanners(data.banners);
    } catch {
      setError('Impossible de charger les bannières.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(banner: BannerRow) {
    const next = !banner.is_active;
    const message = next
      ? `Activer la bannière « ${banner.title} » ? Elle sera visible dans l'application.`
      : `Désactiver la bannière « ${banner.title} » ? Elle ne sera plus visible dans l'application.`;
    if (!confirm(message)) return;

    const res = await fetch(`/api/admin/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: next }),
    });
    if (!res.ok) {
      alert('Échec de la modification.');
      return;
    }
    setBanners((prev) => prev.map((b) => (b.id === banner.id ? { ...b, is_active: next } : b)));
  }

  async function handleDelete(banner: BannerRow) {
    if (!confirm(`Supprimer définitivement la bannière « ${banner.title} » ?`)) return;
    const res = await fetch(`/api/admin/banners/${banner.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('Échec de la suppression.');
      return;
    }
    setBanners((prev) => prev.filter((b) => b.id !== banner.id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bannières publicitaires</h1>
        <p className="mt-1 text-sm text-slate-500">
          Les bannières actives sont affichées dans l’onglet Lieux de l’application, juste avant les
          résultats de recherche. S’il y en a plusieurs, elles défilent horizontalement (la plus
          récente en premier).
        </p>
      </div>

      <NewBannerForm onCreated={load} />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Chargement…</p>
        ) : banners.length === 0 ? (
          <p className="rounded-xl border border-slate-100 bg-white py-8 text-center text-sm text-slate-500 shadow-sm">
            Aucune bannière.
          </p>
        ) : (
          banners.map((banner) => (
            <article
              key={banner.id}
              className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner.image_url}
                alt={banner.title}
                className={`h-24 w-72 shrink-0 rounded-lg object-cover ${
                  banner.is_active ? '' : 'opacity-40'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{banner.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      banner.is_active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {banner.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {banner.link_url ? (
                    <a
                      href={banner.link_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {banner.link_url}
                    </a>
                  ) : (
                    'Aucun lien'
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Ajoutée le {new Date(banner.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleToggle(banner)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  {banner.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => handleDelete(banner)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function NewBannerForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setLinkUrl('');
    setImageUrl('');
    setError(null);
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/admin/banners/image', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Échec de l’envoi de l’image.');
        return;
      }
      setImageUrl(data.url as string);
    } catch {
      setError('Échec de l’envoi de l’image.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      setError('Ajoutez l’image de la bannière.');
      return;
    }
    if (!confirm(`Publier la bannière « ${title.trim()} » ? Elle sera visible dans l'application.`)) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, imageUrl, linkUrl: linkUrl.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Échec de l’enregistrement.');
        return;
      }
      reset();
      setOpen(false);
      onCreated();
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
      >
        + Nouvelle bannière
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">Nouvelle bannière</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Fermer
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="banner-title" className="block text-sm font-medium text-slate-700">
            Titre (interne) *
          </label>
          <input
            id="banner-title"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="Promo été — Hôtel Carlton"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="banner-link" className="block text-sm font-medium text-slate-700">
            Lien au clic (optionnel)
          </label>
          <input
            id="banner-link"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className={inputClass}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Image *</span>
          <label
            className={`cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 ${
              uploading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {uploading ? 'Envoi en cours…' : imageUrl ? 'Remplacer l’image' : 'Choisir une image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                handleFile(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Aperçu" className="aspect-[3/1] w-full max-w-xl rounded-lg object-cover" />
        )}
        <p className="text-xs text-slate-500">
          Format conseillé : 3:1 (par exemple 1200 × 400 px). JPEG, PNG, GIF ou WebP — 4 Mo max.
          L’image est recadrée au centre si le format diffère.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Publier la bannière'}
        </button>
      </div>
    </form>
  );
}
