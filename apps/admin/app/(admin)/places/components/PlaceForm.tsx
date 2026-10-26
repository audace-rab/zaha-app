'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Place = Database['public']['Tables']['places']['Row'];

/** Chambre en cours d'édition (id absent = pas encore enregistrée). */
interface RoomDraft {
  id?: string;
  name: string;
  description: string;
  capacity: string;
  price_per_night: string;
  is_active: boolean;
}

const DEFAULT_ROOM_NAMES = ['Simple', 'Double', 'Suite', 'Familiale'];

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
    phone: initialPlace?.phone ?? '',
    snippet: initialPlace?.snippet ?? '',
    opening_hours: initialPlace?.opening_hours ?? '',
    rating: initialPlace?.rating?.toString() ?? '',
    latitude: initialPlace?.latitude?.toString() ?? '',
    longitude: initialPlace?.longitude?.toString() ?? '',
    google_maps_uri: initialPlace?.google_maps_uri ?? '',
    status: initialPlace?.status ?? 'normal',
  });

  // Carrousel : l'ordre du tableau = ordre d'affichage, la 1re photo = couverture.
  const [photos, setPhotos] = useState<string[]>(() => {
    const list = initialPlace?.photos ?? [];
    if (list.length > 0) return list;
    return initialPlace?.photo_url ? [initialPlace.photo_url] : [];
  });
  const [photoUrlDraft, setPhotoUrlDraft] = useState('');
  const [uploading, setUploading] = useState(false);

  // Chambres (hôtels) : l'ordre du tableau = ordre d'affichage dans l'app.
  const [rooms, setRooms] = useState<RoomDraft[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(!initialPlace);

  const isHotel = [form.category, form.place_type].some((v) =>
    ['hotel', 'hôtel'].includes(v.trim().toLowerCase())
  );

  useEffect(() => {
    fetch('/api/admin/places/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialPlace) return;
    fetch(`/api/admin/places/${initialPlace.id}/rooms`)
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => {
        setRooms(
          (d.rooms as Database['public']['Tables']['place_room_types']['Row'][]).map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description ?? '',
            capacity: String(r.capacity),
            price_per_night: String(r.price_per_night),
            is_active: r.is_active,
          }))
        );
        setRoomsLoaded(true);
      })
      .catch(() => setRoomsLoaded(true));
  }, [initialPlace]);

  function addRoom(name = '') {
    setRooms((prev) => [
      ...prev,
      { name, description: '', capacity: '2', price_per_night: '0', is_active: true },
    ]);
  }

  function updateRoom(index: number, patch: Partial<RoomDraft>) {
    setRooms((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRoom(index: number) {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  }

  function moveRoom(index: number, direction: -1 | 1) {
    setRooms((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function set(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/admin/places/photos', { method: 'POST', body });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(`${file.name} : ${data.error ?? 'échec de l’envoi'}`);
          continue;
        }
        added.push(data.url as string);
      } catch {
        setError(`${file.name} : échec de l’envoi`);
      }
    }
    if (added.length > 0) setPhotos((prev) => [...prev, ...added]);
    setUploading(false);
  }

  function addPhotoUrl() {
    const url = photoUrlDraft.trim();
    if (!url) return;
    setPhotos((prev) => [...prev, url]);
    setPhotoUrlDraft('');
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotos((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
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
      phone: form.phone.trim() || null,
      snippet: form.snippet || null,
      opening_hours: form.opening_hours || null,
      rating: parseNumber(form.rating),
      latitude: parseNumber(form.latitude),
      longitude: parseNumber(form.longitude),
      google_maps_uri: form.google_maps_uri || null,
      photos,
      status: form.status,
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

      const saved = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(saved.error ?? 'Échec de l’enregistrement.');
        return;
      }

      // Chambres : uniquement pour les hôtels, et seulement si la liste a bien été chargée
      // (évite d'effacer des chambres existantes en cas d'échec du chargement).
      if (isHotel && roomsLoaded) {
        const placeId: string = isEdit ? initialPlace.id : saved.place?.id;
        const roomsRes = await fetch(`/api/admin/places/${placeId}/rooms`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rooms: rooms.map((r) => ({
              id: r.id,
              name: r.name,
              description: r.description,
              capacity: Number(r.capacity),
              price_per_night: Number(r.price_per_night),
              is_active: r.is_active,
            })),
          }),
        });
        if (!roomsRes.ok) {
          const data = await roomsRes.json().catch(() => ({}));
          const message = `Lieu enregistré, mais chambres non enregistrées : ${data.error ?? 'erreur inconnue'}`;
          if (!isEdit && placeId) {
            // Le lieu existe désormais : on passe en édition pour éviter un doublon.
            window.alert(message);
            router.replace(`/places/${placeId}`);
          } else {
            setError(message);
          }
          return;
        }
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
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
  const labelClass = 'block text-sm font-medium text-slate-700';

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm sm:grid-cols-2">
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

        <div className="space-y-2">
          <label className={labelClass} htmlFor="phone">Téléphone</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
            placeholder="+261 34 00 000 00"
          />
          <p className="text-xs text-slate-500">
            Utilisé par le bouton « Appeler » (lieux VIP et Premium uniquement).
          </p>
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
          <label className={labelClass} htmlFor="status">Statut du lieu</label>
          <select
            id="status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputClass}
          >
            <option value="normal">Normal (sans boutons Réserver / Appeler)</option>
            <option value="vip">VIP (badge + boutons Réserver / Appeler)</option>
            <option value="premium">Premium (comme VIP)</option>
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className={labelClass} htmlFor="google_maps_uri">Lien Google Maps</label>
          <input id="google_maps_uri" type="url" value={form.google_maps_uri} onChange={(e) => set('google_maps_uri', e.target.value)} className={inputClass} />
        </div>

        {isHotel && (
          <div className="space-y-3 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={labelClass}>Chambres ({rooms.length}) — types de chambre et prix par nuit</label>
              <button
                type="button"
                onClick={() => addRoom()}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                Ajouter une chambre
              </button>
            </div>

            {!roomsLoaded ? (
              <p className="text-sm text-slate-500">Chargement des chambres…</p>
            ) : rooms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                <p>
                  Aucune chambre. Sans chambre, les clients ne pourront pas réserver cet hôtel.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {DEFAULT_ROOM_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => addRoom(name)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {rooms.map((room, index) => (
                  <li
                    key={room.id ?? `new-${index}`}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-6"
                  >
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-slate-600">Nom *</label>
                      <input
                        required
                        value={room.name}
                        onChange={(e) => updateRoom(index, { name: e.target.value })}
                        className={inputClass}
                        placeholder="Double, Suite…"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Capacité</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="1"
                        value={room.capacity}
                        onChange={(e) => updateRoom(index, { capacity: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-slate-600">Prix par nuit (MGA)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={room.price_per_night}
                        onChange={(e) => updateRoom(index, { price_per_night: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <label className="flex items-end gap-2 pb-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={room.is_active}
                        onChange={(e) => updateRoom(index, { is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <div className="space-y-1 sm:col-span-6">
                      <label className="text-xs font-medium text-slate-600">Description</label>
                      <input
                        value={room.description}
                        onChange={(e) => updateRoom(index, { description: e.target.value })}
                        className={inputClass}
                        placeholder="1 lit double, climatisation, vue sur le lac…"
                      />
                    </div>
                    <div className="flex gap-2 text-xs sm:col-span-6">
                      <button
                        type="button"
                        onClick={() => moveRoom(index, -1)}
                        disabled={index === 0}
                        aria-label="Monter la chambre"
                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRoom(index, 1)}
                        disabled={index === rooms.length - 1}
                        aria-label="Descendre la chambre"
                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRoom(index)}
                        className="ml-auto font-medium text-red-600 hover:underline"
                      >
                        Retirer
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-3 sm:col-span-2">
          <div className="flex items-center justify-between">
            <label className={labelClass}>
              Photos ({photos.length}) — la première est la photo de couverture
            </label>
            <label
              className={`cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 ${
                uploading ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {uploading ? 'Envoi en cours…' : 'Ajouter des photos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {photos.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Aucune photo. Ajoutez des fichiers (JPEG, PNG, GIF, WebP — 4 Mo max) ou collez une URL.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photos.map((url, index) => (
                <li
                  key={`${url}-${index}`}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                >
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-28 w-full object-cover" />
                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                        Couverture
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 p-2 text-xs">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => movePhoto(index, -1)}
                        disabled={index === 0}
                        aria-label="Déplacer vers la gauche"
                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(index, 1)}
                        disabled={index === photos.length - 1}
                        aria-label="Déplacer vers la droite"
                        className="rounded border border-slate-300 px-2 py-1 disabled:opacity-30"
                      >
                        ▶
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <input
              type="url"
              value={photoUrlDraft}
              onChange={(e) => setPhotoUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPhotoUrl();
                }
              }}
              placeholder="https://… (ajouter une photo par URL)"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addPhotoUrl}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
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
