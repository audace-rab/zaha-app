import { redirect } from 'next/navigation';
import {
  Calendar,
  MapPin,
  MessageSquare,
  Newspaper,
  Phone,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { getAdminStats } from '@/lib/services/stats';
import { StatsCard } from './components/dashboard/StatsCard';
import { PerformanceChart } from './components/dashboard/PerformanceChart';
import { StatusDonut } from './components/dashboard/StatusDonut';

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  completed: 'Terminée',
  unavailable: 'Indisponible',
  proposed: 'Créneau proposé',
};

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
  completed: 'bg-slate-100 text-slate-600',
  unavailable: 'bg-orange-100 text-orange-800',
  proposed: 'bg-violet-100 text-violet-800',
};

export default async function DashboardPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect('/login');
  }

  const stats = await getAdminStats(admin.supabase);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tableau de bord</h2>
        <p className="mt-1 text-slate-500">Vue d’ensemble de l’activité de l’application Zaha.</p>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 gap-4 md:gap-6 xl:grid-cols-4">
        <StatsCard title="Utilisateurs" value={stats.counts.users} icon={Users} tone="blue" />
        <StatsCard title="Lieux" value={stats.counts.places} icon={MapPin} tone="amber" />
        <StatsCard title="Posts" value={stats.counts.posts} icon={Newspaper} tone="purple" />
        <StatsCard
          title="Commentaires"
          value={stats.counts.comments}
          icon={MessageSquare}
          tone="slate"
        />
        <StatsCard title="Avis" value={stats.counts.reviews} icon={Star} tone="amber" />
        <StatsCard
          title="Réservations"
          value={stats.counts.reservations}
          icon={Calendar}
          tone="emerald"
        />
        <StatsCard
          title="Clics Réserver"
          value={stats.clickTotals.reserve}
          icon={TrendingUp}
          tone="indigo"
          hint={`${stats.clickTotals.reserve30d.toLocaleString('fr-FR')} sur 30 jours`}
        />
        <StatsCard
          title="Clics Appeler"
          value={stats.clickTotals.call}
          icon={Phone}
          tone="rose"
          hint={`${stats.clickTotals.call30d.toLocaleString('fr-FR')} sur 30 jours`}
        />
      </div>

      {/* Graphique + répartition des réservations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>
        <div className="lg:col-span-1">
          <StatusDonut data={stats.reservationsByStatus} />
        </div>
      </div>

      {/* Clics « Réserver » / « Appeler » par lieu */}
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Clics « Réserver » et « Appeler » par lieu
            </h3>
            <p className="text-xs text-slate-500">
              Nombre de fois où un utilisateur a appuyé sur le bouton (fiche du lieu ou feed), pas
              le nombre de réservations effectuées.
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Total :{' '}
            <span className="font-semibold text-slate-900">{stats.clickTotals.reserve}</span>{' '}
            réserver ·{' '}
            <span className="font-semibold text-slate-900">{stats.clickTotals.call}</span> appeler
          </p>
        </div>

        {stats.clicksByPlace.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Aucun lieu VIP ou Premium.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Lieu</th>
                  <th className="px-6 py-4 text-right">Réserver</th>
                  <th className="px-6 py-4 text-right">Réserver (30 j)</th>
                  <th className="px-6 py-4 text-right">Appeler</th>
                  <th className="px-6 py-4 text-right">Appeler (30 j)</th>
                  <th className="px-6 py-4">Dernier clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.clicksByPlace.map((p) => (
                  <tr key={p.placeId} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {p.placeName}
                      {p.placeStatus === 'vip' || p.placeStatus === 'premium' ? (
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.placeStatus === 'premium'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {p.placeStatus === 'premium' ? 'Premium' : 'VIP'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                      {p.reserveTotal.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600">
                      {p.reserve30d.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                      {p.callTotal.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600">
                      {p.call30d.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {p.lastClickAt ? new Date(p.lastClickAt).toLocaleString('fr-FR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Réservations récentes */}
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Réservations récentes</h3>
          </div>
          {stats.recentReservations.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Aucune réservation.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentReservations.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {r.placeName ?? 'Lieu inconnu'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {r.userName ?? 'Client inconnu'} ·{' '}
                      {new Date(r.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGES[r.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {r.price.toLocaleString('fr-FR')} {r.currency}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Derniers inscrits */}
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Derniers inscrits</h3>
          </div>
          {stats.recentUsers.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Aucun utilisateur.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 px-6 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.country}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(u.created_at).toLocaleDateString('fr-FR')}
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
