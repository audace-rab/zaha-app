'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Database } from '@/lib/supabase/database.types';

type Place = Database['public']['Tables']['places']['Row'];

const PAGE_SIZE = 20;

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/places/categories')
      .then((r) => (r.ok ? r.json() : { categories: [] }))
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search) params.set('q', search);
      if (category) params.set('category', category);

      const res = await fetch(`/api/admin/places?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlaces(data.places);
      setTotal(data.total);
    } catch {
      setError('Impossible de charger les lieux.');
    } finally {
      setLoading(false);
    }
  }, [page, search, category]);

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce recherche
    return () => clearTimeout(t);
  }, [load]);

  async function handleDelete(place: Place) {
    if (!confirm(`Supprimer définitivement « ${place.name} » ?`)) return;
    const res = await fetch(`/api/admin/places/${place.id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      alert('Échec de la suppression.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Lieux</h1>
        <Link
          href="/places/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          + Nouveau lieu
        </Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Rechercher par nom ou adresse…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Catégorie</th>
              <th className="px-4 py-3">Adresse</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Pro</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Chargement…
                </td>
              </tr>
            ) : places.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucun lieu trouvé.
                </td>
              </tr>
            ) : (
              places.map((place) => (
                <tr key={place.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{place.name}</td>
                  <td className="px-4 py-3 text-slate-600">{place.category}</td>
                  <td className="max-w-56 truncate px-4 py-3 text-slate-600">
                    {place.address ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {place.rating != null ? place.rating.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {place.is_pro ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Pro
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/places/${place.id}`}
                      className="mr-3 text-sm font-medium text-slate-700 hover:underline"
                    >
                      Modifier
                    </Link>
                    <button
                      onClick={() => handleDelete(place)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} lieu{total > 1 ? 'x' : ''} — page {page}/{totalPages}
        </span>
        <div className="space-x-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Précédent
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
