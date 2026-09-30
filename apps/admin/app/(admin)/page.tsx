import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats } from '@/lib/services/stats';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
};

export default async function DashboardPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/login');
  }

  const stats = await getAdminStats(admin.supabase);

  const cards = [
    { label: 'Utilisateurs', value: stats.counts.users },
    { label: 'Lieux', value: stats.counts.places },
    { label: 'Posts', value: stats.counts.posts },
    { label: 'Commentaires', value: stats.counts.comments },
    { label: 'Avis', value: stats.counts.reviews },
    { label: 'Réservations', value: stats.counts.reservations },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {card.value.toLocaleString('fr-FR')}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Réservations par statut */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Réservations par statut
          </h2>
          {Object.keys(stats.reservationsByStatus).length === 0 ? (
            <p className="text-sm text-slate-500">Aucune réservation.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(stats.reservationsByStatus).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-900">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Réservations récentes */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Réservations récentes
          </h2>
          {stats.recentReservations.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune réservation.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentReservations.map((r) => (
                <li key={r.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {r.placeName ?? 'Lieu inconnu'}
                    </span>
                    <span className="text-slate-500">
                      {r.price.toLocaleString('fr-FR')} {r.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{r.userName ?? 'Client inconnu'}</span>
                    <span>
                      {new Date(r.date).toLocaleDateString('fr-FR')} ·{' '}
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Derniers inscrits */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Derniers inscrits
          </h2>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun utilisateur.</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium text-slate-900">{u.name}</span>
                  <span className="text-xs text-slate-500">
                    {u.country} · {new Date(u.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
