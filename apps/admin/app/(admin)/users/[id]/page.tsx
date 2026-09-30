'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserDetail {
  profile: Profile;
  isAdmin: boolean;
  isBanned: boolean;
  email: string | null;
  lastSignInAt: string | null;
  posts: Array<{ id: string; content: string; location: string | null; created_at: string }>;
  reservations: Array<{
    id: string;
    date: string;
    status: string;
    price: number;
    currency: string;
    placeName: string | null;
  }>;
}

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', phone: '', description: '', website: '' });

  useEffect(() => {
    params.then((p) => setUserId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (!res.ok) throw new Error();
      const data: UserDetail = await res.json();
      setDetail(data);
      setForm({
        name: data.profile.name ?? '',
        location: data.profile.location ?? '',
        phone: data.profile.phone ?? '',
        description: data.profile.description ?? '',
        website: data.profile.website ?? '',
      });
    } catch {
      setError('Impossible de charger cet utilisateur.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        alert('Échec de l’enregistrement.');
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleBan() {
    if (!userId || !detail) return;
    const action = detail.isBanned ? 'réhabiliter' : 'bannir';
    if (!confirm(`Voulez-vous vraiment ${action} ${detail.profile.name} ?`)) return;
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: !detail.isBanned }),
    });
    if (res.ok) load();
    else alert('Échec de l’opération.');
  }

  async function toggleAdmin() {
    if (!userId || !detail) return;
    const action = detail.isAdmin ? 'révoquer le rôle admin de' : 'promouvoir administrateur';
    if (!confirm(`Voulez-vous vraiment ${action} ${detail.profile.name} ?`)) return;
    const res = await fetch(`/api/admin/users/${userId}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: !detail.isAdmin }),
    });
    if (res.ok) load();
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Échec de l’opération.');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Chargement…</p>;
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Utilisateur introuvable.'}
        </div>
        <button onClick={() => router.push('/users')} className="text-sm text-slate-700 hover:underline">
          ← Retour à la liste
        </button>
      </div>
    );
  }

  const { profile } = detail;
  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';
  const labelClass = 'block text-sm font-medium text-slate-700';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{profile.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {detail.email ?? 'Email inconnu'} · inscrit le{' '}
            {new Date(profile.created_at).toLocaleDateString('fr-FR')}
            {detail.lastSignInAt && (
              <>
                {' '}· dernière connexion le{' '}
                {new Date(detail.lastSignInAt).toLocaleDateString('fr-FR')}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail.isAdmin && (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              Admin
            </span>
          )}
          {detail.isBanned && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              Banni
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Édition du profil */}
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Profil</h2>

          <div className="space-y-2">
            <label className={labelClass} htmlFor="name">Nom</label>
            <input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="location">Localisation</label>
            <input id="location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="phone">Téléphone</label>
            <input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="website">Site web</label>
            <input id="website" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} className={inputClass} />
          </div>
          <div className="space-y-2">
            <label className={labelClass} htmlFor="description">Description</label>
            <textarea id="description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>

        {/* Actions d'administration */}
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Administration</h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={toggleAdmin}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
              >
                {detail.isAdmin ? 'Révoquer le rôle admin' : 'Promouvoir admin'}
              </button>
              <button
                onClick={toggleBan}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  detail.isBanned
                    ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    : 'border-red-300 text-red-700 hover:bg-red-50'
                }`}
              >
                {detail.isBanned ? 'Réhabiliter' : 'Bannir'}
              </button>
            </div>
          </section>

          {/* Réservations récentes */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Réservations récentes
            </h2>
            {detail.reservations.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune réservation.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.reservations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span className="text-slate-700">{r.placeName ?? '—'}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(r.date).toLocaleDateString('fr-FR')} · {r.status} ·{' '}
                      {r.price} {r.currency}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Posts récents */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Posts récents</h2>
            {detail.posts.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun post.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.posts.map((p) => (
                  <li key={p.id}>
                    <p className="line-clamp-2 text-slate-700">{p.content}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleDateString('fr-FR')}
                      {p.location ? ` · ${p.location}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
