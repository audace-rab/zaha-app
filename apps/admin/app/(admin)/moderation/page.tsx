'use client';

import { useCallback, useEffect, useState } from 'react';

type Tab = 'posts' | 'comments' | 'reviews';

interface PostRow {
  id: string;
  content: string;
  location: string | null;
  is_business: boolean;
  created_at: string;
  authorName: string | null;
  media: Array<{ type: string; url: string }>;
}

interface CommentRow {
  id: string;
  post_id: string;
  text: string;
  created_at: string;
  authorName: string | null;
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
  { id: 'posts', label: 'Posts' },
  { id: 'comments', label: 'Commentaires' },
  { id: 'reviews', label: 'Avis' },
];

const PAGE_SIZE = 20;

export default function ModerationPage() {
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
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
      else if (tab === 'comments') setComments(data.comments);
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

  async function handleDelete(kind: Tab, id: string) {
    if (!confirm('Supprimer définitivement ce contenu ?')) return;
    const res = await fetch(`/api/admin/${kind}/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      alert('Échec de la suppression.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Modération</h1>

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
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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
                      {post.is_business && (
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
              </article>
            ))
          )
        ) : tab === 'comments' ? (
          comments.length === 0 ? (
            <EmptyState label="Aucun commentaire." />
          ) : (
            comments.map((comment) => (
              <article
                key={comment.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {comment.authorName ?? 'Inconnu'}
                      </span>
                      <span>·</span>
                      <span>{new Date(comment.created_at).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {comment.text}
                    </p>
                  </div>
                  <DeleteButton onClick={() => handleDelete('comments', comment.id)} />
                </div>
              </article>
            ))
          )
        ) : reviews.length === 0 ? (
          <EmptyState label="Aucun avis." />
        ) : (
          reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-slate-200 bg-white py-8 text-center text-sm text-slate-500 shadow-sm">
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
