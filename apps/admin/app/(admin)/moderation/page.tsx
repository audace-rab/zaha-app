'use client';

import { useCallback, useEffect, useState } from 'react';

type Tab = 'posts' | 'reviews';

interface CommentRow {
  id: string;
  text: string;
  created_at: string;
  authorName: string | null;
}

interface PostRow {
  id: string;
  content: string;
  location: string | null;
  is_business: boolean;
  is_sponsored: boolean;
  created_at: string;
  authorName: string | null;
  media: Array<{ type: string; url: string }>;
  place: PlaceOption | null;
  comments: CommentRow[];
}

interface PlaceOption {
  id: string;
  name: string;
  status: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  authorName: string | null;
  placeName: string | null;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'posts', label: 'Posts & commentaires' },
  { id: 'reviews', label: 'Avis' },
];

const PAGE_SIZE = 20;

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/${tab}?page=${page}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTotal(data.total);
      if (tab === 'posts') setPosts(data.posts);
      else setReviews(data.reviews);
    } catch {
      setError('Impossible de charger les contenus.');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Lieux proposés pour rattacher un post (une seule fois).
  const [placeOptions, setPlaceOptions] = useState<PlaceOption[]>([]);
  useEffect(() => {
    fetch('/api/admin/places?limit=100')
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((d) =>
        setPlaceOptions(
          (d.places as PlaceOption[]).map((p) => ({ id: p.id, name: p.name, status: p.status }))
        )
      )
      .catch(() => {});
  }, []);

  // Rattache / détache un post d'un lieu (mise à jour locale, sans rechargement).
  async function handleSetPlace(postId: string, placeId: string | null) {
    const target = placeId ? (placeOptions.find((p) => p.id === placeId) ?? null) : null;
    const message = target
      ? `Rattacher ce post au lieu « ${target.name} » ?`
      : 'Détacher ce post de son lieu ?';
    // Le select est contrôlé : si on annule, la valeur précédente reste affichée.
    if (!confirm(message)) return;

    const res = await fetch(`/api/admin/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId }),
    });
    if (!res.ok) {
      alert('Échec de la modification du lieu.');
      return;
    }
    const place = placeId ? (placeOptions.find((p) => p.id === placeId) ?? null) : null;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, place } : p)));
  }

  async function handleDelete(kind: 'posts' | 'reviews', id: string) {
    const message =
      kind === 'posts'
        ? 'Supprimer définitivement ce post et tous ses commentaires ?'
        : 'Supprimer définitivement ce contenu ?';
    if (!confirm(message)) return;
    const res = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      alert('Échec de la suppression.');
    }
  }

  // Suppression d'un commentaire : mise à jour locale (pas de rechargement de la liste).
  async function handleDeleteComment(postId: string, commentId: string) {
    if (!confirm('Supprimer définitivement ce commentaire ?')) return;
    const res = await fetch(`/api/admin/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p
        )
      );
    } else {
      alert('Échec de la suppression.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Modération</h1>

      {/* Onglets */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {tab === 'posts' && (
        <SponsoredPostForm
          placeOptions={placeOptions}
          onCreated={() => {
            // Le nouveau post sponsorisé est le plus récent : retour page 1 + rechargement.
            if (page === 1) load();
            else setPage(1);
          }}
        />
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Chargement…</p>
        ) : tab === 'posts' ? (
          posts.length === 0 ? (
            <EmptyState label="Aucun post." />
          ) : (
            posts.map((post) => (
              <article
                key={post.id}
                className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {post.authorName ?? 'Inconnu'}
                      </span>
                      <span>·</span>
                      <span>{new Date(post.created_at).toLocaleString('fr-FR')}</span>
                      {post.location && (
                        <>
                          <span>·</span>
                          <span>{post.location}</span>
                        </>
                      )}
                      {post.is_sponsored && (
                        <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-medium text-fuchsia-700">
                          Sponsorisé
                        </span>
                      )}
                      {post.is_business && !post.is_sponsored && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Business
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {post.content}
                    </p>
                    {post.media.length > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {post.media.map((m, i) =>
                          m.type === 'image' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={i}
                              src={m.url}
                              alt=""
                              className="h-20 w-20 rounded-lg object-cover"
                            />
                          ) : (
                            <video key={i} src={m.url} className="h-20 w-20 rounded-lg object-cover" />
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <DeleteButton onClick={() => handleDelete('posts', post.id)} />
                </div>

                <PostPlacePicker
                  place={post.place}
                  options={placeOptions}
                  onChange={(placeId) => handleSetPlace(post.id, placeId)}
                />

                <PostComments
                  comments={post.comments}
                  onDelete={(commentId) => handleDeleteComment(post.id, commentId)}
                />
              </article>
            ))
          )
        ) : reviews.length === 0 ? (
          <EmptyState label="Aucun avis." />
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {review.authorName ?? 'Inconnu'}
                    </span>
                    <span>·</span>
                    <span>{review.placeName ?? 'Lieu inconnu'}</span>
                    <span>·</span>
                    <span>{new Date(review.created_at).toLocaleString('fr-FR')}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
                      {review.rating}/5
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    {review.comment ?? '—'}
                  </p>
                </div>
                <DeleteButton onClick={() => handleDelete('reviews', review.id)} />
              </div>
            </article>
          ))
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {total} élément{total > 1 ? 's' : ''} — page {page}/{totalPages}
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

/**
 * Création d'un post sponsorisé depuis le back-office.
 * Il est épinglé tout en haut du feed de tous les utilisateurs de l'application.
 */
function SponsoredPostForm({
  placeOptions,
  onCreated,
}: {
  placeOptions: PlaceOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setContent('');
    setLocation('');
    setPlaceId('');
    setPhotos([]);
    setError(null);
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
        const res = await fetch('/api/admin/posts/media', { method: 'POST', body });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() && photos.length === 0) {
      setError('Ajoutez un texte ou au moins une photo.');
      return;
    }
    const place = placeOptions.find((p) => p.id === placeId);
    const message = `Publier ce post sponsorisé ?${
      place ? `\nLieu rattaché : ${place.name}` : ''
    }\nIl sera affiché tout en haut du feed de tous les utilisateurs.`;
    if (!confirm(message)) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          location,
          placeId: placeId || null,
          media: photos.map((url) => ({ url, type: 'image' })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Échec de la publication.');
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

  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700"
      >
        + Nouveau post sponsorisé
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-fuchsia-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Nouveau post sponsorisé</h2>
          <p className="text-xs text-slate-500">
            Affiché tout en haut du feed de tous les utilisateurs, avant les autres posts. Publié
            avec votre compte administrateur.
          </p>
        </div>
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

      <div className="space-y-2">
        <label htmlFor="sponsored-content" className="block text-sm font-medium text-slate-700">
          Texte
        </label>
        <textarea
          id="sponsored-content"
          rows={4}
          maxLength={2000}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="sponsored-location" className="block text-sm font-medium text-slate-700">
            Localisation
          </label>
          <input
            id="sponsored-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
            placeholder="Antananarivo"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="sponsored-place" className="block text-sm font-medium text-slate-700">
            Lieu rattaché
          </label>
          <select
            id="sponsored-place"
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className={inputClass}
          >
            <option value="">Aucun</option>
            {placeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
                {o.status === 'vip' ? ' (VIP)' : o.status === 'premium' ? ' (Premium)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Photos ({photos.length})</span>
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
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {photos.map((url, index) => (
              <li key={`${url}-${index}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Retirer la photo"
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">JPEG, PNG, GIF ou WebP — 4 Mo max par photo.</p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Publication…' : 'Publier en sponsorisé'}
        </button>
      </div>
    </form>
  );
}

/** Lieu rattaché au post. Un lieu VIP active badge + bouton réservation sur mobile. */
function PostPlacePicker({
  place,
  options,
  onChange,
}: {
  place: PlaceOption | null;
  options: PlaceOption[];
  onChange: (placeId: string | null) => void;
}) {
  // Le lieu actuel peut ne pas figurer dans les 100 premiers lieux chargés.
  const choices =
    place && !options.some((o) => o.id === place.id) ? [place, ...options] : options;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
      <span className="font-medium text-slate-500">Lieu rattaché</span>
      <select
        aria-label="Lieu rattaché au post"
        value={place?.id ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      >
        <option value="">Aucun</option>
        {choices.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {o.status === 'vip' ? ' (VIP)' : o.status === 'premium' ? ' (Premium)' : ''}
          </option>
        ))}
      </select>
      {(place?.status === 'vip' || place?.status === 'premium') && (
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            place.status === 'premium' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {place.status === 'premium' ? 'Premium' : 'VIP'} · boutons réserver / appeler actifs
        </span>
      )}
    </div>
  );
}

const VISIBLE_COMMENTS = 3;

/** Commentaires d'un post, directement sous le post (comme sur mobile). */
function PostComments({
  comments,
  onDelete,
}: {
  comments: CommentRow[];
  onDelete: (commentId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  if (comments.length === 0) {
    return <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">Aucun commentaire.</p>;
  }

  const visible = showAll ? comments : comments.slice(0, VISIBLE_COMMENTS);
  const hidden = comments.length - visible.length;

  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs font-medium text-slate-500">
        {comments.length} commentaire{comments.length > 1 ? 's' : ''}
      </p>
      {visible.map((comment) => (
        <div
          key={comment.id}
          className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{comment.authorName ?? 'Inconnu'}</span>
              <span>·</span>
              <span>{new Date(comment.created_at).toLocaleString('fr-FR')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{comment.text}</p>
          </div>
          <DeleteButton onClick={() => onDelete(comment.id)} />
        </div>
      ))}
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Voir les {hidden} autre{hidden > 1 ? 's' : ''} commentaire{hidden > 1 ? 's' : ''}…
        </button>
      )}
      {showAll && comments.length > VISIBLE_COMMENTS && (
        <button
          onClick={() => setShowAll(false)}
          className="block text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Réduire
        </button>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-slate-100 bg-white py-8 text-center text-sm text-slate-500 shadow-sm">
      {label}
    </p>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
    >
      Supprimer
    </button>
  );
}
