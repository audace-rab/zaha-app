'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Place = Database['public']['Tables']['places']['Row'];

interface PlaceFormProps {
  /** Lieu existant (édition) ou null (création). */
  initialPlace?: Place | null;
}

export default function PlaceForm({ initialPlace = null }: PlaceFormProps) {
  const router = useRouter();
  const isEdit = !!initialPlace;

  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initialPlace?.name ?? '',
    category: initialPlace?.category ?? '',
    place_type: initialPlace?.place_type ?? '',
    address: initialPlace?.address ?? '',
    snippet: initialPlace?.snippet ?? '',
    opening_hours: initialPlace?.opening_hours ?? '',
    rating: initialPlace?.rating?.toString() ?? '',
    latitude: initialPlace?.latitude?.toString() ?? '',
    longitude: initialPlace?.longitude?.toString() ?? '',
    google_maps_uri: initialPlace?.google_maps_uri ?? '',
    photo_url: initialPlace?.photo_url ?? '',
    is_pro: initialPlace?.is_pro ?? false,
  });

  useEffect(() => {
    fetch('/api/admin/places/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function parseNumber(value: string): number | null {
    const n = parseFloat(value);
    return value.trim() === '' || Number.isNaN(n) ? null : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name,
      category: form.category,
      place_type: form.place_type || null,
      address: form.address || null,
      snippet: form.snippet || null,
      opening_hours: form.opening_hours || null,
      rating: parseNumber(form.rating),
      latitude: parseNumber(form.latitude),
      longitude: parseNumber(form.longitude),
      google_maps_uri: form.google_maps_uri || null,
      photo_url: form.photo_url || null,
      is_pro: form.is_pro,
    };

    try {
      const res = await fetch(
        isEdit ? `/api/admin/places/${initialPlace.id}` : '/api/admin/places',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Échec de l’enregistrement.');
        return;
      }

      router.push('/places');
      router.refresh();
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
  const labelClass = 'block text-sm font-medium text-slate-700';

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div className="space-y-2">
          <label className={labelClass} htmlFor="name">Nom *</label>
          <input id="name" required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="category">Catégorie *</label>
          <input
            id="category"
            required
            list="place-categories"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            className={inputClass}
          />
          <datalist id="place-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="place_type">Type de lieu</label>
          <input id="place_type" value={form.place_type} onChange={(e) => set('place_type', e.target.value)} className={inputClass} placeholder="restaurant, hôtel, activité…" />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="rating">Note (0–5)</label>
          <input id="rating" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => set('rating', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className={labelClass} htmlFor="address">Adresse</label>
          <input id="address" value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className={labelClass} htmlFor="snippet">Description courte</label>
          <textarea id="snippet" rows={3} value={form.snippet} onChange={(e) => set('snippet', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="latitude">Latitude</label>
          <input id="latitude" type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="longitude">Longitude</label>
          <input id="longitude" type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="opening_hours">Horaires d'ouverture</label>
          <input id="opening_hours" value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2">
          <label className={labelClass} htmlFor="photo_url">URL photo</label>
          <input id="photo_url" type="url" value={form.photo_url} onChange={(e) => set('photo_url', e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className={labelClass} htmlFor="google_maps_uri">Lien Google Maps</label>
          <input id="google_maps_uri" type="url" value={form.google_maps_uri} onChange={(e) => set('google_maps_uri', e.target.value)} className={inputClass} />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.is_pro}
            onChange={(e) => set('is_pro', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Lieu « Pro » (partenaire professionnel)
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer le lieu'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/places')}
          className="rounded-lg border border-slate-300 px-5 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
